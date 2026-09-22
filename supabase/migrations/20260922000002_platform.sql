-- 0002 Platform & tenancy (§4.1).

-- ---------------------------------------------------------------------------------------------
-- Global catalogue tables (no tenant_id): readable by everyone, written by platform admins.
-- ---------------------------------------------------------------------------------------------
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
create policy platform_admins_self_select on public.platform_admins
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function app.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;
grant execute on function app.is_platform_admin() to anon, authenticated, service_role;

create policy platform_admins_admin_all on public.platform_admins
  for all to authenticated using ((select app.is_platform_admin())) with check ((select app.is_platform_admin()));

create table public.modules (
  key text primary key,
  name text not null,
  description text not null default '',
  required boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plans (
  key text primary key,
  name text not null,
  description text not null default '',
  monthly_cents int not null check (monthly_cents >= 0),
  annual_cents int not null check (annual_cents >= 0),
  is_bundle boolean not null default false,
  public boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plan_modules (
  plan_key text not null references public.plans (key) on delete cascade,
  module_key text not null references public.modules (key) on delete cascade,
  primary key (plan_key, module_key)
);

create table public.jobs (
  name text primary key,
  schedule text not null,
  description text not null default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare
  t text;
begin
  foreach t in array array['modules', 'plans', 'plan_modules'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_public_read', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select app.is_platform_admin())) with check ((select app.is_platform_admin()))',
      t || '_admin_write', t);
  end loop;
end;
$$;

alter table public.jobs enable row level security;
create policy jobs_admin_all on public.jobs
  for all to authenticated using ((select app.is_platform_admin())) with check ((select app.is_platform_admin()));

create trigger set_updated_at before update on public.modules for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.plans for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.jobs for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Tenants
-- ---------------------------------------------------------------------------------------------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug extensions.citext not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$'),
  timezone text not null default 'America/New_York',
  currency char(3) not null default 'USD',
  locale text not null default 'en-US',
  branding jsonb not null default '{"theme": "koryo-red"}'::jsonb,
  terminology jsonb not null default '{"school": "dojang", "rank": "belt", "form": "poomsae"}'::jsonb,
  stripe_account_id text,
  stripe_onboarding_complete boolean not null default false,
  status text not null default 'trial' check (status in ('active', 'suspended', 'trial')),
  trial_ends_at timestamptz,
  onboarding jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.tenants for each row execute function app.set_updated_at();
alter table public.tenants enable row level security;
-- Members read their tenants (including non-active ones, for the tenant switcher; see 0003 policy).
create policy tenants_current_select on public.tenants
  for select to authenticated using (id = (select app.tenant_id()));
create policy tenants_settings_update on public.tenants
  for update to authenticated
  using (id = (select app.tenant_id()) and (select app.has_permission('settings.manage')))
  with check (id = (select app.tenant_id()) and (select app.has_permission('settings.manage')));
create policy tenants_admin_all on public.tenants
  for all to authenticated using ((select app.is_platform_admin())) with check ((select app.is_platform_admin()));

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  address jsonb not null default '{}'::jsonb,
  phone text,
  timezone text,
  is_default boolean not null default false,
  rooms jsonb not null default '[]'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index locations_one_default on public.locations (tenant_id) where is_default;
select app.setup_tenant_table('public.locations', 'settings.manage');

create table public.tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  host extensions.citext not null unique,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.setup_tenant_table('public.tenant_domains', 'settings.manage');

create table public.tenant_entitlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  module_key text not null references public.modules (key),
  source text not null check (source in ('plan', 'addon', 'trial', 'comp')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, module_key)
);
-- Read-only to tenant users; granted by create_tenant / billing / platform admin.
select app.setup_tenant_table('public.tenant_entitlements', null);

create table public.tenant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  plan_key text references public.plans (key),
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'cancelled')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  seats int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id)
);
select app.setup_tenant_table('public.tenant_subscriptions', null, 'settings.manage');

-- Platform-level job run log. `for_tenant_id` is the tenant a run targeted (null = all tenants); it is
-- not a tenancy key — job runs are visible to platform admins only (ADR-0006).
create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null references public.jobs (name) on delete cascade,
  for_tenant_id uuid references public.tenants (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'error', 'skipped')),
  stats jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now()
);
create index job_runs_job_started on public.job_runs (job_name, started_at desc);
alter table public.job_runs enable row level security;
create policy job_runs_admin_select on public.job_runs
  for select to authenticated using ((select app.is_platform_admin()));

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  prefix text not null,
  scopes text[] not null default '{}',
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.setup_tenant_table('public.api_keys', 'settings.manage', 'settings.manage');

create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  url text not null check (url ~ '^https?://'),
  secret text not null,
  events text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.setup_tenant_table('public.webhook_endpoints', 'settings.manage', 'settings.manage');

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  endpoint_id uuid not null,
  event text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'failed')),
  attempts int not null default 0,
  next_attempt_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, endpoint_id) references public.webhook_endpoints (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.webhook_deliveries', null, 'settings.manage');

select app.index_foreign_keys();
