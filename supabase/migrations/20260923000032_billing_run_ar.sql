-- 0032 Billing run, AR operations and credit notes (F7.4, F7.6).

-- Every refund is documented by a numbered credit note (per-tenant sequence).
alter table public.refunds add column credit_note_number bigint;
create unique index refunds_credit_note on public.refunds (tenant_id, credit_note_number) where credit_note_number is not null;

-- ---------------------------------------------------------------------------------------------
-- Billing run (service role): one invoice per (membership, period), created atomically with the
-- membership's next_bill_at advance. A re-run finds the unique (membership_id, period_start) and the
-- advanced next_bill_at, so it can never double-bill.
-- p = { membership_id, household_id, person_id, period_start, period_end, next_bill_at, due_at,
--       subtotal_cents, discount_cents, tax_cents, total_cents, lines: [...] }
-- ---------------------------------------------------------------------------------------------
create or replace function public.billing_run_invoice(p_tenant_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv uuid;
  line jsonb;
  mid uuid := (p ->> 'membership_id')::uuid;
begin
  if (select coalesce(sum((l ->> 'total_cents')::int), 0) from jsonb_array_elements(p -> 'lines') l) <> (p ->> 'total_cents')::int then
    raise exception 'invoice lines do not add up to the total' using errcode = '22023';
  end if;
  insert into public.invoices (tenant_id, household_id, person_id, membership_id, number, status, due_at, period_start, period_end,
                               subtotal_cents, discount_cents, tax_cents, total_cents, source)
  select p_tenant_id, (p ->> 'household_id')::uuid, (p ->> 'person_id')::uuid, mid, app.next_counter(p_tenant_id, 'invoice'), 'open',
         (p ->> 'due_at')::date, (p ->> 'period_start')::date, (p ->> 'period_end')::date,
         (p ->> 'subtotal_cents')::int, (p ->> 'discount_cents')::int, (p ->> 'tax_cents')::int, (p ->> 'total_cents')::int, 'billing_run'
  where not exists (select 1 from public.invoices where membership_id = mid and period_start = (p ->> 'period_start')::date)
  on conflict (membership_id, period_start) do nothing
  returning id into inv;
  if inv is not null then
    for line in select * from jsonb_array_elements(p -> 'lines') loop
      insert into public.invoice_lines (tenant_id, invoice_id, kind, description, quantity, unit_cents, total_cents, ref_type, ref_id, tax_rate)
      values (p_tenant_id, inv, line ->> 'kind', line ->> 'description', coalesce((line ->> 'quantity')::int, 1), (line ->> 'unit_cents')::int,
              (line ->> 'total_cents')::int, case when line ->> 'kind' = 'membership' then 'membership' end,
              case when line ->> 'kind' = 'membership' then mid end, nullif(line ->> 'tax_rate', '')::numeric);
    end loop;
  end if;
  -- Advance only from the period we just billed (an already-advanced membership is left alone).
  update public.memberships set next_bill_at = (p ->> 'next_bill_at')::date
   where id = mid and tenant_id = p_tenant_id and next_bill_at = (p ->> 'period_start')::date;
  return inv;
end;
$$;

-- Status transitions that depend only on dates, plus past-due marking. Returns counts.
create or replace function public.billing_lifecycle(p_tenant_id uuid, p_today date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  n_cancelled int;
  n_expired int;
  n_hold int;
  n_resumed int;
  n_past_due int;
begin
  update public.memberships set status = 'cancelled'
   where tenant_id = p_tenant_id and cancel_at is not null and cancel_at <= p_today and status not in ('cancelled', 'expired');
  get diagnostics n_cancelled = row_count;
  update public.memberships m set status = 'expired'
    from public.membership_plans pl
   where m.tenant_id = p_tenant_id and pl.id = m.plan_id and m.status in ('active', 'trial', 'past_due')
     and ((m.ends_at is not null and m.ends_at <= p_today and pl.kind not in ('recurring', 'contract'))
       or (pl.kind = 'contract' and not pl.auto_renew and m.contract_ends_at is not null and m.contract_ends_at <= p_today));
  get diagnostics n_expired = row_count;
  update public.memberships set status = 'on_hold'
   where tenant_id = p_tenant_id and status = 'active' and hold_from is not null and hold_from <= p_today and (hold_until is null or hold_until > p_today);
  get diagnostics n_hold = row_count;
  update public.memberships set status = 'active', hold_from = null, hold_until = null
   where tenant_id = p_tenant_id and status = 'on_hold' and hold_until is not null and hold_until <= p_today;
  get diagnostics n_resumed = row_count;
  update public.invoices set status = 'past_due'
   where tenant_id = p_tenant_id and status in ('open', 'partially_paid') and due_at < p_today and balance_cents > 0;
  get diagnostics n_past_due = row_count;
  return jsonb_build_object('cancelled', n_cancelled, 'expired', n_expired, 'on_hold', n_hold, 'resumed', n_resumed, 'past_due', n_past_due);
end;
$$;

revoke execute on function public.billing_run_invoice(uuid, jsonb), public.billing_lifecycle(uuid, date) from public, anon, authenticated;
grant execute on function public.billing_run_invoice(uuid, jsonb), public.billing_lifecycle(uuid, date) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Desk AR operations (billing.charge unless noted). All re-check tenant + module + permission.
-- ---------------------------------------------------------------------------------------------
create or replace function app.require_billing(p_permission text)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
begin
  if app.tenant_id() is null or not app.has_module('billing') or not app.has_permission(p_permission) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return app.tenant_id();
end;
$$;

-- Cash / check / external payment against an invoice; any overpayment becomes household credit.
create or replace function public.record_manual_payment(p_invoice_id uuid, p_amount_cents int, p_method text, p_memo text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.require_billing('billing.charge');
  inv public.invoices;
  pid uuid;
  alloc int;
begin
  if p_method not in ('cash', 'check', 'external') then
    raise exception 'unsupported method' using errcode = '22023';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'amount must be positive' using errcode = '22023';
  end if;
  select * into inv from public.invoices where id = p_invoice_id and tenant_id = tid for update;
  if not found then
    raise exception 'invoice not found' using errcode = 'P0002';
  end if;
  if inv.status in ('void', 'draft') then
    raise exception 'this invoice can''t take payments' using errcode = '22023';
  end if;
  insert into public.payments (tenant_id, household_id, invoice_id, amount_cents, method, status, received_by_user_id, memo)
  values (tid, inv.household_id, inv.id, p_amount_cents, p_method, 'succeeded', auth.uid(), nullif(trim(p_memo), ''))
  returning id into pid;
  alloc := least(p_amount_cents, inv.balance_cents);
  if alloc > 0 then
    insert into public.payment_allocations (tenant_id, payment_id, invoice_id, amount_cents) values (tid, pid, inv.id, alloc);
  end if;
  if p_amount_cents > alloc then
    insert into public.credits (tenant_id, household_id, amount_cents, remaining_cents, reason, source_ref)
    values (tid, inv.household_id, p_amount_cents - alloc, p_amount_cents - alloc, 'Unapplied payment', 'payment:' || pid);
  end if;
  return pid;
end;
$$;

-- Spend household credit on an invoice (oldest-expiring first). Recorded as a 'credit' payment.
create or replace function public.apply_credit(p_invoice_id uuid, p_amount_cents int default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.require_billing('billing.charge');
  inv public.invoices;
  available int;
  want int;
  left_ int;
  take int;
  c record;
  pid uuid;
begin
  select * into inv from public.invoices where id = p_invoice_id and tenant_id = tid for update;
  if not found or inv.status in ('void', 'draft', 'paid') then
    raise exception 'invoice can''t take credit' using errcode = '22023';
  end if;
  select coalesce(sum(remaining_cents), 0) into available from public.credits
   where household_id = inv.household_id and remaining_cents > 0 and (expires_at is null or expires_at >= current_date);
  want := least(coalesce(p_amount_cents, inv.balance_cents), inv.balance_cents, available);
  if want <= 0 then
    raise exception 'no credit available' using errcode = '22023';
  end if;
  left_ := want;
  for c in select id, remaining_cents from public.credits
            where household_id = inv.household_id and remaining_cents > 0 and (expires_at is null or expires_at >= current_date)
            order by expires_at nulls last, created_at for update loop
    exit when left_ <= 0;
    take := least(left_, c.remaining_cents);
    update public.credits set remaining_cents = remaining_cents - take where id = c.id;
    left_ := left_ - take;
  end loop;
  insert into public.payments (tenant_id, household_id, invoice_id, amount_cents, method, status, received_by_user_id, memo)
  values (tid, inv.household_id, inv.id, want, 'credit', 'succeeded', auth.uid(), 'Account credit applied')
  returning id into pid;
  insert into public.payment_allocations (tenant_id, payment_id, invoice_id, amount_cents) values (tid, pid, inv.id, want);
  return pid;
end;
$$;

-- Add a charge, adjustment or discount line to an unpaid/part-paid invoice.
create or replace function public.add_invoice_line(p_invoice_id uuid, p_kind text, p_description text, p_quantity int, p_unit_cents int)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.require_billing('billing.charge');
  inv public.invoices;
  lid uuid;
  amount int := coalesce(p_quantity, 1) * p_unit_cents;
begin
  if p_kind not in ('fee', 'product', 'adjustment', 'discount', 'testing', 'event') or length(trim(coalesce(p_description, ''))) < 2 then
    raise exception 'invalid line' using errcode = '22023';
  end if;
  if coalesce(p_quantity, 1) < 1 or p_unit_cents = 0 or (p_kind = 'discount' and p_unit_cents > 0) or (p_kind not in ('discount', 'adjustment') and p_unit_cents < 0) then
    raise exception 'invalid amount' using errcode = '22023';
  end if;
  select * into inv from public.invoices where id = p_invoice_id and tenant_id = tid for update;
  if not found or inv.status in ('void', 'refunded') then
    raise exception 'this invoice can''t be changed' using errcode = '22023';
  end if;
  if inv.total_cents + amount < inv.paid_cents then
    raise exception 'the invoice total can''t go below what has been paid' using errcode = '22023';
  end if;
  insert into public.invoice_lines (tenant_id, invoice_id, kind, description, quantity, unit_cents, total_cents)
  values (tid, inv.id, p_kind, trim(p_description), coalesce(p_quantity, 1), p_unit_cents, amount)
  returning id into lid;
  update public.invoices
     set subtotal_cents = subtotal_cents + case when p_kind = 'discount' then 0 else amount end,
         discount_cents = discount_cents + case when p_kind = 'discount' then -amount else 0 end,
         total_cents = total_cents + amount,
         status = case when status = 'paid' then 'open' else status end
   where id = inv.id;
  return lid;
end;
$$;

create or replace function public.void_invoice(p_invoice_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.require_billing('billing.charge');
  inv public.invoices;
begin
  select * into inv from public.invoices where id = p_invoice_id and tenant_id = tid for update;
  if not found then
    raise exception 'invoice not found' using errcode = 'P0002';
  end if;
  if inv.paid_cents <> 0 then
    raise exception 'refund the payments before voiding this invoice' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'give a reason' using errcode = '22023';
  end if;
  update public.invoices set status = 'void', voided_at = now(), void_reason = trim(p_reason) where id = inv.id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Refunds now always carry a credit note number and may go to account credit instead of the card/cash.
-- ---------------------------------------------------------------------------------------------
drop function public.record_refund(uuid, int, text, text);
drop function app.record_charge_refund(uuid, jsonb) cascade;
drop function app.apply_refund(uuid, uuid, int, text, text, uuid);

create or replace function app.apply_refund(p_tenant uuid, p_payment_id uuid, p_amount int, p_reason text, p_stripe_refund_id text, p_by uuid, p_as_credit boolean default false)
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
  cn bigint;
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
  if p.method = 'credit' and not p_as_credit then
    raise exception 'a payment made from account credit can only be returned as credit' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 or p.refunded_cents + p_amount > p.amount_cents then
    raise exception 'refund must be between 1 and % cents', p.amount_cents - p.refunded_cents using errcode = '22023';
  end if;

  cn := app.next_counter(p_tenant, 'credit_note');
  insert into public.refunds (tenant_id, payment_id, amount_cents, reason, stripe_refund_id, status, by_user_id, as_credit, credit_note_number)
  values (p_tenant, p_payment_id, p_amount, coalesce(nullif(trim(p_reason), ''), 'Refund'), p_stripe_refund_id, 'succeeded', p_by, p_as_credit, cn)
  returning id into rid;
  update public.payments
     set refunded_cents = refunded_cents + p_amount,
         status = case when refunded_cents + p_amount >= amount_cents then 'refunded' else 'partially_refunded' end
   where id = p_payment_id;

  -- Money back: first give up any unapplied credit this payment created.
  if not p_as_credit then
    for c in select id, remaining_cents from public.credits
              where tenant_id = p_tenant and source_ref = 'payment:' || p_payment_id and remaining_cents > 0 order by created_at desc for update loop
      exit when remaining <= 0;
      take := least(remaining, c.remaining_cents);
      update public.credits set remaining_cents = remaining_cents - take where id = c.id;
      remaining := remaining - take;
    end loop;
  end if;

  for a in select invoice_id, sum(amount_cents)::int as net from public.payment_allocations
            where payment_id = p_payment_id group by invoice_id having sum(amount_cents) > 0 order by max(created_at) desc loop
    exit when remaining <= 0;
    take := least(remaining, a.net);
    insert into public.payment_allocations (tenant_id, payment_id, invoice_id, amount_cents) values (p_tenant, p_payment_id, a.invoice_id, -take);
    remaining := remaining - take;
  end loop;

  if p_as_credit then
    insert into public.credits (tenant_id, household_id, amount_cents, remaining_cents, reason, source_ref)
    values (p_tenant, p.household_id, p_amount, p_amount, 'Credit note CN-' || cn || ': ' || coalesce(nullif(trim(p_reason), ''), 'Refund'), 'refund:' || rid);
  end if;
  return rid;
end;
$$;

create or replace function public.record_refund(p_payment_id uuid, p_amount_cents int, p_reason text, p_stripe_refund_id text default null, p_as_credit boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require_billing('billing.refund');
  return app.apply_refund(app.tenant_id(), p_payment_id, p_amount_cents, p_reason, p_stripe_refund_id, auth.uid(), p_as_credit);
end;
$$;

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
  select coalesce(sum(amount_cents), 0) into recorded from public.refunds where payment_id = pay.id and status = 'succeeded' and not as_credit;
  if total > recorded then
    return app.apply_refund(p_tenant, pay.id, least(total, pay.amount_cents) - recorded, 'Refunded in Stripe', null, null, false);
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
  public.record_manual_payment(uuid, int, text, text), public.apply_credit(uuid, int), public.add_invoice_line(uuid, text, text, int, int),
  public.void_invoice(uuid, text), public.record_refund(uuid, int, text, text, boolean)
  from public, anon;
grant execute on function
  public.record_manual_payment(uuid, int, text, text), public.apply_credit(uuid, int), public.add_invoice_line(uuid, text, text, int, int),
  public.void_invoice(uuid, text), public.record_refund(uuid, int, text, text, boolean)
  to authenticated;
revoke execute on function public.record_charge_refund_for(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.record_charge_refund_for(uuid, jsonb) to service_role;
revoke execute on function app.require_billing(text), app.apply_refund(uuid, uuid, int, text, text, uuid, boolean), app.record_charge_refund(uuid, jsonb) from public;

-- Invoice timeline for the Desk: payments, refunds (credit notes) and allocations in time order.
create view public.v_invoice_activity with (security_invoker = true) as
  select pa.tenant_id, pa.invoice_id, pa.created_at as at, case when pa.amount_cents > 0 then 'payment' else 'reversal' end as kind,
         pa.amount_cents, p.method, p.status as payment_status, p.id as payment_id, null::bigint as credit_note_number, p.memo as note
  from public.payment_allocations pa join public.payments p on p.id = pa.payment_id
  union all
  select r.tenant_id, pa.invoice_id, r.created_at, 'credit_note', -r.amount_cents, p.method, p.status, p.id, r.credit_note_number,
         r.reason || case when r.as_credit then ' (to account credit)' else '' end
  from public.refunds r join public.payments p on p.id = r.payment_id
  join lateral (select invoice_id from public.payment_allocations where payment_id = p.id group by invoice_id limit 1) pa on true
  union all
  select p.tenant_id, p.invoice_id, p.received_at, 'failed_payment', p.amount_cents, p.method, p.status, p.id, null, p.failure_message
  from public.payments p where p.status = 'failed' and p.invoice_id is not null;

select app.index_foreign_keys();
