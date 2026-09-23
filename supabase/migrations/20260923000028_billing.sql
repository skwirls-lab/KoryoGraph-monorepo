-- 0028 Billing & payments ledger (§4.6, F7.1–F7.8). Ledger-first: every money fact lives here; Stripe is
-- the processor. Tables are gated by the `billing` module in RLS as well as in server actions (F1.5).

-- Policy generator v2: optional module gate (defense in depth for licensed modules).
drop function if exists app.setup_tenant_table(regclass, text, text);
drop function if exists app.apply_tenant_policies(regclass, text, text);

create or replace function app.apply_tenant_policies(tbl regclass, write_permission text, read_permission text default null, module text default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  t text := tbl::text;
  n text := (select c.relname from pg_catalog.pg_class c where c.oid = tbl);
  base text := 'tenant_id = (select app.tenant_id())';
  read_pred text;
  write_pred text;
begin
  execute format('alter table %s enable row level security', t);
  if module is not null then
    base := format('%s and (select app.has_module(%L))', base, module);
  end if;
  read_pred := base;
  if read_permission is not null then
    read_pred := format('%s and (select app.has_permission(%L))', base, read_permission);
  end if;
  execute format('drop policy if exists %I on %s', n || '_tenant_select', t);
  execute format('create policy %I on %s for select to authenticated using (%s)', n || '_tenant_select', t, read_pred);
  execute format('drop policy if exists %I on %s', n || '_tenant_insert', t);
  execute format('drop policy if exists %I on %s', n || '_tenant_update', t);
  execute format('drop policy if exists %I on %s', n || '_tenant_delete', t);
  if write_permission is not null then
    write_pred := format('%s and (select app.has_permission(%L))', base, write_permission);
    execute format('create policy %I on %s for insert to authenticated with check (%s)', n || '_tenant_insert', t, write_pred);
    execute format('create policy %I on %s for update to authenticated using (%s) with check (%s)', n || '_tenant_update', t, write_pred, write_pred);
    execute format('create policy %I on %s for delete to authenticated using (%s)', n || '_tenant_delete', t, write_pred);
  end if;
end;
$$;

create or replace function app.setup_tenant_table(tbl regclass, write_permission text, read_permission text default null, module text default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  t text := tbl::text;
  n text := (select c.relname from pg_catalog.pg_class c where c.oid = tbl);
begin
  perform app.apply_tenant_policies(tbl, write_permission, read_permission, module);
  if not exists (select 1 from pg_catalog.pg_constraint where conrelid = tbl and conname = n || '_tenant_id_id_key') then
    execute format('alter table %s add constraint %I unique (tenant_id, id)', t, n || '_tenant_id_id_key');
  end if;
  if exists (select 1 from pg_catalog.pg_attribute where attrelid = tbl and attname = 'updated_at' and not attisdropped) then
    execute format('drop trigger if exists set_updated_at on %s', t);
    execute format('create trigger set_updated_at before update on %s for each row execute function app.set_updated_at()', t);
  end if;
  perform app.attach_audit(tbl);
end;
$$;

-- Home: the member's own household rows (billing module required).
create or replace function app.household_billing_policy(tbl regclass, column_name text default 'household_id')
returns void
language plpgsql
set search_path = ''
as $$
declare
  n text := (select c.relname from pg_catalog.pg_class c where c.oid = tbl);
begin
  execute format('drop policy if exists %I on %s', n || '_household_select', tbl::text);
  execute format(
    'create policy %I on %s for select to authenticated using (tenant_id = (select app.tenant_id()) and (select app.has_module(%L)) and %I = any ((select app.household_ids())::uuid[]))',
    n || '_household_select', tbl::text, 'billing', column_name);
end;
$$;

-- ---------------------------------------------------------------------------------------------
create table public.tax_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  location_id uuid,
  name text not null,
  rate numeric(6, 4) not null check (rate >= 0 and rate < 1),
  applies_to text[] not null default '{retail}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.tax_rates', 'settings.manage', null, 'billing');

create table public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  kind text not null check (kind in ('recurring', 'paid_in_full', 'contract', 'drop_in', 'class_pack', 'trial')),
  interval text check (interval in ('week', 'month', 'year')),
  interval_count int not null default 1 check (interval_count between 1 and 12),
  price_cents int not null check (price_cents >= 0),
  enrollment_fee_cents int not null default 0 check (enrollment_fee_cents >= 0),
  contract_months int check (contract_months is null or contract_months between 1 and 60),
  early_termination_fee_cents int check (early_termination_fee_cents is null or early_termination_fee_cents >= 0),
  auto_renew boolean not null default true,
  term_months int check (term_months is null or term_months between 1 and 60),
  class_pack_size int check (class_pack_size is null or class_pack_size > 0),
  trial_days int check (trial_days is null or trial_days > 0),
  program_ids uuid[] not null default '{}',
  attendance_rule jsonb not null default '{"unlimited": true}'::jsonb,
  family_discount jsonb not null default '{"second_pct": 0, "third_plus_pct": 0}'::jsonb,
  tax_class text not null default 'exempt',
  gear_package_product_ids uuid[] not null default '{}',
  public boolean not null default false,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind in ('recurring', 'contract')) = (interval is not null))
);
select app.setup_tenant_table('public.membership_plans', 'billing.charge', null, 'billing');
-- Members may see plans (Home shows what they're on / public plans).
create policy membership_plans_member_select on public.membership_plans for select to authenticated
  using (tenant_id = (select app.tenant_id()) and (select app.has_module('billing')));

create table public.discounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  code extensions.citext,
  name text not null,
  kind text not null check (kind in ('pct', 'amount')),
  value int not null check (value > 0),
  applies_to text not null default 'membership' check (applies_to in ('membership', 'invoice', 'retail', 'event')),
  max_uses int,
  uses int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code),
  check (kind <> 'pct' or value <= 100)
);
select app.setup_tenant_table('public.discounts', 'billing.charge', 'billing.read', 'billing');

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  household_id uuid not null,
  stripe_payment_method_id text not null,
  kind text not null check (kind in ('card', 'us_bank_account')),
  brand text,
  last4 text,
  exp_month int,
  exp_year int,
  is_default boolean not null default false,
  status text not null default 'active' check (status in ('active', 'detached', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, stripe_payment_method_id),
  foreign key (tenant_id, household_id) references public.households (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.payment_methods', 'billing.charge', 'billing.read', 'billing');
select app.household_billing_policy('public.payment_methods');

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  household_id uuid not null,
  person_id uuid not null,
  plan_id uuid not null,
  status text not null default 'pending' check (status in ('trial', 'active', 'past_due', 'suspended', 'on_hold', 'cancelled', 'expired', 'pending')),
  starts_at date not null,
  ends_at date,
  billing_day int check (billing_day between 1 and 28),
  next_bill_at date,
  hold_from date,
  hold_until date,
  cancel_at date,
  cancel_reason text,
  contract_ends_at date,
  price_override_cents int check (price_override_cents is null or price_override_cents >= 0),
  discount_ids uuid[] not null default '{}',
  autopay boolean not null default false,
  payment_method_id uuid,
  class_pack_remaining int,
  stripe_subscription_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, household_id) references public.households (tenant_id, id) on delete cascade,
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade,
  foreign key (tenant_id, plan_id) references public.membership_plans (tenant_id, id),
  foreign key (tenant_id, payment_method_id) references public.payment_methods (tenant_id, id) on delete set null (payment_method_id)
);
select app.setup_tenant_table('public.memberships', 'billing.charge', 'billing.read', 'billing');
select app.household_billing_policy('public.memberships');
create index memberships_next_bill on public.memberships (tenant_id, next_bill_at) where status in ('active', 'past_due', 'trial');

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  household_id uuid not null,
  person_id uuid,
  membership_id uuid,
  number bigint not null,
  status text not null default 'open' check (status in ('draft', 'open', 'paid', 'partially_paid', 'past_due', 'void', 'refunded')),
  issued_at timestamptz not null default now(),
  due_at date not null default current_date,
  period_start date,
  period_end date,
  subtotal_cents int not null default 0,
  discount_cents int not null default 0,
  tax_cents int not null default 0,
  total_cents int not null default 0,
  paid_cents int not null default 0,
  balance_cents int not null default 0,
  currency char(3) not null default 'USD',
  source text not null default 'manual' check (source in ('billing_run', 'manual', 'pos', 'event', 'testing', 'enrollment')),
  memo text,
  dunning_state jsonb not null default '{}'::jsonb,
  stripe_payment_intent_id text,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, number),
  -- Billing-run idempotency: one invoice per membership period.
  unique (membership_id, period_start),
  foreign key (tenant_id, household_id) references public.households (tenant_id, id) on delete cascade,
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete set null (person_id),
  foreign key (tenant_id, membership_id) references public.memberships (tenant_id, id) on delete set null (membership_id)
);
select app.setup_tenant_table('public.invoices', 'billing.charge', 'billing.read', 'billing');
select app.household_billing_policy('public.invoices');
create index invoices_status_due on public.invoices (tenant_id, status, due_at);

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  invoice_id uuid not null,
  kind text not null check (kind in ('membership', 'fee', 'product', 'event', 'testing', 'adjustment', 'tax', 'discount')),
  description text not null,
  quantity int not null default 1,
  unit_cents int not null,
  total_cents int not null,
  ref_type text,
  ref_id uuid,
  tax_rate numeric(6, 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, invoice_id) references public.invoices (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.invoice_lines', 'billing.charge', 'billing.read', 'billing');
create policy invoice_lines_household_select on public.invoice_lines for select to authenticated
  using (tenant_id = (select app.tenant_id()) and (select app.has_module('billing')) and invoice_id in (select id from public.invoices));

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  household_id uuid not null,
  invoice_id uuid,
  amount_cents int not null check (amount_cents > 0),
  refunded_cents int not null default 0 check (refunded_cents >= 0),
  method text not null check (method in ('card', 'ach', 'cash', 'check', 'external', 'credit', 'terminal')),
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded')),
  stripe_payment_intent_id text,
  stripe_charge_id text,
  payment_method_id uuid,
  received_at timestamptz not null default now(),
  received_by_user_id uuid references auth.users (id) on delete set null,
  failure_code text,
  failure_message text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (refunded_cents <= amount_cents),
  unique (tenant_id, stripe_payment_intent_id),
  foreign key (tenant_id, household_id) references public.households (tenant_id, id) on delete cascade,
  foreign key (tenant_id, invoice_id) references public.invoices (tenant_id, id) on delete set null (invoice_id),
  foreign key (tenant_id, payment_method_id) references public.payment_methods (tenant_id, id) on delete set null (payment_method_id)
);
select app.setup_tenant_table('public.payments', 'billing.charge', 'billing.read', 'billing');
select app.household_billing_policy('public.payments');

