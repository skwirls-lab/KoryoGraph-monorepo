-- 0030 Stripe → ledger bridge (F7.8). Stripe objects (as JSON retrieved server-side or delivered by a signed
-- webhook) are folded into payments / payment_methods / refunds by these functions, idempotently: the same
-- PaymentIntent or refund applied twice changes nothing. Allocation to invoices and unapplied cash (as a
-- household credit) happen here too, so every path (Desk charge, webhook, reconciliation) agrees.

-- Helper: a Stripe expandable field is either an id string or an object with an id.
create or replace function app.stripe_id(p jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case jsonb_typeof(p) when 'string' then p #>> '{}' when 'object' then p ->> 'id' end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Payment methods
-- ---------------------------------------------------------------------------------------------
create or replace function app.record_payment_method(p_tenant uuid, p_household uuid, p_pm jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  kind text := case p_pm ->> 'type' when 'card' then 'card' when 'us_bank_account' then 'us_bank_account' end;
  pmid uuid;
begin
  if kind is null then
    raise exception 'unsupported payment method type %', p_pm ->> 'type' using errcode = '22023';
  end if;
  if not exists (select 1 from public.households where id = p_household and tenant_id = p_tenant) then
    raise exception 'household not found' using errcode = 'P0002';
  end if;
  insert into public.payment_methods (tenant_id, household_id, stripe_payment_method_id, kind, brand, last4, exp_month, exp_year, status)
  values (
    p_tenant, p_household, p_pm ->> 'id', kind,
    coalesce(p_pm #>> '{card,brand}', p_pm #>> '{us_bank_account,bank_name}'),
    coalesce(p_pm #>> '{card,last4}', p_pm #>> '{us_bank_account,last4}'),
    (p_pm #>> '{card,exp_month}')::int, (p_pm #>> '{card,exp_year}')::int, 'active')
  on conflict (tenant_id, stripe_payment_method_id) do update
    set brand = excluded.brand, last4 = excluded.last4, exp_month = excluded.exp_month, exp_year = excluded.exp_year,
        status = 'active', household_id = excluded.household_id
  returning id into pmid;
  -- The first active method becomes the household default (autopay uses it).
  if not exists (select 1 from public.payment_methods where household_id = p_household and is_default and status = 'active') then
    update public.payment_methods set is_default = true where id = pmid;
  end if;
  return pmid;
end;
$$;

-- Staff with billing.charge, or a Home member for their own household. The method must belong to the
-- household's Stripe customer (callers pass the object retrieved from Stripe, never browser input).
create or replace function public.record_payment_method(p_household_id uuid, p_pm jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  cust text;
begin
  if app.tenant_id() is null or not app.has_module('billing')
     or not (app.has_permission('billing.charge') or p_household_id = any (app.household_ids())) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select stripe_customer_id into cust from public.households where id = p_household_id and tenant_id = app.tenant_id();
  if cust is null or cust is distinct from app.stripe_id(p_pm -> 'customer') then
    raise exception 'payment method does not belong to this household' using errcode = '42501';
  end if;
  return app.record_payment_method(app.tenant_id(), p_household_id, p_pm);
end;
$$;

create or replace function public.record_payment_method_for(p_tenant_id uuid, p_household_id uuid, p_pm jsonb)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select app.record_payment_method(p_tenant_id, p_household_id, p_pm);
$$;

create or replace function public.set_default_payment_method(p_payment_method_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  hh uuid;
begin
  select household_id into hh from public.payment_methods
   where id = p_payment_method_id and tenant_id = app.tenant_id() and status = 'active';
  if hh is null or not app.has_module('billing') or not (app.has_permission('billing.charge') or hh = any (app.household_ids())) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.payment_methods set is_default = (id = p_payment_method_id) where household_id = hh and (is_default or id = p_payment_method_id);
end;
$$;

-- Link a household to its Stripe Customer on the tenant's connected account (set once; staff may relink).
create or replace function public.set_household_stripe_customer(p_household_id uuid, p_customer_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cur text;
begin
  if app.tenant_id() is null or not app.has_module('billing')
     or not (app.has_permission('billing.charge') or p_household_id = any (app.household_ids())) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select stripe_customer_id into cur from public.households where id = p_household_id and tenant_id = app.tenant_id();
  if not found then
    raise exception 'household not found' using errcode = 'P0002';
  end if;
  if cur is not null and cur <> p_customer_id and not app.has_permission('billing.charge') then
    raise exception 'household already has a Stripe customer' using errcode = '42501';
  end if;
  update public.households set stripe_customer_id = p_customer_id where id = p_household_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Payment intents → payments (+ allocation to the invoice, remainder as household credit)
-- ---------------------------------------------------------------------------------------------
create or replace function app.record_payment_intent(p_tenant uuid, p_pi jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(p_pi -> 'metadata', '{}'::jsonb);
  pi_status text := p_pi ->> 'status';
  hh uuid;
  inv uuid;
  st text;
  amt int;
  pm uuid;
  pay_id uuid;
  prev text;
  bal int;
  alloc int := 0;
  err jsonb := case when jsonb_typeof(p_pi -> 'last_payment_error') = 'object' then p_pi -> 'last_payment_error' end;
  pay_method text := case when meta ->> 'method' = 'terminal' then 'terminal' when meta ->> 'method' = 'ach' then 'ach' else 'card' end;
begin
  if meta ->> 'household_id' ~* '^[0-9a-f-]{36}$' then
    select id into hh from public.households where id = (meta ->> 'household_id')::uuid and tenant_id = p_tenant;
  end if;
  if hh is null then
    select id into hh from public.households where tenant_id = p_tenant and stripe_customer_id = app.stripe_id(p_pi -> 'customer') limit 1;
  end if;
  if hh is null then
    return null; -- not a KoryoGraph charge (e.g. made directly in the school's Stripe dashboard)
  end if;
  if meta ->> 'invoice_id' ~* '^[0-9a-f-]{36}$' then
    select id into inv from public.invoices where id = (meta ->> 'invoice_id')::uuid and tenant_id = p_tenant and household_id = hh;
  end if;

  st := case
    when pi_status = 'succeeded' then 'succeeded'
    when pi_status = 'canceled' then 'failed'
    when pi_status = 'requires_payment_method' and err is not null then 'failed'
    else 'pending'
  end;
  amt := case when st = 'succeeded' then coalesce((p_pi ->> 'amount_received')::int, (p_pi ->> 'amount')::int) else (p_pi ->> 'amount')::int end;
  if amt is null or amt <= 0 then
    raise exception 'payment intent has no amount' using errcode = '22023';
  end if;
  select id into pm from public.payment_methods
   where tenant_id = p_tenant and stripe_payment_method_id = coalesce(app.stripe_id(p_pi -> 'payment_method'), err #>> '{payment_method,id}');

  select id, status into pay_id, prev from public.payments
   where tenant_id = p_tenant and stripe_payment_intent_id = p_pi ->> 'id' for update;
  if pay_id is null then
    if pi_status = 'canceled' or (st = 'pending' and pi_status in ('requires_payment_method', 'requires_confirmation', 'requires_action')) then
      return null; -- abandoned or never-confirmed intents are not ledger facts
    end if;
    insert into public.payments (tenant_id, household_id, invoice_id, amount_cents, method, status, stripe_payment_intent_id,
                                 stripe_charge_id, payment_method_id, failure_code, failure_message, memo)
    values (p_tenant, hh, inv, amt, pay_method, st, p_pi ->> 'id', app.stripe_id(p_pi -> 'latest_charge'), pm,
            case when st = 'failed' then coalesce(err ->> 'decline_code', err ->> 'code', 'canceled') end,
            case when st = 'failed' then coalesce(err ->> 'message', 'The payment was canceled.') end,
            nullif(p_pi ->> 'description', ''))
    on conflict (tenant_id, stripe_payment_intent_id) do nothing
    returning id into pay_id;
    if pay_id is null then
      -- A concurrent delivery inserted it first; apply this one as an update.
      select id, status into pay_id, prev from public.payments
       where tenant_id = p_tenant and stripe_payment_intent_id = p_pi ->> 'id' for update;
    end if;
  end if;

  if prev is not null then
    if prev in ('succeeded', 'refunded', 'partially_refunded') then
      -- Never regress a settled payment (events can arrive out of order).
      update public.payments set stripe_charge_id = coalesce(stripe_charge_id, app.stripe_id(p_pi -> 'latest_charge')) where id = pay_id;
      return pay_id;
    end if;
    update public.payments
       set status = st, amount_cents = amt,
           stripe_charge_id = coalesce(app.stripe_id(p_pi -> 'latest_charge'), stripe_charge_id),
           payment_method_id = coalesce(pm, payment_method_id),
           failure_code = case when st = 'failed' then coalesce(err ->> 'decline_code', err ->> 'code', 'canceled') end,
           failure_message = case when st = 'failed' then coalesce(err ->> 'message', 'The payment was canceled.') end,
           received_at = case when st = 'succeeded' then now() else received_at end
     where id = pay_id;
  end if;

  if st = 'succeeded' then
    if inv is not null then
      select balance_cents into bal from public.invoices where id = inv and status not in ('void', 'draft') for update;
      alloc := least(amt, coalesce(bal, 0));
      if alloc > 0 then
        insert into public.payment_allocations (tenant_id, payment_id, invoice_id, amount_cents) values (p_tenant, pay_id, inv, alloc);
      end if;
    end if;
    if amt - alloc > 0 then
      insert into public.credits (tenant_id, household_id, amount_cents, remaining_cents, reason, source_ref)
      values (p_tenant, hh, amt - alloc, amt - alloc, 'Unapplied payment', 'payment:' || pay_id);
    end if;
  end if;
  return pay_id;
end;
$$;

create or replace function public.record_payment_intent(p_pi jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.tenant_id() is null or not app.has_module('billing') or not app.has_permission('billing.charge') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return app.record_payment_intent(app.tenant_id(), p_pi);
end;
$$;

create or replace function public.record_payment_intent_for(p_tenant_id uuid, p_pi jsonb)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select app.record_payment_intent(p_tenant_id, p_pi);
$$;

-- ---------------------------------------------------------------------------------------------
-- Refunds: reverse unapplied credit first, then invoice allocations (newest first).
-- ---------------------------------------------------------------------------------------------
create or replace function app.apply_refund(p_tenant uuid, p_payment_id uuid, p_amount int, p_reason text, p_stripe_refund_id text, p_by uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.payments;
  rid uuid;
  remaining int := p_amount;
  take int;
  c record;
  a record;
begin
  select * into p from public.payments where id = p_payment_id and tenant_id = p_tenant for update;
  if not found then
    raise exception 'payment not found' using errcode = 'P0002';
  end if;
  if p_stripe_refund_id is not null then
    select id into rid from public.refunds where tenant_id = p_tenant and stripe_refund_id = p_stripe_refund_id;
    if rid is not null then
      return rid;
    end if;
  end if;
  if p.status not in ('succeeded', 'partially_refunded') then
    raise exception 'only settled payments can be refunded' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 or p.refunded_cents + p_amount > p.amount_cents then
    raise exception 'refund must be between 1 and % cents', p.amount_cents - p.refunded_cents using errcode = '22023';
  end if;

  insert into public.refunds (tenant_id, payment_id, amount_cents, reason, stripe_refund_id, status, by_user_id)
  values (p_tenant, p_payment_id, p_amount, coalesce(nullif(trim(p_reason), ''), 'Refund'), p_stripe_refund_id, 'succeeded', p_by)
  returning id into rid;
  update public.payments
     set refunded_cents = refunded_cents + p_amount,
         status = case when refunded_cents + p_amount >= amount_cents then 'refunded' else 'partially_refunded' end
   where id = p_payment_id;

  for c in select id, remaining_cents from public.credits
            where tenant_id = p_tenant and source_ref = 'payment:' || p_payment_id and remaining_cents > 0 order by created_at desc for update loop
    exit when remaining <= 0;
    take := least(remaining, c.remaining_cents);
    update public.credits set remaining_cents = remaining_cents - take where id = c.id;
    remaining := remaining - take;
  end loop;

  for a in select invoice_id, sum(amount_cents)::int as net, max(created_at) as last_at from public.payment_allocations
            where payment_id = p_payment_id group by invoice_id having sum(amount_cents) > 0 order by max(created_at) desc loop
    exit when remaining <= 0;
    take := least(remaining, a.net);
    insert into public.payment_allocations (tenant_id, payment_id, invoice_id, amount_cents) values (p_tenant, p_payment_id, a.invoice_id, -take);
    remaining := remaining - take;
  end loop;
  return rid;
end;
$$;

create or replace function public.record_refund(p_payment_id uuid, p_amount_cents int, p_reason text, p_stripe_refund_id text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.tenant_id() is null or not app.has_module('billing') or not app.has_permission('billing.refund') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return app.apply_refund(app.tenant_id(), p_payment_id, p_amount_cents, p_reason, p_stripe_refund_id, auth.uid());
end;
$$;

-- charge.refunded: bring the ledger up to Stripe's amount_refunded (refunds made in the Stripe dashboard;
-- refunds made in KoryoGraph are already recorded, so the difference is zero).
create or replace function app.record_charge_refund(p_tenant uuid, p_charge jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay public.payments;
  recorded int;
  total int := coalesce((p_charge ->> 'amount_refunded')::int, 0);
begin
  select * into pay from public.payments
   where tenant_id = p_tenant
     and (stripe_charge_id = p_charge ->> 'id' or stripe_payment_intent_id = app.stripe_id(p_charge -> 'payment_intent'))
   order by created_at limit 1 for update;
  if not found then
    return null;
  end if;
  select coalesce(sum(amount_cents), 0) into recorded from public.refunds where payment_id = pay.id and status = 'succeeded';
  if total > recorded then
    return app.apply_refund(p_tenant, pay.id, least(total, pay.amount_cents) - recorded, 'Refunded in Stripe', null, null);
  end if;
  return null;
end;
$$;

create or replace function public.record_charge_refund_for(p_tenant_id uuid, p_charge jsonb)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select app.record_charge_refund(p_tenant_id, p_charge);
$$;

revoke execute on function
  public.record_payment_method(uuid, jsonb), public.set_default_payment_method(uuid), public.set_household_stripe_customer(uuid, text),
  public.record_payment_intent(jsonb), public.record_refund(uuid, int, text, text)
  from public, anon;
grant execute on function
  public.record_payment_method(uuid, jsonb), public.set_default_payment_method(uuid), public.set_household_stripe_customer(uuid, text),
  public.record_payment_intent(jsonb), public.record_refund(uuid, int, text, text)
  to authenticated;
revoke execute on function
  public.record_payment_method_for(uuid, uuid, jsonb), public.record_payment_intent_for(uuid, jsonb), public.record_charge_refund_for(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function
  public.record_payment_method_for(uuid, uuid, jsonb), public.record_payment_intent_for(uuid, jsonb), public.record_charge_refund_for(uuid, jsonb)
  to service_role;
revoke execute on function app.stripe_id(jsonb), app.record_payment_method(uuid, uuid, jsonb), app.record_payment_intent(uuid, jsonb),
  app.apply_refund(uuid, uuid, int, text, text, uuid), app.record_charge_refund(uuid, jsonb) from public;

create index payments_stripe_charge on public.payments (tenant_id, stripe_charge_id) where stripe_charge_id is not null;
create index credits_source_ref on public.credits (tenant_id, source_ref) where source_ref is not null;
create unique index refunds_stripe_refund on public.refunds (tenant_id, stripe_refund_id) where stripe_refund_id is not null;
create unique index tenants_stripe_account on public.tenants (stripe_account_id) where stripe_account_id is not null;

select app.index_foreign_keys();
