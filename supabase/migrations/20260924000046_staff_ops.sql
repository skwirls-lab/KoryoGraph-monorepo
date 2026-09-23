-- 0046 Staff operations (§4.10–4.11, F13.1–13.3). Staff profiles (title, programs taught, pay rates),
-- certifications with expiry, kiosk clock-in/out with a per-staff PIN (5 wrong tries lock it for 15 min),
-- shifts, commissions written by triggers when a seller completes a POS sale or a membership is sold, and
-- views for sessions taught and payroll per school-local month. Staff see their own rows; staff.manage
-- sees and manages everyone's.

create table public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  person_id uuid,
  title text,
  programs uuid[] not null default '{}',
  pay_rates jsonb not null default '{}'::jsonb,
  hire_date date,
  bio text,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id),
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete set null (person_id)
);
select app.setup_tenant_table('public.staff_profiles', 'staff.manage', 'staff.manage');
create policy staff_profiles_own_select on public.staff_profiles for select to authenticated
  using (tenant_id = (select app.tenant_id()) and user_id = (select auth.uid()));

-- staff_certifications exists since 0023 (read: people.read, write: staff.manage); give it a name and kinds.
alter table public.staff_certifications add column name text;
-- Earlier rows stored a free-text kind: keep it as the name and map it onto a kind.
update public.staff_certifications set name = coalesce(name, kind), kind = case
    when kind ilike '%cpr%' then 'cpr' when kind ilike '%first aid%' then 'first_aid'
    when kind ilike '%background%' then 'background_check' when kind ilike '%safesport%' then 'safesport'
    when kind ilike '%dan%' or kind ilike '%rank%' or kind ilike '%instructor%' then 'instructor_rank' else 'other' end
  where kind not in ('instructor_rank', 'cpr', 'first_aid', 'background_check', 'safesport', 'other');
alter table public.staff_certifications add constraint staff_certifications_kind check (kind in ('instructor_rank', 'cpr', 'first_aid', 'background_check', 'safesport', 'other'));
alter table public.staff_certifications add constraint staff_certifications_dates check (expires_at is null or issued_at is null or expires_at >= issued_at);
create policy staff_certifications_own_select on public.staff_certifications for select to authenticated
  using (tenant_id = (select app.tenant_id()) and user_id = (select auth.uid()));

create table public.staff_pins (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  pin_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
-- No direct writes; set/verify only through the definer RPCs below (staff.manage may read metadata).
select app.setup_tenant_table('public.staff_pins', null, 'staff.manage');
-- The hash itself is never readable through the API.
revoke select on public.staff_pins from anon, authenticated;
grant select (id, tenant_id, user_id, failed_attempts, locked_until, created_at, updated_at) on public.staff_pins to authenticated;

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  location_id uuid,
  clock_in timestamptz not null,
  clock_out timestamptz,
  source text not null default 'desk' check (source in ('kiosk', 'desk')),
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (clock_out is null or clock_out > clock_in),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id) on delete set null (location_id)
);
create unique index time_entries_one_open on public.time_entries (tenant_id, user_id) where clock_out is null;
select app.setup_tenant_table('public.time_entries', 'staff.manage', 'staff.manage');
create policy time_entries_own_select on public.time_entries for select to authenticated
  using (tenant_id = (select app.tenant_id()) and user_id = (select auth.uid()));

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  location_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  role_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id) on delete set null (location_id)
);
select app.setup_tenant_table('public.shifts', 'staff.manage', 'staff.manage');
create policy shifts_own_select on public.shifts for select to authenticated
  using (tenant_id = (select app.tenant_id()) and user_id = (select auth.uid()));

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  ref_type text not null check (ref_type in ('membership', 'pos_sale')),
  ref_id uuid not null,
  base_cents int not null,
  rate_pct numeric(5, 2) not null,
  amount_cents int not null,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ref_type, ref_id)
);
select app.setup_tenant_table('public.commissions', 'staff.manage', 'staff.manage');
create policy commissions_own_select on public.commissions for select to authenticated
  using (tenant_id = (select app.tenant_id()) and user_id = (select auth.uid()));