-- Positive = payment applied to an invoice; negative = refund reversing it.
create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  payment_id uuid not null,
  invoice_id uuid not null,
  amount_cents int not null check (amount_cents <> 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, payment_id) references public.payments (tenant_id, id) on delete cascade,
  foreign key (tenant_id, invoice_id) references public.invoices (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.payment_allocations', 'billing.charge', 'billing.read', 'billing');

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  payment_id uuid not null,
  amount_cents int not null check (amount_cents > 0),
  reason text not null,
  stripe_refund_id text,
  status text not null default 'succeeded' check (status in ('pending', 'succeeded', 'failed')),
  as_credit boolean not null default false,
  by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, payment_id) references public.payments (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.refunds', 'billing.refund', 'billing.read', 'billing');

create table public.credits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  household_id uuid not null,
  amount_cents int not null check (amount_cents > 0),
  remaining_cents int not null check (remaining_cents >= 0),
  reason text not null,
  expires_at date,
  source_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (remaining_cents <= amount_cents),
  foreign key (tenant_id, household_id) references public.households (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.credits', 'billing.charge', 'billing.read', 'billing');
select app.household_billing_policy('public.credits');

create table public.dunning_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  steps jsonb not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.setup_tenant_table('public.dunning_policies', 'settings.manage', 'billing.read', 'billing');
create unique index dunning_one_default on public.dunning_policies (tenant_id) where is_default;

create table public.billing_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  run_date date not null,
  status text not null default 'running' check (status in ('running', 'ok', 'error')),
  invoices_created int not null default 0,
  amount_cents int not null default 0,
  charges_attempted int not null default 0,
  errors jsonb not null default '[]'::jsonb,
  job_run_id uuid references public.job_runs (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.setup_tenant_table('public.billing_runs', null, 'billing.read', 'billing');

-- Stripe webhook idempotency (platform-level; written only by the webhook route).
create table public.stripe_events (
  id text primary key,
  type text not null,
  account_id text,
  livemode boolean not null default false,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
create policy stripe_events_admin_select on public.stripe_events for select to authenticated using ((select app.is_platform_admin()));

-- ---------------------------------------------------------------------------------------------
-- Invoice state from allocations (paid/balance/status) and household balance.
-- ---------------------------------------------------------------------------------------------
create or replace function app.invoice_status_for(p_status text, p_total int, p_paid int, p_due date, p_had_payment boolean)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_status in ('void', 'draft') then p_status
    when p_paid >= p_total and p_total > 0 then 'paid'
    when p_total = 0 then 'paid'
    when p_paid <= 0 and p_had_payment then 'refunded'
    when p_paid > 0 then case when p_due < current_date then 'past_due' else 'partially_paid' end
    when p_due < current_date then 'past_due'
    else 'open'
  end;
$$;

create or replace function app.recompute_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  paid int;
  had boolean;
begin
  select coalesce(sum(amount_cents), 0), bool_or(amount_cents > 0) into paid, had from public.payment_allocations where invoice_id = p_invoice_id;
  update public.invoices i
     set paid_cents = paid,
         balance_cents = greatest(i.total_cents - paid, 0),
         status = app.invoice_status_for(i.status, i.total_cents, paid, i.due_at, coalesce(had, false))
   where i.id = p_invoice_id;
end;
$$;

create or replace function app.recompute_household_balance(p_household_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.households h set balance_cents =
    coalesce((select sum(balance_cents) from public.invoices where household_id = h.id and status in ('open', 'partially_paid', 'past_due')), 0)
    - coalesce((select sum(remaining_cents) from public.credits where household_id = h.id and (expires_at is null or expires_at >= current_date)), 0)
  where h.id = p_household_id;
$$;

create or replace function app.allocation_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.recompute_invoice(coalesce(new.invoice_id, old.invoice_id));
  return null;
end;
$$;
create trigger allocation_changed after insert or update or delete on public.payment_allocations
  for each row execute function app.allocation_changed();

create or replace function app.invoice_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.total_cents is distinct from old.total_cents or new.due_at is distinct from old.due_at
     or (new.status = 'void') is distinct from (old.status = 'void')) then
    perform app.recompute_invoice(new.id);
  end if;
  perform app.recompute_household_balance(coalesce(new.household_id, old.household_id));
  return null;
end;
$$;
create trigger invoice_changed after insert or update or delete on public.invoices
  for each row execute function app.invoice_changed();

create or replace function app.credit_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.recompute_household_balance(coalesce(new.household_id, old.household_id));
  return null;
end;
$$;
create trigger credit_changed after insert or update or delete on public.credits
  for each row execute function app.credit_changed();

-- Next invoice number for the caller's tenant (billing.charge) — used by server actions and the run.
create or replace function public.next_invoice_number()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.tenant_id() is null or not (app.has_permission('billing.charge') or app.has_permission('retail.sell')) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return app.next_counter(app.tenant_id(), 'invoice');
end;
$$;
revoke execute on function public.next_invoice_number() from public, anon;
grant execute on function public.next_invoice_number() to authenticated;
create or replace function public.next_invoice_number_for(p_tenant_id uuid)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select app.next_counter(p_tenant_id, 'invoice');
$$;
revoke execute on function public.next_invoice_number_for(uuid) from public, anon, authenticated;
grant execute on function public.next_invoice_number_for(uuid) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------------------------
create view public.v_household_balance with (security_invoker = true) as
  select h.tenant_id, h.id as household_id, h.name,
         coalesce(sum(i.balance_cents) filter (where i.status in ('open', 'partially_paid', 'past_due')), 0)::int as open_cents,
         coalesce(sum(i.balance_cents) filter (where i.status = 'past_due'), 0)::int as past_due_cents,
         (select coalesce(sum(c.remaining_cents), 0) from public.credits c where c.household_id = h.id and (c.expires_at is null or c.expires_at >= current_date))::int as credit_cents
  from public.households h
  left join public.invoices i on i.household_id = h.id
  group by h.tenant_id, h.id, h.name;

create view public.v_ar_aging with (security_invoker = true) as
  select i.tenant_id, i.id as invoice_id, i.number, i.household_id, h.name as household_name, i.due_at, i.total_cents, i.balance_cents, i.status,
         greatest(current_date - i.due_at, 0) as days_overdue,
         case when current_date - i.due_at <= 0 then 'current'
              when current_date - i.due_at <= 30 then '1-30'
              when current_date - i.due_at <= 60 then '31-60'
              when current_date - i.due_at <= 90 then '61-90'
              else '90+' end as bucket,
         coalesce((i.dunning_state ->> 'stage')::int, 0) as dunning_stage
  from public.invoices i
  join public.households h on h.id = i.household_id
  where i.status in ('open', 'partially_paid', 'past_due') and i.balance_cents > 0;

-- Monthly recurring revenue: active recurring/contract memberships normalised to a month.
create view public.v_mrr with (security_invoker = true) as
  select m.tenant_id, m.id as membership_id, m.household_id, m.person_id, p.name as plan_name, p.program_ids,
         round(coalesce(m.price_override_cents, p.price_cents) *
           case p.interval when 'week' then 52.0 / 12 when 'month' then 1 when 'year' then 1.0 / 12 else 0 end / p.interval_count)::int as mrr_cents
  from public.memberships m
  join public.membership_plans p on p.id = m.plan_id
  where m.status in ('active', 'past_due') and p.kind in ('recurring', 'contract');

select app.index_foreign_keys();
