-- 0056 Natural-language reports (A7, M4.09). The model writes a SELECT against a small whitelisted set of
-- report views in schema `nl`; the app validates it (single SELECT, whitelisted views, allowlisted functions,
-- LIMIT ≤ 5000) and runs it through public.run_nl_report as the dedicated role `nl_reader`, which can read
-- nothing but these views. Each view filters to the caller's tenant (app.tenant_id() from the JWT) and checks
-- the caller's permission itself, so a query can never reach another school's rows or data the user couldn't
-- otherwise see. Saved reports re-run the same way.

create schema if not exists nl;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'nl_reader') then
    create role nl_reader nologin;
  end if;
end $$;
-- The runner (security invoker) switches to nl_reader for the one statement. INHERIT FALSE: being allowed
-- to SET ROLE nl_reader doesn't give ordinary sessions nl_reader's privileges.
grant nl_reader to authenticated with inherit false, set true;
grant usage on schema nl to nl_reader;
grant usage on schema app to nl_reader;

-- Each nl view reads through a security-definer row function (runs as the owner, so it can read the
-- underlying invoker views) that returns only the caller's tenant — and only if they hold the permission.
create or replace function app.nl_can(p text) returns boolean language sql stable security definer set search_path = '' as $$ select app.has_permission(p) $$;
create or replace function app.nl_attendance_weekly()
returns table (week_start date, program text, class_name text, sessions int, check_ins int)
language sql stable security definer set search_path = '' as $$
  select (date_trunc('week', s.starts_at at time zone t.timezone))::date, coalesce(p.name, 'No program'), s.name, count(distinct s.id)::int, count(a.id)::int
  from public.class_sessions s
  join public.tenants t on t.id = s.tenant_id
  left join lateral unnest(case when cardinality(s.program_ids) > 0 then s.program_ids else array[null::uuid] end) as pid(id) on true
  left join public.programs p on p.id = pid.id
  left join public.attendance a on a.session_id = s.id
  where s.tenant_id = app.tenant_id() and app.has_permission('reports.read') and s.status <> 'cancelled' and s.starts_at <= now()
  group by 1, 2, 3 $$;
create or replace function app.nl_members()
returns table (display_name text, status text, programs text, households text, tags text[], classes_30d int, last_attended_on date, age int)
language sql stable security definer set search_path = '' as $$
  select r.display_name, r.status, r.programs, r.households, r.tags, r.classes_30d, (r.last_attended_at at time zone t.timezone)::date,
         case when r.dob is null then null else extract(year from age(r.dob))::int end
  from public.v_member_roster r join public.tenants t on t.id = r.tenant_id
  where r.tenant_id = app.tenant_id() and app.has_permission('reports.read') $$;
create or replace function app.nl_revenue_monthly()
returns table (month date, category text, net_cents int, total_cents int, invoices int)
language sql stable security definer set search_path = '' as $$
  select month, category, sum(net_cents)::int, sum(total_cents)::int, count(distinct invoice_id)::int
  from public.v_revenue_lines where tenant_id = app.tenant_id() and app.has_permission('billing.read') group by month, category $$;
create or replace function app.nl_mrr_monthly()
returns table (month date, mrr_cents int, new_mrr_cents int, churned_mrr_cents int, memberships int)
language sql stable security definer set search_path = '' as $$
  select month, mrr_cents, new_mrr_cents, churned_mrr_cents, memberships from public.v_mrr_monthly where tenant_id = app.tenant_id() and app.has_permission('billing.read') $$;
create or replace function app.nl_payments()
returns table (on_date date, kind text, method text, amount_cents int, household_name text)
language sql stable security definer set search_path = '' as $$
  select on_date, kind, method, amount_cents, household_name from public.v_payments_ledger where tenant_id = app.tenant_id() and app.has_permission('billing.read') $$;
create or replace function app.nl_ar_aging()
returns table (household_name text, bucket text, balance_cents int, days_overdue int, dunning_stage int, due_at date)
language sql stable security definer set search_path = '' as $$
  select household_name, bucket, balance_cents, days_overdue, dunning_stage, due_at from public.v_ar_aging where tenant_id = app.tenant_id() and app.has_permission('billing.read') $$;