-- Who sold a membership (the signed-in staff member; null for jobs/imports).
alter table public.memberships add column sold_by uuid references auth.users (id) on delete set null default auth.uid();

create or replace function app.commission_pct(p_tenant uuid, p_user uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(pay_rates ->> 'commission_pct', '')::numeric, 0) from public.staff_profiles where tenant_id = p_tenant and user_id = p_user;
$$;

create or replace function app.local_period(p_tenant uuid, p_at timestamptz)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select to_char(p_at at time zone (select timezone from public.tenants where id = p_tenant), 'YYYY-MM');
$$;

-- POS: a completed sale earns its cashier's commission on the pre-tax amount; a completed return reverses
-- the same share for the original sale's cashier.
create or replace function app.pos_commission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  seller uuid;
  pct numeric;
  base int;
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return null;
  end if;
  if new.kind = 'sale' then
    seller := new.cashier_user_id;
    base := new.subtotal_cents - new.discount_cents;
  else
    select cashier_user_id into seller from public.pos_sales where id = new.original_sale_id;
    base := -(abs(new.subtotal_cents) - abs(new.discount_cents));
  end if;
  if seller is null then
    return null;
  end if;
  pct := app.commission_pct(new.tenant_id, seller);
  if coalesce(pct, 0) <= 0 or base = 0 then
    return null;
  end if;
  insert into public.commissions (tenant_id, user_id, ref_type, ref_id, base_cents, rate_pct, amount_cents, period)
  values (new.tenant_id, seller, 'pos_sale', new.id, base, pct, round(base * pct / 100)::int, app.local_period(new.tenant_id, now()))
  on conflict (ref_type, ref_id) do nothing;
  return null;
end;
$$;
create trigger pos_commission after update of status on public.pos_sales for each row execute function app.pos_commission();

-- Memberships: the seller earns their rate on one period's price when the membership is created.
create or replace function app.membership_commission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pct numeric;
  base int;
begin
  if new.sold_by is null then
    return null;
  end if;
  pct := app.commission_pct(new.tenant_id, new.sold_by);
  if coalesce(pct, 0) <= 0 then
    return null;
  end if;
  select coalesce(new.price_override_cents, p.price_cents) into base from public.membership_plans p where p.id = new.plan_id;
  if coalesce(base, 0) <= 0 then
    return null;
  end if;
  insert into public.commissions (tenant_id, user_id, ref_type, ref_id, base_cents, rate_pct, amount_cents, period)
  values (new.tenant_id, new.sold_by, 'membership', new.id, base, pct, round(base * pct / 100)::int, app.local_period(new.tenant_id, new.created_at))
  on conflict (ref_type, ref_id) do nothing;
  return null;
end;
$$;
create trigger membership_commission after insert on public.memberships for each row execute function app.membership_commission();

-- Sessions taught: a substitute teaches instead of the scheduled instructors. Past, not cancelled.
create view public.v_instructor_sessions with (security_invoker = true) as
  select s.tenant_id, u.user_id, app.local_period(s.tenant_id, s.starts_at) as period,
         count(*)::int as sessions,
         round(sum(extract(epoch from (s.ends_at - s.starts_at)) / 3600)::numeric, 2) as hours
  from public.class_sessions s
  cross join lateral unnest(case when cardinality(s.substitute_ids) > 0 then s.substitute_ids else s.instructor_ids end) as u(user_id)
  where s.status <> 'cancelled' and s.starts_at <= now()
  group by s.tenant_id, u.user_id, app.local_period(s.tenant_id, s.starts_at);

