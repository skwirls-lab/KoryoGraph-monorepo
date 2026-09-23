-- 0045 After-school (§4.8, F9.3). Programs carry the schools and pickup routes they serve, the weekdays they
-- run and a pickup cutoff; each program has a weekly recurring membership plan so the normal billing run
-- invoices families every week. Enrollments say which school, route and weekdays a child comes. Daily
-- attendance records school pickup, arrival, release (to whom, with a signature) or absence; an expected
-- child marked absent — by staff, or automatically when not picked up by the cutoff — queues an alert to
-- their guardians through the Outbox.

create table public.afterschool_programs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  location_id uuid,
  name text not null check (length(trim(name)) > 0),
  weekly_price_cents int not null default 0 check (weekly_price_cents >= 0),
  schools text[] not null default '{}',
  routes text[] not null default '{}',
  days_of_week int[] not null default '{1,2,3,4,5}' check (days_of_week <@ '{1,2,3,4,5,6,7}'::int[]),
  pickup_cutoff time not null default '15:45',
  plan_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id) on delete set null (location_id),
  foreign key (tenant_id, plan_id) references public.membership_plans (tenant_id, id) on delete set null (plan_id)
);
select app.setup_tenant_table('public.afterschool_programs', 'events.manage', null, 'programs_plus');

create table public.afterschool_enrollments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  program_id uuid not null,
  person_id uuid not null,
  household_id uuid,
  school text not null check (length(trim(school)) > 0),
  pickup_route text,
  days_of_week int[] not null check (cardinality(days_of_week) > 0 and days_of_week <@ '{1,2,3,4,5,6,7}'::int[]),
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  starts_on date not null,
  ends_on date,
  membership_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on),
  foreign key (tenant_id, program_id) references public.afterschool_programs (tenant_id, id) on delete cascade,
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade,
  foreign key (tenant_id, household_id) references public.households (tenant_id, id) on delete set null (household_id),
  foreign key (tenant_id, membership_id) references public.memberships (tenant_id, id) on delete set null (membership_id)
);
create unique index afterschool_enrollments_one_open on public.afterschool_enrollments (program_id, person_id) where status <> 'ended';
select app.setup_tenant_table('public.afterschool_enrollments', 'events.manage', 'events.manage', 'programs_plus');
create policy afterschool_enrollments_household_select on public.afterschool_enrollments for select to authenticated
  using (tenant_id = (select app.tenant_id()) and person_id = any ((select app.household_person_ids())::uuid[]));

