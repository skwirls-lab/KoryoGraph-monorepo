-- 0013 Scheduling & attendance (§4.4, F5.1–F5.6).
-- Templates hold a weekly (or any) RRULE in LOCAL wall-clock terms (start_date/start_time + location tz);
-- the materialize_sessions job expands them into class_sessions for a rolling window (ADR-0010).
-- Schedule is readable by everyone in the tenant (Home shows it); written with schedule.manage.

insert into public.permissions (key, domain, description)
values ('schedule.manage', 'attendance', 'Edit class templates, sessions, exceptions and holidays')
on conflict (key) do nothing;

create or replace function app.default_role_permissions(role_key text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case role_key
    when 'owner' then array[
      'desk.access','mat.access','home.access','people.read','people.write','people.medical.read','attendance.write',
      'curriculum.write','ranks.promote','testing.manage','billing.read','billing.charge','billing.refund','retail.sell',
      'inventory.manage','crm.manage','comms.send','automations.manage','events.manage','staff.manage','roles.manage',
      'settings.manage','reports.read','ai.approve','ai.use','exports.run','audit.read','kiosk.manage','schedule.manage']
    when 'admin' then array[
      'desk.access','mat.access','people.read','people.write','people.medical.read','attendance.write',
      'curriculum.write','ranks.promote','testing.manage','billing.read','billing.charge','billing.refund','retail.sell',
      'inventory.manage','crm.manage','comms.send','automations.manage','events.manage','staff.manage',
      'settings.manage','reports.read','ai.approve','ai.use','exports.run','audit.read','kiosk.manage','schedule.manage']
    when 'front_desk' then array[
      'desk.access','people.read','people.write','attendance.write','billing.read','billing.charge','retail.sell',
      'crm.manage','comms.send','events.manage','reports.read','ai.use','kiosk.manage','schedule.manage']
    when 'instructor' then array[
      'mat.access','people.read','people.medical.read','attendance.write','curriculum.write','ranks.promote',
      'testing.manage','comms.send','ai.use','ai.approve']
    when 'assistant_instructor' then array['mat.access','people.read','attendance.write']
    when 'parent' then array['home.access']
    when 'student' then array['home.access']
    else array[]::text[]
  end;
$$;

-- Existing system roles pick up the new permission.
insert into public.role_permissions (tenant_id, role_id, permission_key)
select r.tenant_id, r.id, 'schedule.manage' from public.roles r
where r.is_system and r.key in ('owner', 'admin', 'front_desk')
on conflict do nothing;

create table public.class_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  location_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  program_ids uuid[] not null default '{}',
  rank_min_position int check (rank_min_position is null or rank_min_position >= 1),
  rank_max_position int check (rank_max_position is null or rank_max_position >= 1),
  age_min int,
  age_max int,
  capacity int check (capacity is null or capacity > 0),
  duration_min int not null default 60 check (duration_min between 5 and 600),
  rrule text not null,
  start_date date not null,
  start_time time not null,
  until_date date,
  room text,
  instructor_ids uuid[] not null default '{}',
  color text,
  bookable boolean not null default false,
  cancellation_window_min int not null default 120 check (cancellation_window_min >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id) on delete cascade,
  check (until_date is null or until_date >= start_date)
);
select app.setup_tenant_table('public.class_templates', 'schedule.manage');

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  template_id uuid,
  location_id uuid not null,
  name text not null,
  program_ids uuid[] not null default '{}',
  occurrence_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled', 'completed')),
  cancel_reason text,
  instructor_ids uuid[] not null default '{}',
  substitute_ids uuid[] not null default '{}',
  capacity int check (capacity is null or capacity > 0),
  room text,
  bookable boolean not null default false,
  cancellation_window_min int not null default 120,
  lesson_plan_id uuid,
  notes text,
  audio_path text,
  action_board_status text,
  detached boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, starts_at),
  -- The materialiser's key: one occurrence per template per local date; modify exceptions move starts_at in place.
  unique (template_id, occurrence_date),
  check (ends_at > starts_at),
  foreign key (tenant_id, template_id) references public.class_templates (tenant_id, id) on delete set null (template_id),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id) on delete cascade,
  foreign key (tenant_id, lesson_plan_id) references public.lesson_plans (tenant_id, id) on delete set null (lesson_plan_id)
);
select app.setup_tenant_table('public.class_sessions', 'schedule.manage');
create index class_sessions_starts on public.class_sessions (tenant_id, starts_at);
-- Instructors (attendance.write) mark sessions completed and attach lesson plans / notes from the Mat.
create policy class_sessions_instructor_update on public.class_sessions for update to authenticated
  using (tenant_id = (select app.tenant_id()) and (select app.has_permission('attendance.write')))
  with check (tenant_id = (select app.tenant_id()) and (select app.has_permission('attendance.write')));