-- Payroll per staff member per month: clocked hours × hourly rate + sessions × per-class rate + commissions.
create view public.v_payroll with (security_invoker = true) as
  with periods as (
    select tenant_id, user_id, period from public.v_instructor_sessions
    union select tenant_id, user_id, app.local_period(tenant_id, clock_in) from public.time_entries where clock_out is not null
    union select tenant_id, user_id, period from public.commissions
  ),
  hrs as (
    select tenant_id, user_id, app.local_period(tenant_id, clock_in) as period,
           round(sum(extract(epoch from (clock_out - clock_in)) / 3600)::numeric, 2) as hours
    from public.time_entries where clock_out is not null group by 1, 2, 3
  ),
  com as (select tenant_id, user_id, period, sum(amount_cents)::int as cents from public.commissions group by 1, 2, 3)
  select p.tenant_id, p.user_id, p.period,
         coalesce(pr.full_name, pr.email::text, 'Staff') as staff_name,
         coalesce(h.hours, 0) as hours,
         coalesce(nullif(sp.pay_rates ->> 'hourly_cents', '')::int, 0) as hourly_cents,
         round(coalesce(h.hours, 0) * coalesce(nullif(sp.pay_rates ->> 'hourly_cents', '')::int, 0))::int as hourly_pay_cents,
         coalesce(vs.sessions, 0) as sessions,
         coalesce(nullif(sp.pay_rates ->> 'per_class_cents', '')::int, 0) as per_class_cents,
         coalesce(vs.sessions, 0) * coalesce(nullif(sp.pay_rates ->> 'per_class_cents', '')::int, 0) as class_pay_cents,
         coalesce(c.cents, 0) as commission_cents,
         round(coalesce(h.hours, 0) * coalesce(nullif(sp.pay_rates ->> 'hourly_cents', '')::int, 0))::int
           + coalesce(vs.sessions, 0) * coalesce(nullif(sp.pay_rates ->> 'per_class_cents', '')::int, 0)
           + coalesce(c.cents, 0) as total_cents
  from periods p
  join public.tenant_users tu on tu.tenant_id = p.tenant_id and tu.user_id = p.user_id
  left join public.profiles pr on pr.id = p.user_id
  left join public.staff_profiles sp on sp.tenant_id = p.tenant_id and sp.user_id = p.user_id
  left join hrs h on h.tenant_id = p.tenant_id and h.user_id = p.user_id and h.period = p.period
  left join com c on c.tenant_id = p.tenant_id and c.user_id = p.user_id and c.period = p.period
  left join public.v_instructor_sessions vs on vs.tenant_id = p.tenant_id and vs.user_id = p.user_id and vs.period = p.period;

-- Certifications that are expired or expire within 30 days (school-local today).
create view public.v_staff_compliance with (security_invoker = true) as
  select c.tenant_id, c.id, c.user_id, coalesce(pr.full_name, pr.email::text, 'Staff') as staff_name, c.kind, c.name, c.expires_at,
         (c.expires_at - app.tenant_today(c.tenant_id)) as days_left,
         case when c.expires_at < app.tenant_today(c.tenant_id) then 'expired' else 'expiring' end as state
  from public.staff_certifications c
  join public.tenant_users tu on tu.tenant_id = c.tenant_id and tu.user_id = c.user_id and tu.status = 'active'
  left join public.profiles pr on pr.id = c.user_id
  where c.expires_at is not null and c.expires_at <= app.tenant_today(c.tenant_id) + 30;

-- Set a staff member's kiosk PIN (4 digits, like family PINs): yourself, or anyone with staff.manage.
create or replace function public.set_staff_pin(p_user_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
begin
  if tid is null or not (p_user_id = auth.uid() or app.has_permission('staff.manage'))
     or not exists (select 1 from public.tenant_users where tenant_id = tid and user_id = p_user_id and status = 'active') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4}$' then
    raise exception 'the PIN must be 4 digits' using errcode = '22023';
  end if;
  insert into public.staff_pins (tenant_id, user_id, pin_hash) values (tid, p_user_id, extensions.crypt(p_pin, extensions.gen_salt('bf')))
  on conflict (tenant_id, user_id) do update set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null;
  insert into public.audit_events (tenant_id, actor_user_id, entity_type, entity_id, action, note)
  values (tid, auth.uid(), 'staff_pins', p_user_id, 'custom', 'kiosk PIN set');
end;
$$;

