-- 0044 Events, camps, parties (§4.8, F9.1, F9.2, F9.4). Registration (Desk + Home) checks the window,
-- capacity (per day for multi-day camps) and required waivers, prices the chosen option and creates the
-- invoice (source 'event'); paying it marks the registration paid. Day check-in/out records who picked the
-- child up with a signature image. Parties carry a host, a deposit invoice and a guest waiver link.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  location_id uuid,
  kind text not null default 'event' check (kind in ('event', 'camp', 'party', 'seminar', 'tournament', 'ceremony')),
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity int check (capacity is null or capacity > 0),
  waiver_template_ids uuid[] not null default '{}',
  pricing jsonb not null default '[]'::jsonb,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  status text not null default 'open' check (status in ('draft', 'open', 'closed', 'completed', 'cancelled')),
  image_path text,
  host_household_id uuid,
  deposit_cents int check (deposit_cents is null or deposit_cents >= 0),
  deposit_invoice_id uuid,
  guest_link_token_hash text unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id) on delete set null (location_id),
  foreign key (tenant_id, host_household_id) references public.households (tenant_id, id) on delete set null (host_household_id),
  foreign key (tenant_id, deposit_invoice_id) references public.invoices (tenant_id, id) on delete set null (deposit_invoice_id)
);
select app.setup_tenant_table('public.events', 'events.manage', null, 'programs_plus');

create table public.event_days (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  event_id uuid not null,
  date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, date),
  foreign key (tenant_id, event_id) references public.events (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.event_days', 'events.manage', null, 'programs_plus');

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  event_id uuid not null,
  person_id uuid not null,
  household_id uuid,
  option_label text,
  days uuid[],
  status text not null default 'registered' check (status in ('registered', 'paid', 'cancelled', 'attended')),
  invoice_id uuid,
  notes text,
  allergies_ack boolean not null default false,
  registered_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, person_id),
  foreign key (tenant_id, event_id) references public.events (tenant_id, id) on delete cascade,
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade,
  foreign key (tenant_id, household_id) references public.households (tenant_id, id) on delete set null (household_id),
  foreign key (tenant_id, invoice_id) references public.invoices (tenant_id, id) on delete set null (invoice_id)
);
select app.setup_tenant_table('public.event_registrations', 'events.manage', 'events.manage', 'programs_plus');
create policy event_registrations_household_select on public.event_registrations for select to authenticated
  using (tenant_id = (select app.tenant_id()) and person_id = any ((select app.household_person_ids())::uuid[]));

create table public.event_checkins (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  event_day_id uuid not null,
  person_id uuid not null,
  in_at timestamptz not null default now(),
  out_at timestamptz,
  in_by uuid references auth.users (id) on delete set null,
  out_by uuid references auth.users (id) on delete set null,
  pickup_person_name text,
  signature_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_day_id, person_id),
  foreign key (tenant_id, event_day_id) references public.event_days (tenant_id, id) on delete cascade,
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.event_checkins', 'events.manage', 'events.manage', 'programs_plus');

create table public.authorized_pickups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  person_id uuid not null,
  name text not null check (length(trim(name)) > 1),
  relationship text,
  phone text,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.authorized_pickups', 'people.write', 'people.read');
create policy authorized_pickups_household_select on public.authorized_pickups for select to authenticated
  using (tenant_id = (select app.tenant_id()) and person_id = any ((select app.household_person_ids())::uuid[]));

create table public.event_guest_waivers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  event_id uuid not null,
  template_id uuid,
  guest_name text not null,
  guest_dob date,
  guardian_name text not null,
  guardian_phone text,
  typed_signature text not null,
  signed_at timestamptz not null default now(),
  ip text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, event_id) references public.events (tenant_id, id) on delete cascade,
  foreign key (tenant_id, template_id) references public.document_templates (tenant_id, id) on delete set null (template_id)
);
select app.setup_tenant_table('public.event_guest_waivers', null, 'events.manage', 'programs_plus');

