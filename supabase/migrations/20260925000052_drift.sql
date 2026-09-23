-- 0052 Drift Detector (A3, M4.05). Nightly, every active student gets a rule-based risk score (pure TS in
-- packages/ai/drift.ts) from features computed here; the top of the list gets an explanation and a drafted
-- outreach message waiting in Approvals. Scores are written by the job only.

create table public.risk_scores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  person_id uuid not null,
  computed_on date not null,
  score int not null check (score between 0 and 100),
  level text not null check (level in ('low', 'medium', 'high')),
  reasons jsonb not null default '[]'::jsonb,
  features jsonb not null default '{}'::jsonb,
  explanation text,
  ai_run_id uuid references public.ai_runs (id) on delete set null,
  approval_item_id uuid references public.approval_items (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, computed_on),
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.risk_scores', null, 'people.read', 'intelligence');

-- Each student's latest score.
create view public.v_risk_latest with (security_invoker = true) as
  select distinct on (r.person_id) r.tenant_id, r.person_id, r.computed_on, r.score, r.level, r.reasons, r.explanation, r.approval_item_id,
         trim(coalesce(p.preferred_name, p.first_name) || ' ' || p.last_name) as person_name
  from public.risk_scores r join public.people p on p.id = r.person_id
  where p.status in ('active', 'trial') and p.archived_at is null
  order by r.person_id, r.computed_on desc;

-- Features for every active student with an active enrollment (service role; the job scores them).
create or replace function public.drift_features(p_tenant uuid, p_today date)
returns table (person_id uuid, first_name text, household_id uuid, minor boolean, recent4w int, prior8w int, days_since_last int, past_due_cents int, tenure_days int, concern_notes_30d int)
language sql
stable
security definer
set search_path = ''
as $$
  with tz as (select timezone from public.tenants where id = p_tenant),
  students as (
    select p.id, coalesce(p.preferred_name, p.first_name) as first_name, p.dob,
           (select hm.household_id from public.household_members hm where hm.person_id = p.id order by hm.relationship = 'student' desc limit 1) as household_id,
           (select min(e.started_at) from public.enrollments e where e.person_id = p.id) as since
    from public.people p
    where p.tenant_id = p_tenant and p.status = 'active' and p.archived_at is null and 'student' = any (p.type_flags)
      and exists (select 1 from public.enrollments e where e.person_id = p.id and e.status = 'active')
  ),
  att as (
    select a.person_id, (s.starts_at at time zone (select timezone from tz))::date as d
    from public.attendance a join public.class_sessions s on s.id = a.session_id
    where a.tenant_id = p_tenant and s.starts_at <= now() and (s.starts_at at time zone (select timezone from tz))::date > p_today - 84
  )
  select st.id, st.first_name, st.household_id,
         coalesce(st.dob > p_today - interval '18 years', false),
         (select count(*) from att where att.person_id = st.id and att.d > p_today - 28)::int,
         (select count(*) from att where att.person_id = st.id and att.d <= p_today - 28)::int,
         (select p_today - max((s.starts_at at time zone (select timezone from tz))::date) from public.attendance a join public.class_sessions s on s.id = a.session_id
           where a.person_id = st.id and s.starts_at <= now())::int,
         coalesce((select b.past_due_cents from public.v_household_balance b where b.household_id = st.household_id), 0)::int,
         greatest(p_today - coalesce(st.since::date, p_today), 0)::int,
         (select count(*) from public.notes n where n.person_id = st.id and n.kind in ('injury', 'behavior', 'billing') and n.created_at > now() - interval '30 days')::int
  from students st;
$$;
revoke execute on function public.drift_features(uuid, date) from public, anon, authenticated;
grant execute on function public.drift_features(uuid, date) to service_role;

insert into public.jobs (name, schedule, description) values
  ('drift_score', '15 2 * * *', 'Score every active student''s risk of dropping out; draft outreach for the top of the list')
on conflict (name) do update set schedule = excluded.schedule, description = excluded.description;

select app.index_foreign_keys();
