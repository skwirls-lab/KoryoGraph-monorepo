-- 0025 Owner dashboard, first reports, and full-tenant data exports (F14.1, F14.2, F1.7).

create table public.exports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kind text not null default 'full' check (kind in ('table', 'full')),
  params jsonb not null default '{}'::jsonb,
  file_path text,
  status text not null default 'queued' check (status in ('queued', 'running', 'ready', 'failed')),
  stats jsonb not null default '{}'::jsonb,
  error text,
  by_user_id uuid references auth.users (id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.setup_tenant_table('public.exports', 'exports.run', 'exports.run');

-- Headline numbers for the Desk dashboard, week boundaries in the tenant's timezone (Mon–Sun).
create view public.v_owner_dashboard with (security_invoker = true) as
  with t as (
    select id, timezone, (date_trunc('week', now() at time zone timezone)) at time zone timezone as week_start
    from public.tenants
  )
  select t.id as tenant_id,
    (select count(*) from public.people p where p.tenant_id = t.id and p.status = 'active' and 'student' = any (p.type_flags) and p.archived_at is null)::int as active_students,
    (select count(*) from public.people p where p.tenant_id = t.id and p.status = 'trial' and p.archived_at is null)::int as trials,
    (select count(*) from public.people p where p.tenant_id = t.id and p.status = 'lead' and p.archived_at is null)::int as leads,
    (select count(*) from public.attendance a join public.class_sessions s on s.id = a.session_id
       where a.tenant_id = t.id and s.starts_at >= t.week_start and s.starts_at < t.week_start + interval '7 days')::int as attendance_this_week,
    (select count(*) from public.attendance a join public.class_sessions s on s.id = a.session_id
       where a.tenant_id = t.id and s.starts_at >= t.week_start - interval '7 days' and s.starts_at < t.week_start)::int as attendance_last_week,
    (select count(*) from public.class_sessions s where s.tenant_id = t.id and s.status = 'scheduled'
       and s.starts_at >= (date_trunc('day', now() at time zone t.timezone)) at time zone t.timezone
       and s.starts_at < (date_trunc('day', now() at time zone t.timezone) + interval '1 day') at time zone t.timezone)::int as classes_today,
    (select count(*) from public.v_required_documents r where r.tenant_id = t.id and r.signature_id is null)::int as unsigned_documents,
    (select count(*) from public.message_threads m where m.tenant_id = t.id and m.status = 'open' and m.unread_staff > 0)::int as unread_threads
  from t;

-- Membership roster report.
create view public.v_member_roster with (security_invoker = true) as
  select p.tenant_id, p.id as person_id, p.first_name, p.last_name,
         trim(coalesce(p.preferred_name, p.first_name) || ' ' || p.last_name) as display_name,
         p.status, p.dob, p.email, p.phone, p.tags,
         (select string_agg(h.name, '; ' order by h.name) from public.household_members hm join public.households h on h.id = hm.household_id where hm.person_id = p.id) as households,
         (select string_agg(pr.name || coalesce(' — ' || r.name, ''), '; ' order by pr.name)
            from public.enrollments e join public.programs pr on pr.id = e.program_id left join public.ranks r on r.id = e.current_rank_id
            where e.person_id = p.id and e.status = 'active') as programs,
         (select max(s.starts_at) from public.attendance a join public.class_sessions s on s.id = a.session_id where a.person_id = p.id) as last_attended_at,
         (select count(*) from public.attendance a join public.class_sessions s on s.id = a.session_id where a.person_id = p.id and s.starts_at >= now() - interval '30 days')::int as classes_30d
  from public.people p
  where 'student' = any (p.type_flags) and p.archived_at is null;

-- Attendance per class per week (tenant-local weeks).
create view public.v_attendance_by_class with (security_invoker = true) as
  select s.tenant_id,
         (date_trunc('week', s.starts_at at time zone tn.timezone))::date as week_start,
         s.name as class_name,
         count(distinct s.id)::int as sessions,
         count(a.id)::int as attendances
  from public.class_sessions s
  join public.tenants tn on tn.id = s.tenant_id
  left join public.attendance a on a.session_id = s.id
  where s.status <> 'cancelled'
  group by s.tenant_id, 2, s.name;

select app.index_foreign_keys();
