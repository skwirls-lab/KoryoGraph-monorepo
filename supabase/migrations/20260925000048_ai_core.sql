-- 0048 AI gateway core (§3.6, M4.01): model prices, per-tenant monthly budgets, and a log of every AI run
-- (live or fixture, ok or not). Runs are written through a definer RPC so any signed-in member's AI use
-- (Desk copilot, Home assistant) is logged against their tenant and themselves — never another tenant.

-- Global price list (per 1M tokens, in cents), synced from the provider's catalogue by a job; used when a
-- response doesn't report its own cost.
create table public.ai_models (
  id text primary key,
  name text,
  input_per_m_cents numeric(12, 4) not null default 0,
  output_per_m_cents numeric(12, 4) not null default 0,
  context_length int,
  synced_at timestamptz not null default now()
);
alter table public.ai_models enable row level security;
create policy ai_models_read on public.ai_models for select to authenticated using (true);

create table public.tenant_ai_budgets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  monthly_limit_cents int not null default 5000 check (monthly_limit_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.setup_tenant_table('public.tenant_ai_budgets', 'settings.manage', 'settings.manage');

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  task_id text not null,
  tier text not null check (tier in ('fast', 'frontier', 'vision', 'audio', 'embed')),
  model text,
  transport text not null check (transport in ('live', 'fixture')),
  status text not null check (status in ('ok', 'invalid_output', 'provider_error', 'no_key', 'no_model', 'budget_exceeded', 'no_fixture')),
  input_hash text not null,
  input jsonb,
  output jsonb,
  error text,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  cost_cents numeric(12, 4) not null default 0,
  latency_ms int not null default 0,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_runs_tenant_month on public.ai_runs (tenant_id, created_at desc);
-- Read: settings.manage (usage, audit). Writes only through app.log_ai_run / the service role.
select app.setup_tenant_table('public.ai_runs', null, 'settings.manage');

-- Budget status for the caller's tenant: limit and spend this (school-local) month. Any member may ask —
-- the gateway checks it before every call.
create or replace function public.ai_budget_status()
returns table (limit_cents int, used_cents numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select monthly_limit_cents from public.tenant_ai_budgets where tenant_id = app.tenant_id()), 5000),
         coalesce((select sum(cost_cents) from public.ai_runs r where r.tenant_id = app.tenant_id()
                   and app.local_period(r.tenant_id, r.created_at) = app.local_period(app.tenant_id(), now())), 0)
  where app.tenant_id() is not null;
$$;

create or replace function public.ai_budget_status_for(p_tenant uuid)
returns table (limit_cents int, used_cents numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select monthly_limit_cents from public.tenant_ai_budgets where tenant_id = p_tenant), 5000),
         coalesce((select sum(cost_cents) from public.ai_runs r where r.tenant_id = p_tenant
                   and app.local_period(r.tenant_id, r.created_at) = app.local_period(p_tenant, now())), 0);
$$;

-- Log a run for the caller's tenant as the caller (user-facing AI). Jobs log with the service role.
create or replace function public.log_ai_run(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
  rid uuid;
begin
  if tid is null or auth.uid() is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.ai_runs (tenant_id, user_id, task_id, tier, model, transport, status, input_hash, input, output, error, tokens_in, tokens_out, cost_cents, latency_ms, attempts)
  values (tid, auth.uid(), p ->> 'task_id', p ->> 'tier', p ->> 'model', p ->> 'transport', p ->> 'status', p ->> 'input_hash', p -> 'input', p -> 'output', p ->> 'error',
          coalesce((p ->> 'tokens_in')::int, 0), coalesce((p ->> 'tokens_out')::int, 0), coalesce((p ->> 'cost_cents')::numeric, 0), coalesce((p ->> 'latency_ms')::int, 0), coalesce((p ->> 'attempts')::int, 0))
  returning id into rid;
  return rid;
end;
$$;

revoke execute on function public.ai_budget_status(), public.log_ai_run(jsonb) from public, anon;
grant execute on function public.ai_budget_status(), public.log_ai_run(jsonb) to authenticated;
revoke execute on function public.ai_budget_status_for(uuid) from public, anon, authenticated;
grant execute on function public.ai_budget_status_for(uuid) to service_role;

-- Usage per school-local month and task (Settings → AI).
create view public.v_ai_usage with (security_invoker = true) as
  select tenant_id, app.local_period(tenant_id, created_at) as period, task_id, transport, status,
         count(*)::int as runs, sum(tokens_in)::int as tokens_in, sum(tokens_out)::int as tokens_out, sum(cost_cents) as cost_cents
  from public.ai_runs
  group by tenant_id, app.local_period(tenant_id, created_at), task_id, transport, status;

insert into public.jobs (name, schedule, description) values
  ('ai_models_sync', '0 4 * * *', 'Refresh AI model prices from the provider catalogue')
on conflict (name) do update set schedule = excluded.schedule, description = excluded.description;

select app.index_foreign_keys();