-- Price of an option for a number of days (per person → flat; per day → × days; per week → × ceil(days/5)).
create or replace function app.event_price(p_pricing jsonb, p_label text, p_days int)
returns int
language sql
immutable
set search_path = ''
as $$
  select case o ->> 'per'
           when 'day' then (o ->> 'price_cents')::int * greatest(p_days, 1)
           when 'week' then (o ->> 'price_cents')::int * greatest(ceil(p_days / 5.0)::int, 1)
           else (o ->> 'price_cents')::int end
  from jsonb_array_elements(p_pricing) o where o ->> 'label' = p_label limit 1;
$$;

create or replace function public.register_for_event(p_event_id uuid, p_person_id uuid, p_option_label text, p_day_ids uuid[] default null, p_allergies_ack boolean default false, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
  ev public.events;
  staff boolean := app.has_permission('events.manage');
  hh uuid;
  days uuid[];
  d uuid;
  taken int;
  missing text;
  price int;
  inv uuid;
  rid uuid;
  who text;
  has_allergies boolean;
begin
  if tid is null or not app.has_module('programs_plus') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not staff and not (p_person_id = any (app.household_person_ids())) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into ev from public.events where id = p_event_id and tenant_id = tid for update;
  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;
  if ev.status <> 'open' or (ev.registration_opens_at is not null and now() < ev.registration_opens_at)
     or (ev.registration_closes_at is not null and now() > ev.registration_closes_at) then
    raise exception 'registration for this event is closed' using errcode = '22023';
  end if;
  if exists (select 1 from public.event_registrations where event_id = ev.id and person_id = p_person_id and status <> 'cancelled') then
    raise exception 'already registered' using errcode = '22023';
  end if;
  -- Days: camps with days pick some (or all); single-session events use none.
  if exists (select 1 from public.event_days where event_id = ev.id) then
    days := coalesce(p_day_ids, (select array_agg(id) from public.event_days where event_id = ev.id));
    if exists (select 1 from unnest(days) x where x not in (select id from public.event_days where event_id = ev.id)) or coalesce(array_length(days, 1), 0) = 0 then
      raise exception 'choose days of this event' using errcode = '22023';
    end if;
    if ev.capacity is not null then
      foreach d in array days loop
        select count(*) into taken from public.event_registrations r where r.event_id = ev.id and r.status <> 'cancelled' and d = any (r.days);
        if taken >= ev.capacity then
          raise exception 'one of those days is full' using errcode = '22023';
        end if;
      end loop;
    end if;
  elsif ev.capacity is not null then
    select count(*) into taken from public.event_registrations where event_id = ev.id and status <> 'cancelled';
    if taken >= ev.capacity then
      raise exception 'this event is full' using errcode = '22023';
    end if;
  end if;
  -- Required waivers must already be signed for this person.
  select string_agg(t.name, ', ') into missing from public.document_templates t
   where t.id = any (ev.waiver_template_ids) and not exists (select 1 from public.signatures s where s.template_id = t.id and s.person_id = p_person_id);
  if missing is not null then
    raise exception 'sign the required waiver first: %', missing using errcode = '22023';
  end if;
  select coalesce(array_length(p.allergies, 1), 0) > 0, trim(coalesce(p.preferred_name, p.first_name) || ' ' || p.last_name) into has_allergies, who from public.people p where p.id = p_person_id and p.tenant_id = tid;
  if who is null then
    raise exception 'person not found' using errcode = 'P0002';
  end if;
  if has_allergies and not p_allergies_ack then
    raise exception 'please confirm the allergy information' using errcode = '22023';
  end if;
  price := app.event_price(ev.pricing, p_option_label, coalesce(array_length(days, 1), 0));
  if price is null then
    raise exception 'choose a price option' using errcode = '22023';
  end if;
  select hm.household_id into hh from public.household_members hm where hm.person_id = p_person_id
   order by (hm.household_id = any (app.household_ids())) desc limit 1;
  if price > 0 then
    insert into public.invoices (tenant_id, household_id, person_id, number, status, due_at, subtotal_cents, total_cents, source, memo)
    values (tid, hh, p_person_id, app.next_counter(tid, 'invoice'), 'open', least(ev.starts_at::date, app.tenant_today(tid) + 7), price, price, 'event', ev.name)
    returning id into inv;
    insert into public.invoice_lines (tenant_id, invoice_id, kind, description, quantity, unit_cents, total_cents, ref_type, ref_id)
    values (tid, inv, 'event', ev.name || ' — ' || p_option_label || ' — ' || who || case when days is not null then ' (' || array_length(days, 1) || ' day' || case when array_length(days, 1) = 1 then '' else 's' end || ')' else '' end,
            1, price, price, 'event', ev.id);
  end if;
  insert into public.event_registrations (tenant_id, event_id, person_id, household_id, option_label, days, status, invoice_id, allergies_ack, notes, registered_by)
  values (tid, ev.id, p_person_id, hh, p_option_label, days, case when inv is null then 'paid' else 'registered' end, inv, p_allergies_ack, nullif(trim(p_notes), ''), auth.uid())
  on conflict (event_id, person_id) do update set status = excluded.status, days = excluded.days, option_label = excluded.option_label, invoice_id = excluded.invoice_id, allergies_ack = excluded.allergies_ack
  returning id into rid;
  return jsonb_build_object('registration_id', rid, 'invoice_id', inv, 'price_cents', price);
end;
$$;

create or replace function app.event_fee_paid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source = 'event' and new.status = 'paid' and old.status is distinct from 'paid' then
    update public.event_registrations set status = 'paid' where invoice_id = new.id and status = 'registered';
  end if;
  return null;
end;
$$;
create trigger event_fee_paid after update of status on public.invoices for each row execute function app.event_fee_paid();

-- Day check-in / check-out (staff). Only people registered for that day.
create or replace function public.event_check(p_day_id uuid, p_person_id uuid, p_action text, p_pickup_name text default null, p_signature_path text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
  dy public.event_days;
  cid uuid;
begin
  if tid is null or not app.has_module('programs_plus') or not app.has_permission('events.manage') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into dy from public.event_days where id = p_day_id and tenant_id = tid;
  if not found or not exists (select 1 from public.event_registrations r where r.event_id = dy.event_id and r.person_id = p_person_id and r.status in ('registered', 'paid', 'attended') and (r.days is null or dy.id = any (r.days))) then
    raise exception 'not registered for this day' using errcode = '22023';
  end if;
  if p_action = 'in' then
    insert into public.event_checkins (tenant_id, event_day_id, person_id, in_by) values (tid, dy.id, p_person_id, auth.uid())
    on conflict (event_day_id, person_id) do update set in_at = now(), out_at = null, in_by = auth.uid()
    returning id into cid;
    update public.event_registrations set status = 'attended' where event_id = dy.event_id and person_id = p_person_id and status = 'paid';
  elsif p_action = 'out' then
    if length(trim(coalesce(p_pickup_name, ''))) < 2 or p_signature_path is null then
      raise exception 'who picked up, and their signature, are required' using errcode = '22023';
    end if;
    update public.event_checkins set out_at = now(), out_by = auth.uid(), pickup_person_name = trim(p_pickup_name), signature_path = p_signature_path
     where event_day_id = dy.id and person_id = p_person_id and out_at is null
    returning id into cid;
    if cid is null then
      raise exception 'check in first' using errcode = '22023';
    end if;
  else
    raise exception 'unknown action' using errcode = '22023';
  end if;
  return cid;
end;
$$;

-- Party deposit: an invoice to the host household (source 'event'), once.
create or replace function public.create_party_deposit(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
  e public.events;
  inv uuid;
begin
  if tid is null or not app.has_module('programs_plus') or not app.has_permission('events.manage') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into e from public.events where id = p_event_id and tenant_id = tid for update;
  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;
  if e.host_household_id is null or coalesce(e.deposit_cents, 0) <= 0 then
    raise exception 'set the host family and a deposit first' using errcode = '22023';
  end if;
  if e.deposit_invoice_id is not null then
    return e.deposit_invoice_id;
  end if;
  insert into public.invoices (tenant_id, household_id, number, status, due_at, subtotal_cents, total_cents, source, memo)
  values (tid, e.host_household_id, app.next_counter(tid, 'invoice'), 'open', least(e.starts_at::date, app.tenant_today(tid) + 7), e.deposit_cents, e.deposit_cents, 'event', e.name || ' deposit')
  returning id into inv;
  insert into public.invoice_lines (tenant_id, invoice_id, kind, description, quantity, unit_cents, total_cents, ref_type, ref_id)
  values (tid, inv, 'event', e.name || ' — deposit', 1, e.deposit_cents, e.deposit_cents, 'event', e.id);
  update public.events set deposit_invoice_id = inv where id = e.id;
  return inv;
end;
$$;

-- Party guest waivers: a link per party (only its hash is stored; a new link replaces the old one); guests
-- sign without an account.
create or replace function public.party_guest_link(p_event_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  tok text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if app.tenant_id() is null or not app.has_module('programs_plus') or not app.has_permission('events.manage') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.events set guest_link_token_hash = encode(extensions.digest(tok, 'sha256'), 'hex') where id = p_event_id and tenant_id = app.tenant_id();
  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;
  return tok;
end;
$$;

create or replace function public.guest_waiver_info(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('event', e.name, 'starts_at', e.starts_at, 'school', t.name, 'timezone', t.timezone,
           'waiver', (select jsonb_build_object('id', d.id, 'name', d.name, 'body', d.body) from public.document_templates d
                      where d.tenant_id = e.tenant_id and d.kind = 'waiver' and d.active and (d.id = any (e.waiver_template_ids) or cardinality(e.waiver_template_ids) = 0)
                      order by (d.id = any (e.waiver_template_ids)) desc, d.version desc limit 1))
  from public.events e join public.tenants t on t.id = e.tenant_id
  where e.guest_link_token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and e.status in ('open', 'closed') and e.ends_at > now() - interval '1 day';
$$;

create or replace function public.sign_guest_waiver(p_token text, p_guest_name text, p_guardian_name text, p_guardian_phone text, p_typed_signature text, p_ip text, p_guest_dob date default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.events;
  wid uuid;
  tpl uuid;
begin
  select * into e from public.events where guest_link_token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
     and status in ('open', 'closed') and ends_at > now() - interval '1 day';
  if not found then
    raise exception 'this link is no longer valid' using errcode = 'P0002';
  end if;
  if length(trim(coalesce(p_guest_name, ''))) < 2 or length(trim(coalesce(p_guardian_name, ''))) < 2 or length(trim(coalesce(p_typed_signature, ''))) < 2 then
    raise exception 'fill in the guest, the parent or guardian, and the signature' using errcode = '22023';
  end if;
  select d.id into tpl from public.document_templates d where d.tenant_id = e.tenant_id and d.kind = 'waiver' and d.active
   and (d.id = any (e.waiver_template_ids) or cardinality(e.waiver_template_ids) = 0) order by (d.id = any (e.waiver_template_ids)) desc, d.version desc limit 1;
  insert into public.event_guest_waivers (tenant_id, event_id, template_id, guest_name, guest_dob, guardian_name, guardian_phone, typed_signature, ip)
  values (e.tenant_id, e.id, tpl, trim(p_guest_name), p_guest_dob, trim(p_guardian_name), nullif(trim(p_guardian_phone), ''), trim(p_typed_signature), nullif(p_ip, ''))
  returning id into wid;
  return wid;
end;
$$;

revoke execute on function public.register_for_event(uuid, uuid, text, uuid[], boolean, text), public.event_check(uuid, uuid, text, text, text), public.party_guest_link(uuid), public.create_party_deposit(uuid) from public, anon;
grant execute on function public.register_for_event(uuid, uuid, text, uuid[], boolean, text), public.event_check(uuid, uuid, text, text, text), public.party_guest_link(uuid), public.create_party_deposit(uuid) to authenticated;
revoke execute on function public.guest_waiver_info(text), public.sign_guest_waiver(text, text, text, text, text, text, date) from public;
grant execute on function public.guest_waiver_info(text), public.sign_guest_waiver(text, text, text, text, text, text, date) to anon, authenticated;

-- Check-out signatures: "<tenant>/events/…" written by event staff.
create policy tenant_media_events_write on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-media' and (storage.foldername(name))[1] = (select app.tenant_id())::text
              and (storage.foldername(name))[2] = 'events' and (select app.has_permission('events.manage')));
create policy tenant_media_events_read on storage.objects for select to authenticated
  using (bucket_id = 'tenant-media' and (storage.foldername(name))[1] = (select app.tenant_id())::text
         and (storage.foldername(name))[2] = 'events' and (select app.has_permission('events.manage')));

select app.index_foreign_keys();