-- Kiosk: staff with a PIN at the device's tenant (name with the last name as an initial), and whether they're clocked in.
create or replace function public.kiosk_staff(p_token text)
returns table (user_id uuid, display_name text, clocked_in_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.kiosk_devices := app.kiosk_device(p_token);
begin
  return query
    select sp.user_id,
           coalesce(regexp_replace(trim(pr.full_name), '\s+(\S)\S*$', ' \1.'), 'Staff'),
           (select te.clock_in from public.time_entries te where te.tenant_id = d.tenant_id and te.user_id = sp.user_id and te.clock_out is null)
    from public.staff_pins sp
    join public.tenant_users tu on tu.tenant_id = sp.tenant_id and tu.user_id = sp.user_id and tu.status = 'active'
    left join public.profiles pr on pr.id = sp.user_id
    where sp.tenant_id = d.tenant_id
    order by 2;
end;
$$;

-- Kiosk: clock in or out with the staff PIN. 5 wrong PINs lock that staff member for 15 minutes.
create or replace function public.kiosk_staff_clock(p_token text, p_user_id uuid, p_pin text)
returns table (ok boolean, action text, at timestamptz, attempts_left int, locked_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.kiosk_devices := app.kiosk_device(p_token);
  sp public.staff_pins;
  open_entry uuid;
begin
  select * into sp from public.staff_pins where tenant_id = d.tenant_id and user_id = p_user_id for update;
  if not found or not exists (select 1 from public.tenant_users where tenant_id = d.tenant_id and user_id = p_user_id and status = 'active') then
    raise exception 'no PIN set' using errcode = 'P0002';
  end if;
  if sp.locked_until is not null and sp.locked_until > now() then
    return query select false, null::text, null::timestamptz, 0, sp.locked_until;
    return;
  end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4}$' or sp.pin_hash <> extensions.crypt(p_pin, sp.pin_hash) then
    if sp.failed_attempts + 1 >= 5 then
      update public.staff_pins set failed_attempts = 0, locked_until = now() + interval '15 minutes' where id = sp.id;
      return query select false, null::text, null::timestamptz, 0, now() + interval '15 minutes';
    else
      update public.staff_pins set failed_attempts = failed_attempts + 1, locked_until = null where id = sp.id;
      return query select false, null::text, null::timestamptz, 5 - (sp.failed_attempts + 1), null::timestamptz;
    end if;
    return;
  end if;
  update public.staff_pins set failed_attempts = 0, locked_until = null where id = sp.id;
  select id into open_entry from public.time_entries where tenant_id = d.tenant_id and user_id = p_user_id and clock_out is null for update;
  if open_entry is null then
    insert into public.time_entries (tenant_id, user_id, location_id, clock_in, source) values (d.tenant_id, p_user_id, d.location_id, now(), 'kiosk');
    return query select true, 'in'::text, now(), 5, null::timestamptz;
  else
    update public.time_entries set clock_out = greatest(now(), clock_in + interval '1 second') where id = open_entry;
    return query select true, 'out'::text, now(), 5, null::timestamptz;
  end if;
end;
$$;

revoke execute on function public.set_staff_pin(uuid, text) from public, anon;
grant execute on function public.set_staff_pin(uuid, text) to authenticated;
revoke execute on function public.kiosk_staff(text), public.kiosk_staff_clock(text, uuid, text) from public;
grant execute on function public.kiosk_staff(text), public.kiosk_staff_clock(text, uuid, text) to anon, authenticated;
revoke execute on function app.commission_pct(uuid, uuid), app.local_period(uuid, timestamptz) from public, anon;
grant execute on function app.local_period(uuid, timestamptz) to authenticated;

-- Tasks: anyone on the Desk (people.read) can work the queue; assignees can complete their own.
create policy tasks_assignee_update on public.tasks for update to authenticated
  using (tenant_id = (select app.tenant_id()) and assignee_user_id = (select auth.uid()))
  with check (tenant_id = (select app.tenant_id()) and assignee_user_id = (select auth.uid()));

select app.index_foreign_keys();
