-- 0041 CRM pipeline & trials (§4.9, F3.4–F3.6, F11.1). Leads point at people (status 'lead'); the public
-- trial form (anon) creates or merges a lead by email/phone and can book a real bookable class. Attending
-- a class moves an open lead to trial_attended; enrolling moves it to won.

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  key text,
  name text not null check (length(trim(name)) > 0),
  position int not null default 0,
  kind text not null default 'open' check (kind in ('open', 'won', 'lost')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key)
);
select app.setup_tenant_table('public.pipeline_stages', 'crm.manage', 'crm.manage', 'grow');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  person_id uuid not null,
  stage_id uuid not null,
  owner_user_id uuid references auth.users (id) on delete set null,
  value_cents int,
  program_interest uuid[] not null default '{}',
  score int,
  next_action text,
  next_action_at timestamptz,
  lost_reason text,
  converted_household_id uuid,
  ai_run_id uuid,
  source text,
  utm jsonb not null default '{}'::jsonb,
  trial_booking_id uuid,
  message text,
  stage_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade,
  foreign key (tenant_id, stage_id) references public.pipeline_stages (tenant_id, id),
  foreign key (tenant_id, converted_household_id) references public.households (tenant_id, id) on delete set null (converted_household_id),
  foreign key (tenant_id, trial_booking_id) references public.bookings (tenant_id, id) on delete set null (trial_booking_id)
);
select app.setup_tenant_table('public.leads', 'crm.manage', 'crm.manage', 'grow');
create unique index leads_one_open_per_person on public.leads (person_id) where converted_household_id is null and lost_reason is null;

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  lead_id uuid not null,
  kind text not null check (kind in ('note', 'call', 'email', 'sms', 'trial_booked', 'trial_attended', 'stage_change', 'task', 'form')),
  body text,
  by_user_id uuid references auth.users (id) on delete set null,
  at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, lead_id) references public.leads (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.lead_activities', 'crm.manage', 'crm.manage', 'grow');

alter table public.tasks add foreign key (tenant_id, lead_id) references public.leads (tenant_id, id) on delete cascade;

-- Default pipeline for every tenant (existing and new).
create or replace function app.ensure_pipeline(p_tenant uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.pipeline_stages (tenant_id, key, name, position, kind)
  select p_tenant, k, n, p, kd from (values
    ('new', 'New', 10, 'open'), ('contacted', 'Contacted', 20, 'open'), ('trial_scheduled', 'Trial scheduled', 30, 'open'),
    ('trial_attended', 'Trial attended', 40, 'open'), ('offer', 'Offer', 50, 'open'), ('won', 'Won', 60, 'won'), ('lost', 'Lost', 70, 'lost')
  ) as s(k, n, p, kd)
  on conflict (tenant_id, key) do nothing;
$$;
select app.ensure_pipeline(id) from public.tenants;
create or replace function app.tenant_pipeline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.ensure_pipeline(new.id);
  return null;
end;
$$;
create trigger tenant_pipeline after insert on public.tenants for each row execute function app.tenant_pipeline();

create or replace function app.stage_id(p_tenant uuid, p_key text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.pipeline_stages where tenant_id = p_tenant and key = p_key;
$$;

-- Move a lead (activity logged). Used by triggers and the RPCs below.
create or replace function app.move_lead(p_lead uuid, p_stage_key text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.leads;
  sid uuid;
begin
  select * into l from public.leads where id = p_lead;
  sid := app.stage_id(l.tenant_id, p_stage_key);
  if sid is null or sid = l.stage_id then
    return;
  end if;
  update public.leads set stage_id = sid, stage_changed_at = now() where id = l.id;
  insert into public.lead_activities (tenant_id, lead_id, kind, body, by_user_id)
  values (l.tenant_id, l.id, 'stage_change', p_note, auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Public (anon): upcoming trial classes and the trial request form.
-- ---------------------------------------------------------------------------------------------
create or replace function app.tenant_for_public(p_slug text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.id from public.tenants t
  where t.slug = p_slug and t.status in ('active', 'trial')
    and exists (select 1 from public.tenant_entitlements e where e.tenant_id = t.id and e.module_key = 'grow'
                and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now()));
$$;

create or replace function public.public_trial_info(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_for_public(p_slug);
begin
  if tid is null then
    return null;
  end if;
  return jsonb_build_object(
    'school', (select jsonb_build_object('name', name, 'timezone', timezone) from public.tenants where id = tid),
    'programs', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by sort, name) from public.programs where tenant_id = tid and active and not invite_only), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'starts_at', s.starts_at, 'program_ids', s.program_ids,
               'spots_left', case when s.capacity is null then null else greatest(s.capacity - (select count(*) from public.bookings b where b.session_id = s.id and b.status in ('booked', 'attended')), 0) end)
             order by s.starts_at)
      from public.class_sessions s
      where s.tenant_id = tid and s.bookable and s.status = 'scheduled' and s.starts_at > now() + interval '2 hours' and s.starts_at < now() + interval '14 days'), '[]'::jsonb));