create or replace function app.nl_trial_funnel()
returns table (period text, source text, leads int, trials_booked int, trials_attended int, won int, lost int)
language sql stable security definer set search_path = '' as $$
  select period, source, leads, trials_booked, trials_attended, won, lost from public.v_trial_funnel where tenant_id = app.tenant_id() and app.has_permission('crm.manage') $$;
create or replace function app.nl_churn()
returns table (person_name text, plan_name text, status text, starts_at date, ended_on date, tenure_months int, reason text, still_member boolean)
language sql stable security definer set search_path = '' as $$
  select person_name, plan_name, status, starts_at, ended_on, tenure_months, reason, still_member from public.v_churn_list where tenant_id = app.tenant_id() and app.has_permission('billing.read') $$;
create or replace function app.nl_staff_sessions()
returns table (staff_name text, period text, sessions int, hours numeric)
language sql stable security definer set search_path = '' as $$
  select staff_name, period, sessions, hours from public.v_staff_sessions where tenant_id = app.tenant_id() and app.has_permission('reports.read') $$;
create or replace function app.nl_risk()
returns table (person_name text, level text, score int, computed_on date)
language sql stable security definer set search_path = '' as $$
  select person_name, level, score, computed_on from public.v_risk_latest where tenant_id = app.tenant_id() and app.has_permission('people.read') and app.has_module('intelligence') $$;

create view nl.v_attendance_weekly as select * from app.nl_attendance_weekly();
create view nl.v_members as select * from app.nl_members();
create view nl.v_revenue_monthly as select * from app.nl_revenue_monthly();
create view nl.v_mrr_monthly as select * from app.nl_mrr_monthly();
create view nl.v_payments as select * from app.nl_payments();
create view nl.v_ar_aging as select * from app.nl_ar_aging();
create view nl.v_trial_funnel as select * from app.nl_trial_funnel();
create view nl.v_churn as select * from app.nl_churn();
create view nl.v_staff_sessions as select * from app.nl_staff_sessions();
create view nl.v_risk as select * from app.nl_risk();

do $$ declare f text; begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname like 'nl\_%' loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to nl_reader', f);
  end loop;
end $$;
grant select on all tables in schema nl to nl_reader;
revoke all on all tables in schema nl from anon, authenticated;

-- Run a validated report query as nl_reader: read-only, 5 s, at most 5000 rows, JSON rows back (column order kept).
create or replace function public.run_nl_report(p_sql text)
returns json
language plpgsql
volatile
security invoker
set search_path = nl
as $$
declare
  result json;
begin
  if app.tenant_id() is null or not app.has_permission('reports.read') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_sql ~ ';' or p_sql !~* '^\s*(select|with)\s' then
    raise exception 'only a single SELECT is allowed' using errcode = '22023';
  end if;
  -- The query runs as nl_reader over tenant-filtered views; it must not be able to rewrite the session
  -- (set_config could forge the JWT claims the views filter on), reach catalogs or escape identifiers.
  if lower(regexp_replace(p_sql, '["\s]', '', 'g')) ~ '(set_config|current_setting|pg_|lo_|dblink|u&|\\u|query_to|xml|copy)' then
    raise exception 'that query uses something reports can''t use' using errcode = '22023';
  end if;
  set local transaction_read_only = on;
  set local statement_timeout = '5s';
  set local role nl_reader;
  -- json (not jsonb) keeps the query's column order.
  execute format('select coalesce(json_agg(t), ''[]''::json) from (select * from (%s) q limit 5000) t', p_sql) into result;
  reset role;
  return result;
end;
$$;
revoke execute on function public.run_nl_report(text) from public, anon;
grant execute on function public.run_nl_report(text) to authenticated;

create table public.saved_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  question text not null,
  sql text not null,
  chart jsonb not null default '{}'::jsonb,
  ai_run_id uuid references public.ai_runs (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.setup_tenant_table('public.saved_reports', 'reports.read', 'reports.read');

select app.index_foreign_keys();