create table public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  template_id uuid not null,
  date date not null,
  kind text not null check (kind in ('cancel', 'modify')),
  overrides jsonb not null default '{}'::jsonb,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, date),
  foreign key (tenant_id, template_id) references public.class_templates (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.schedule_exceptions', 'schedule.manage');

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  location_id uuid,
  date date not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.holidays', 'schedule.manage');
create unique index holidays_unique on public.holidays (tenant_id, coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid), date);

create table public.makeup_credits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  person_id uuid not null,
  earned_from_session_id uuid,
  reason text not null default 'excused absence',
  expires_at timestamptz not null default now() + interval '60 days',
  used_booking_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade,
  foreign key (tenant_id, earned_from_session_id) references public.class_sessions (tenant_id, id) on delete set null (earned_from_session_id)
);
select app.setup_tenant_table('public.makeup_credits', 'attendance.write', 'people.read');

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  session_id uuid not null,
  person_id uuid not null,
  status text not null default 'booked' check (status in ('booked', 'waitlisted', 'cancelled', 'no_show', 'attended')),
  waitlist_position int,
  booked_by_user_id uuid references auth.users (id) on delete set null,
  source text not null default 'desk' check (source in ('desk', 'home', 'mat', 'kiosk', 'widget', 'trial')),
  credit_id uuid,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, person_id),
  foreign key (tenant_id, session_id) references public.class_sessions (tenant_id, id) on delete cascade,
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade,
  foreign key (tenant_id, credit_id) references public.makeup_credits (tenant_id, id) on delete set null (credit_id)
);
select app.setup_tenant_table('public.bookings', 'attendance.write', 'people.read');
alter table public.makeup_credits
  add constraint makeup_credits_used_booking_fk foreign key (tenant_id, used_booking_id)
  references public.bookings (tenant_id, id) on delete set null (used_booking_id);
create policy bookings_household_select on public.bookings for select to authenticated
  using (tenant_id = (select app.tenant_id()) and person_id = any ((select app.household_person_ids())::uuid[]));
create policy makeup_credits_household_select on public.makeup_credits for select to authenticated
  using (tenant_id = (select app.tenant_id()) and person_id = any ((select app.household_person_ids())::uuid[]));

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  session_id uuid not null,
  person_id uuid not null,
  checked_in_at timestamptz not null default now(),
  checked_in_by_user_id uuid references auth.users (id) on delete set null,
  source text not null default 'desk' check (source in ('mat', 'desk', 'kiosk', 'home', 'action_board', 'import')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, person_id),
  foreign key (tenant_id, session_id) references public.class_sessions (tenant_id, id) on delete cascade,
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.attendance', 'attendance.write', 'people.read');
create index attendance_person_time on public.attendance (person_id, checked_in_at desc);
create policy attendance_household_select on public.attendance for select to authenticated
  using (tenant_id = (select app.tenant_id()) and person_id = any ((select app.household_person_ids())::uuid[]));

create table public.class_packs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  person_id uuid not null,
  membership_id uuid,
  total int not null check (total > 0),
  used int not null default 0 check (used >= 0),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade,
  check (used <= total)
);
select app.setup_tenant_table('public.class_packs', 'attendance.write', 'people.read');

create table public.private_lesson_slots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  instructor_user_id uuid references auth.users (id) on delete set null,
  location_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  price_cents int not null default 0 check (price_cents >= 0),
  booked_person_id uuid,
  status text not null default 'open' check (status in ('open', 'booked', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id) on delete cascade,
  foreign key (tenant_id, booked_person_id) references public.people (tenant_id, id) on delete set null (booked_person_id)
);
select app.setup_tenant_table('public.private_lesson_slots', 'schedule.manage');