end;
$$;

-- p = { first_name, last_name, email, phone, program_id, session_id, message, source, utm{}, website (honeypot) }
create or replace function public.submit_trial_request(p_slug text, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_for_public(p_slug);
  em text := lower(nullif(trim(p ->> 'email'), ''));
  ph text := nullif(regexp_replace(coalesce(p ->> 'phone', ''), '[^0-9]', '', 'g'), '');
  pid uuid;
  lid uuid;
  merged boolean := false;
  s public.class_sessions;
  bid uuid;
  prog uuid := nullif(p ->> 'program_id', '')::uuid;
  recent int;
begin
  if tid is null then
    raise exception 'unknown school' using errcode = 'P0002';
  end if;
  if coalesce(p ->> 'website', '') <> '' then
    return jsonb_build_object('ok', true); -- honeypot: bots get a quiet success
  end if;
  if length(trim(coalesce(p ->> 'first_name', ''))) < 1 or (em is null and ph is null) then
    raise exception 'give a name and an email or phone number' using errcode = '22023';
  end if;
  if em is not null and em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'that email address doesn''t look right' using errcode = '22023';
  end if;
  -- Duplicate detection: same email or phone (digits) → the same person.
  select id into pid from public.people
   where tenant_id = tid and archived_at is null
     and ((em is not null and lower(email::text) = em) or (ph is not null and regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = ph))
   order by created_at limit 1;
  if pid is null then
    insert into public.people (tenant_id, first_name, last_name, email, phone, type_flags, status, source, utm, email_consent, phone_sms_consent)
    values (tid, trim(p ->> 'first_name'), coalesce(trim(p ->> 'last_name'), ''), em, nullif(trim(p ->> 'phone'), ''), '{lead}', 'lead',
            coalesce(nullif(p ->> 'source', ''), 'website'), coalesce(p -> 'utm', '{}'::jsonb), em is not null, false)
    returning id into pid;
  end if;
  select id into lid from public.leads where person_id = pid and converted_household_id is null and lost_reason is null;
  if lid is null then
    insert into public.leads (tenant_id, person_id, stage_id, program_interest, source, utm, message)
    values (tid, pid, app.stage_id(tid, 'new'), case when prog is null then '{}' else array[prog] end,
            coalesce(nullif(p ->> 'source', ''), 'website'), coalesce(p -> 'utm', '{}'::jsonb), nullif(trim(p ->> 'message'), ''))
    returning id into lid;
    insert into public.lead_activities (tenant_id, lead_id, kind, body) values (tid, lid, 'form', coalesce(nullif(trim(p ->> 'message'), ''), 'Trial request from the website'));
  else
    select count(*) into recent from public.lead_activities where lead_id = lid and kind = 'form' and at > now() - interval '1 hour';
    if recent >= 5 then
      return jsonb_build_object('ok', true);
    end if;
    merged := true;
    update public.leads set program_interest = case when prog is null or prog = any (program_interest) then program_interest else program_interest || prog end,
           message = coalesce(nullif(trim(p ->> 'message'), ''), message)
     where id = lid;
    insert into public.lead_activities (tenant_id, lead_id, kind, body) values (tid, lid, 'form', 'Submitted the trial form again' || coalesce(': ' || nullif(trim(p ->> 'message'), ''), ''));
  end if;

  if nullif(p ->> 'session_id', '') is not null then
    select * into s from public.class_sessions where id = (p ->> 'session_id')::uuid and tenant_id = tid and bookable and status = 'scheduled' and starts_at > now() for update;
    if found and (s.capacity is null or (select count(*) from public.bookings b where b.session_id = s.id and b.status in ('booked', 'attended')) < s.capacity) then
      insert into public.bookings (tenant_id, session_id, person_id, status, source)
      values (tid, s.id, pid, 'booked', 'widget')
      on conflict (session_id, person_id) do update set status = 'booked', cancelled_at = null
      returning id into bid;
      update public.leads set trial_booking_id = bid where id = lid;
      insert into public.lead_activities (tenant_id, lead_id, kind, body) values (tid, lid, 'trial_booked', 'Booked ' || s.name || ' on ' || to_char(s.starts_at at time zone (select timezone from public.tenants where id = tid), 'Dy Mon DD HH12:MI AM'));
      perform app.move_lead(lid, 'trial_scheduled', 'Trial booked from the website');
    end if;
  end if;
  return jsonb_build_object('ok', true, 'booked', bid is not null, 'merged', merged);
end;
$$;
revoke execute on function public.public_trial_info(text), public.submit_trial_request(text, jsonb) from public;
grant execute on function public.public_trial_info(text), public.submit_trial_request(text, jsonb) to anon, authenticated;

-- Staff: book a trial class for a lead (moves it to trial_scheduled).
create or replace function public.book_lead_trial(p_lead_id uuid, p_session_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
  l public.leads;
  s public.class_sessions;
  bid uuid;
begin
  if tid is null or not app.has_module('grow') or not app.has_permission('crm.manage') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into l from public.leads where id = p_lead_id and tenant_id = tid;
  select * into s from public.class_sessions where id = p_session_id and tenant_id = tid for update;
  if l.id is null or s.id is null then
    raise exception 'lead or class not found' using errcode = 'P0002';
  end if;
  if s.status <> 'scheduled' or s.starts_at <= now() then
    raise exception 'that class can no longer be booked' using errcode = '22023';
  end if;
  insert into public.bookings (tenant_id, session_id, person_id, status, booked_by_user_id, source)
  values (tid, s.id, l.person_id, 'booked', auth.uid(), 'trial')
  on conflict (session_id, person_id) do update set status = 'booked', cancelled_at = null
  returning id into bid;
  update public.leads set trial_booking_id = bid where id = l.id;
  insert into public.lead_activities (tenant_id, lead_id, kind, body, by_user_id)
  values (tid, l.id, 'trial_booked', 'Booked ' || s.name || ' on ' || to_char(s.starts_at at time zone (select timezone from public.tenants where id = tid), 'Dy Mon DD HH12:MI AM'), auth.uid());
  perform app.move_lead(l.id, 'trial_scheduled', 'Trial booked');
  return bid;
end;
$$;
revoke execute on function public.book_lead_trial(uuid, uuid) from public, anon;
grant execute on function public.book_lead_trial(uuid, uuid) to authenticated;

-- Attending any class moves an open lead (new/contacted/trial_scheduled) to trial_attended.
create or replace function app.lead_attended()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  l record;
begin
  for l in select ld.id from public.leads ld join public.pipeline_stages st on st.id = ld.stage_id
            where ld.person_id = new.person_id and st.key in ('new', 'contacted', 'trial_scheduled') and ld.lost_reason is null and ld.converted_household_id is null loop
    insert into public.lead_activities (tenant_id, lead_id, kind, body) values (new.tenant_id, l.id, 'trial_attended', 'Attended a class');
    perform app.move_lead(l.id, 'trial_attended', 'Attended a trial class');
  end loop;
  return null;
end;
$$;
create trigger lead_attended after insert on public.attendance for each row execute function app.lead_attended();

-- Enrolling in a (non-trial) membership wins the lead.
create or replace function app.lead_won()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  l record;
begin
  if new.status not in ('active', 'past_due') then
    return null;
  end if;
  for l in select id from public.leads where person_id = new.person_id and converted_household_id is null and lost_reason is null loop
    update public.leads set converted_household_id = new.household_id where id = l.id;
    perform app.move_lead(l.id, 'won', 'Enrolled');
  end loop;
  return null;
end;
$$;
create trigger lead_won after insert on public.memberships for each row execute function app.lead_won();

select app.index_foreign_keys();