create table public.afterschool_attendance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  enrollment_id uuid not null,
  date date not null,
  picked_up_at timestamptz,
  arrived_at timestamptz,
  released_at timestamptz,
  released_to text,
  signature_path text,
  absent boolean not null default false,
  absence_reason text,
  alerted_at timestamptz,
  marked_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrollment_id, date),
  foreign key (tenant_id, enrollment_id) references public.afterschool_enrollments (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.afterschool_attendance', 'events.manage', 'events.manage', 'programs_plus');
create policy afterschool_attendance_household_select on public.afterschool_attendance for select to authenticated
  using (tenant_id = (select app.tenant_id()) and enrollment_id in (select id from public.afterschool_enrollments));

-- Create or update a program and its weekly billing plan (when the school has Billing and a price is set).
create or replace function public.save_afterschool_program(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
  pid uuid := nullif(p ->> 'id', '')::uuid;
  price int := coalesce((p ->> 'weekly_price_cents')::int, 0);
  plan uuid;
begin
  if tid is null or not app.has_module('programs_plus') or not app.has_permission('events.manage') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if pid is null then
    insert into public.afterschool_programs (tenant_id, location_id, name, weekly_price_cents, schools, routes, days_of_week, pickup_cutoff)
    values (tid, (select id from public.locations where tenant_id = tid and is_default limit 1), trim(p ->> 'name'), price,
            array(select jsonb_array_elements_text(p -> 'schools')), array(select jsonb_array_elements_text(p -> 'routes')),
            array(select jsonb_array_elements_text(p -> 'days_of_week')::int), (p ->> 'pickup_cutoff')::time)
    returning id into pid;
  else
    update public.afterschool_programs set name = trim(p ->> 'name'), weekly_price_cents = price,
      schools = array(select jsonb_array_elements_text(p -> 'schools')), routes = array(select jsonb_array_elements_text(p -> 'routes')),
      days_of_week = array(select jsonb_array_elements_text(p -> 'days_of_week')::int), pickup_cutoff = (p ->> 'pickup_cutoff')::time,
      active = coalesce((p ->> 'active')::boolean, active)
    where id = pid and tenant_id = tid;
    if not found then
      raise exception 'program not found' using errcode = 'P0002';
    end if;
  end if;
  select plan_id into plan from public.afterschool_programs where id = pid;
  if app.has_module('billing') then
    if plan is null and price > 0 then
      insert into public.membership_plans (tenant_id, name, description, kind, interval, interval_count, price_cents, public, tax_class)
      values (tid, 'After-school: ' || trim(p ->> 'name'), 'Weekly after-school tuition', 'recurring', 'week', 1, price, false, 'exempt')
      returning id into plan;
      update public.afterschool_programs set plan_id = plan where id = pid;
    elsif plan is not null then
      update public.membership_plans set price_cents = price, name = 'After-school: ' || trim(p ->> 'name') where id = plan;
    end if;
  end if;
  return pid;
end;
$$;

-- Enroll a child: school, route, weekdays; a weekly membership on the program's plan bills the family.
create or replace function public.afterschool_enroll(p_program_id uuid, p_person_id uuid, p_school text, p_route text, p_days int[], p_starts_on date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
  prog public.afterschool_programs;
  hh uuid;
  mid uuid;
  eid uuid;
begin
  if tid is null or not app.has_module('programs_plus') or not app.has_permission('events.manage') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into prog from public.afterschool_programs where id = p_program_id and tenant_id = tid and active;
  if not found then
    raise exception 'program not found' using errcode = 'P0002';
  end if;
  if not (p_school = any (prog.schools)) then
    raise exception 'choose one of the program''s schools' using errcode = '22023';
  end if;
  if p_route is not null and cardinality(prog.routes) > 0 and not (p_route = any (prog.routes)) then
    raise exception 'choose one of the program''s routes' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_days), 0) = 0 or not (p_days <@ prog.days_of_week) then
    raise exception 'choose days the program runs' using errcode = '22023';
  end if;
  if exists (select 1 from public.afterschool_enrollments where program_id = prog.id and person_id = p_person_id and status <> 'ended') then
    raise exception 'already enrolled in this program' using errcode = '22023';
  end if;
  select household_id into hh from public.household_members where person_id = p_person_id and tenant_id = tid order by relationship = 'student' desc limit 1;
  if hh is null then
    raise exception 'add the child to a household first' using errcode = '22023';
  end if;
  if prog.plan_id is not null and app.has_module('billing') then
    if not app.has_permission('billing.charge') then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    insert into public.memberships (tenant_id, household_id, person_id, plan_id, status, starts_at, next_bill_at, notes)
    values (tid, hh, p_person_id, prog.plan_id, 'active', p_starts_on, p_starts_on, 'After-school: ' || prog.name)
    returning id into mid;
  end if;
  insert into public.afterschool_enrollments (tenant_id, program_id, person_id, household_id, school, pickup_route, days_of_week, starts_on, membership_id)
  values (tid, prog.id, p_person_id, hh, p_school, nullif(trim(p_route), ''), (select array_agg(distinct d order by d) from unnest(p_days) d), p_starts_on, mid)
  returning id into eid;
  return eid;
end;
$$;

-- End an enrollment; its weekly membership stops billing after the end date.
create or replace function public.afterschool_end(p_enrollment_id uuid, p_ends_on date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.afterschool_enrollments;
begin
  if app.tenant_id() is null or not app.has_module('programs_plus') or not app.has_permission('events.manage') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.afterschool_enrollments set status = 'ended', ends_on = greatest(p_ends_on, starts_on)
   where id = p_enrollment_id and tenant_id = app.tenant_id() and status <> 'ended' returning * into e;
  if not found then
    raise exception 'enrollment not found' using errcode = 'P0002';
  end if;
  if e.membership_id is not null then
    update public.memberships set cancel_at = e.ends_on, cancel_reason = 'After-school enrollment ended'
     where id = e.membership_id and status not in ('cancelled', 'expired');
  end if;
end;
$$;

-- Queue the absence alert for an attendance row to the child's guardians (once).
create or replace function app.afterschool_alert(p_attendance_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  n int := 0;
  r record;
begin
  select at.id, at.tenant_id, at.date, at.absence_reason, at.alerted_at, e.person_id, e.school, pr.name as program_name,
         coalesce(pe.preferred_name, pe.first_name) as student_name
    into a
    from public.afterschool_attendance at
    join public.afterschool_enrollments e on e.id = at.enrollment_id
    join public.afterschool_programs pr on pr.id = e.program_id
    join public.people pe on pe.id = e.person_id
   where at.id = p_attendance_id
   for update of at;
  if a.id is null or a.alerted_at is not null then
    return 0;
  end if;
  for r in select * from app.recipients_for(a.tenant_id, array[a.person_id]) loop
    insert into public.communications (tenant_id, channel, person_id, household_id, to_address, template_key, status, data, related_type, related_id)
    select a.tenant_id, c.channel, r.recipient_person_id, r.household_id, c.addr, 'afterschool_absent', 'queued',
           jsonb_build_object('first_name', r.first_name, 'student_name', a.student_name, 'program_name', a.program_name, 'school', a.school,
                              'date', to_char(a.date, 'Dy Mon DD'), 'reason', a.absence_reason, 'about_person_id', a.person_id),
           'afterschool_attendance', a.id
    from (values ('email', r.email), ('sms', r.phone)) as c(channel, addr)
    where c.addr is not null;
    n := n + 1;
  end loop;
  update public.afterschool_attendance set alerted_at = now() where id = a.id;
  return n;
end;
$$;
revoke execute on function app.afterschool_alert(uuid) from public, anon, authenticated;

-- Staff mark a child for a day: picked_up (from school), arrived, released (to whom + signature), absent, present.
create or replace function public.afterschool_mark(p_enrollment_id uuid, p_date date, p_action text, p_released_to text default null, p_signature_path text default null, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
  e public.afterschool_enrollments;
  aid uuid;
begin
  if tid is null or not app.has_module('programs_plus') or not app.has_permission('events.manage') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into e from public.afterschool_enrollments where id = p_enrollment_id and tenant_id = tid;
  if not found then
    raise exception 'enrollment not found' using errcode = 'P0002';
  end if;
  insert into public.afterschool_attendance (tenant_id, enrollment_id, date, marked_by) values (tid, e.id, p_date, auth.uid())
  on conflict (enrollment_id, date) do update set marked_by = auth.uid()
  returning id into aid;
  if p_action = 'picked_up' then
    update public.afterschool_attendance set picked_up_at = coalesce(picked_up_at, now()), absent = false, absence_reason = null where id = aid;
  elsif p_action = 'arrived' then
    update public.afterschool_attendance set picked_up_at = coalesce(picked_up_at, now()), arrived_at = coalesce(arrived_at, now()), absent = false, absence_reason = null where id = aid;
  elsif p_action = 'released' then
    if length(trim(coalesce(p_released_to, ''))) < 2 or p_signature_path is null then
      raise exception 'who picked up, and their signature, are required' using errcode = '22023';
    end if;
    update public.afterschool_attendance set released_at = now(), released_to = trim(p_released_to), signature_path = p_signature_path
     where id = aid and arrived_at is not null;
    if not found then
      raise exception 'mark them arrived first' using errcode = '22023';
    end if;
  elsif p_action = 'absent' then
    update public.afterschool_attendance set absent = true, absence_reason = coalesce(nullif(trim(p_reason), ''), absence_reason), picked_up_at = null, arrived_at = null
     where id = aid and released_at is null;
    perform app.afterschool_alert(aid);
  elsif p_action = 'present' then
    update public.afterschool_attendance set absent = false, absence_reason = null where id = aid;
  else
    raise exception 'unknown action' using errcode = '22023';
  end if;
  return aid;
end;
$$;

-- Job: after each program's cutoff (school-local), expected children with no pickup are marked absent and
-- their guardians alerted. Returns the number of children alerted.
create or replace function public.afterschool_cutoff(p_tenant_id uuid, p_now timestamptz)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz text := (select timezone from public.tenants where id = p_tenant_id);
  local timestamp := p_now at time zone tz;
  today date := local::date;
  r record;
  aid uuid;
  n int := 0;
begin
  for r in
    select e.id from public.afterschool_enrollments e join public.afterschool_programs pr on pr.id = e.program_id
    where e.tenant_id = p_tenant_id and pr.active and e.status = 'active' and e.starts_on <= today and (e.ends_on is null or e.ends_on >= today)
      and extract(isodow from today)::int = any (e.days_of_week) and local::time > pr.pickup_cutoff
      and not exists (select 1 from public.afterschool_attendance at where at.enrollment_id = e.id and at.date = today
                        and (at.picked_up_at is not null or at.alerted_at is not null))
  loop
    insert into public.afterschool_attendance (tenant_id, enrollment_id, date, absent, absence_reason)
    values (p_tenant_id, r.id, today, true, 'not at pickup by the cutoff')
    on conflict (enrollment_id, date) do update set absent = true, absence_reason = coalesce(public.afterschool_attendance.absence_reason, excluded.absence_reason)
    returning id into aid;
    perform app.afterschool_alert(aid);
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke execute on function public.save_afterschool_program(jsonb), public.afterschool_enroll(uuid, uuid, text, text, int[], date), public.afterschool_end(uuid, date),
  public.afterschool_mark(uuid, date, text, text, text, text) from public, anon;
grant execute on function public.save_afterschool_program(jsonb), public.afterschool_enroll(uuid, uuid, text, text, int[], date), public.afterschool_end(uuid, date),
  public.afterschool_mark(uuid, date, text, text, text, text) to authenticated;
revoke execute on function public.afterschool_cutoff(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.afterschool_cutoff(uuid, timestamptz) to service_role;

insert into public.jobs (name, schedule, description) values
  ('afterschool_cutoff', '*/10 * * * *', 'Mark after-school children not picked up by the cutoff absent and alert their guardians')
on conflict (name) do update set schedule = excluded.schedule, description = excluded.description;

select app.index_foreign_keys();