-- ---------------------------------------------------------------------------------------------
-- enrollments.classes_since_promotion is maintained from attendance (the deferred part of M1.03).
-- Counts sessions of the enrollment's program attended since the last promotion (or start).
-- ---------------------------------------------------------------------------------------------
create or replace function app.recount_classes(p_person_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.enrollments e
     set classes_since_promotion = (
       select count(*) from public.attendance a
       join public.class_sessions s on s.id = a.session_id
       where a.person_id = e.person_id
         and e.program_id = any (s.program_ids)
         and s.starts_at >= coalesce(e.last_promoted_at, e.started_at::timestamptz)
     )
   where e.person_id = p_person_id;
$$;

create or replace function app.attendance_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform app.recount_classes(new.person_id);
  end if;
  if tg_op in ('DELETE', 'UPDATE') and (tg_op = 'DELETE' or old.person_id is distinct from new.person_id) then
    perform app.recount_classes(old.person_id);
  end if;
  return null;
end;
$$;
create trigger attendance_recount after insert or update or delete on public.attendance
  for each row execute function app.attendance_changed();

-- A new enrollment counts attendance already recorded in its window.
create or replace function app.enrollment_recount()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.recount_classes(new.person_id);
  return null;
end;
$$;
create trigger enrollment_recount after insert or update of started_at, last_promoted_at, program_id on public.enrollments
  for each row execute function app.enrollment_recount();

-- ---------------------------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------------------------
create view public.v_attendance_velocity with (security_invoker = true) as
  with a as (
    select a.tenant_id, a.person_id, s.starts_at
    from public.attendance a join public.class_sessions s on s.id = a.session_id
  ),
  weeks as (
    select distinct person_id, date_trunc('week', starts_at) as wk from a
  ),
  streaks as (
    -- consecutive weeks (ending this or last week) with at least one class
    select person_id, count(*)::int as streak_weeks
    from (
      select person_id, wk,
             date_trunc('week', now()) - wk as gap,
             row_number() over (partition by person_id order by wk desc) as rn
      from weeks
    ) x
    where gap = ((rn - 1) * interval '7 days') or gap = (rn * interval '7 days')
    group by person_id
  )
  select p.tenant_id, p.id as person_id,
         max(a.starts_at) as last_attended_at,
         count(*) filter (where a.starts_at >= now() - interval '30 days')::int as classes_30d,
         count(*) filter (where a.starts_at >= now() - interval '60 days' and a.starts_at < now() - interval '30 days')::int as classes_prev_30d,
         coalesce(max(st.streak_weeks), 0) as streak_weeks
  from public.people p
  left join a on a.person_id = p.id
  left join streaks st on st.person_id = p.id
  group by p.tenant_id, p.id;

-- People expected in a session: active enrollment in one of its programs, within rank/age bounds, and an
-- active/trial person — plus anyone booked or already checked in (walk-ins).
create view public.v_class_roster with (security_invoker = true) as
  with eligible as (
    select s.id as session_id, p.id as person_id, e.id as enrollment_id
    from public.class_sessions s
    join public.class_templates t on t.id = s.template_id
    join public.enrollments e on e.program_id = any (s.program_ids) and e.status = 'active'
    join public.people p on p.id = e.person_id and p.status in ('active', 'trial') and p.archived_at is null
    left join public.ranks r on r.id = e.current_rank_id
    where (t.rank_min_position is null or coalesce(r.position, 1) >= t.rank_min_position)
      and (t.rank_max_position is null or coalesce(r.position, 1) <= t.rank_max_position)
      and (t.age_min is null or p.dob is null or extract(year from age(s.starts_at::date, p.dob)) >= t.age_min)
      and (t.age_max is null or p.dob is null or extract(year from age(s.starts_at::date, p.dob)) <= t.age_max)
  ),
  extra as (
    select b.session_id, b.person_id, null::uuid as enrollment_id from public.bookings b where b.status <> 'cancelled'
    union
    select a.session_id, a.person_id, null::uuid from public.attendance a
  ),
  roster as (
    select session_id, person_id, max(enrollment_id::text)::uuid as enrollment_id
    from (select * from eligible union all select * from extra) u
    group by session_id, person_id
  )
  select ro.session_id, s.tenant_id, ro.person_id,
         trim(coalesce(p.preferred_name, p.first_name) || ' ' || p.last_name) as display_name,
         p.first_name, p.last_name, p.photo_path, p.dob, p.allergies, p.injury_flags, p.status as person_status,
         coalesce(ro.enrollment_id, (select e2.id from public.enrollments e2 where e2.person_id = ro.person_id and e2.program_id = any (s.program_ids) limit 1)) as enrollment_id,
         r.name as rank_name, r.belt_color, e.stripes, r.stripes_max,
         b.status as booking_status, b.waitlist_position,
         a.id is not null as attended, a.checked_in_at, a.source as attendance_source,
         (ro.enrollment_id is null) as is_extra
  from roster ro
  join public.class_sessions s on s.id = ro.session_id
  join public.people p on p.id = ro.person_id
  left join public.enrollments e on e.id = coalesce(ro.enrollment_id, (select e2.id from public.enrollments e2 where e2.person_id = ro.person_id and e2.program_id = any (s.program_ids) limit 1))
  left join public.ranks r on r.id = e.current_rank_id
  left join public.bookings b on b.session_id = ro.session_id and b.person_id = ro.person_id
  left join public.attendance a on a.session_id = ro.session_id and a.person_id = ro.person_id;

select app.index_foreign_keys();
