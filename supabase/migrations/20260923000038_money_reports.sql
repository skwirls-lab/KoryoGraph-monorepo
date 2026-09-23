-- 0038 Money reports (F7.9, F7.10, F14.2). Invoice lines now carry their exact tax (written by every invoice
-- writer from the billing engine's figures), so revenue is net of tax without back-calculating. Views for
-- revenue by GL class/category, the payments & refunds ledger, MRR history (new/churn) and deferred
-- revenue on paid-in-full memberships; the DB tests compare them with the engine.

alter table public.invoice_lines add column tax_cents int not null default 0;
-- Existing lines: tax implied by the stored rate (the engine rounds tax on the net, so net = round(total/(1+rate))).
update public.invoice_lines set tax_cents = total_cents - round(total_cents / (1 + tax_rate))::int where tax_rate is not null and tax_rate > 0;

-- Invoice writers: store each line's tax.
create or replace function public.enroll_membership(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
  hh uuid := (p ->> 'household_id')::uuid;
  pid uuid := (p ->> 'person_id')::uuid;
  pl public.membership_plans;
  mid uuid;
  inv_id uuid;
  pay_id uuid;
  ful_id uuid;
  inv jsonb := p -> 'invoice';
  line jsonb;
  prog uuid;
  first_rank uuid;
  total int := (inv ->> 'total_cents')::int;
  pay jsonb := case when jsonb_typeof(p -> 'payment') = 'object' then p -> 'payment' end;
  pay_amt int;
  gear_variants uuid[];
  gear_sizes jsonb;
begin
  if tid is null or not app.has_module('billing') or not app.has_permission('billing.charge') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.household_members where household_id = hh and person_id = pid and tenant_id = tid) then
    raise exception 'this person is not in that household' using errcode = '22023';
  end if;
  select * into pl from public.membership_plans where id = (p ->> 'plan_id')::uuid and tenant_id = tid and active;
  if not found then
    raise exception 'plan not found or archived' using errcode = 'P0002';
  end if;
  if total is null or total < 0 or jsonb_typeof(inv -> 'lines') <> 'array' then
    raise exception 'invalid invoice' using errcode = '22023';
  end if;
  if (select coalesce(sum((l ->> 'total_cents')::int), 0) from jsonb_array_elements(inv -> 'lines') l) <> total then
    raise exception 'invoice lines do not add up to the total' using errcode = '22023';
  end if;

  insert into public.memberships (tenant_id, household_id, person_id, plan_id, status, starts_at, ends_at, billing_day, next_bill_at,
                                  contract_ends_at, price_override_cents, discount_ids, autopay, payment_method_id, notes,
                                  class_pack_remaining)
  values (tid, hh, pid, pl.id, case when pl.kind = 'trial' then 'trial' else 'active' end, (p ->> 'starts_at')::date,
          nullif(p ->> 'ends_at', '')::date, nullif(p ->> 'billing_day', '')::int, nullif(p ->> 'next_bill_at', '')::date,
          nullif(p ->> 'contract_ends_at', '')::date, nullif(p ->> 'price_override_cents', '')::int,
          coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p -> 'discount_ids', '[]'::jsonb)) x), '{}'),
          coalesce((p ->> 'autopay')::boolean, false), nullif(p ->> 'payment_method_id', '')::uuid, nullif(trim(p ->> 'notes'), ''),
          pl.class_pack_size)
  returning id into mid;

  if total > 0 or jsonb_array_length(inv -> 'lines') > 0 then
    insert into public.invoices (tenant_id, household_id, person_id, membership_id, number, status, due_at, period_start, period_end,
                                 subtotal_cents, discount_cents, tax_cents, total_cents, source, memo)
    values (tid, hh, pid, mid, app.next_counter(tid, 'invoice'), 'open', coalesce(nullif(inv ->> 'due_at', '')::date, current_date),
            (p ->> 'starts_at')::date, nullif(p ->> 'next_bill_at', '')::date,
            (inv ->> 'subtotal_cents')::int, (inv ->> 'discount_cents')::int, (inv ->> 'tax_cents')::int, total, 'enrollment',
            nullif(inv ->> 'memo', ''))
    returning id into inv_id;
    for line in select * from jsonb_array_elements(inv -> 'lines') loop
      insert into public.invoice_lines (tenant_id, invoice_id, kind, description, quantity, unit_cents, total_cents, ref_type, ref_id, tax_rate, tax_cents)
      values (tid, inv_id, line ->> 'kind', line ->> 'description', coalesce((line ->> 'quantity')::int, 1), (line ->> 'unit_cents')::int,
              (line ->> 'total_cents')::int, case when line ->> 'kind' = 'membership' then 'membership' end,
              case when line ->> 'kind' = 'membership' then mid end, nullif(line ->> 'tax_rate', '')::numeric, coalesce((line ->> 'tax_cents')::int, 0));
    end loop;
  end if;

  -- Coupon uses.
  update public.discounts set uses = uses + 1
   where tenant_id = tid and id in (select x::uuid from jsonb_array_elements_text(coalesce(p -> 'discount_ids', '[]'::jsonb)) x);

  -- Program access: enroll (or re-activate) the student in each program of the plan at its first rank.
  foreach prog in array pl.program_ids loop
    select id into first_rank from public.ranks where program_id = prog and tenant_id = tid order by position limit 1;
    insert into public.enrollments (tenant_id, person_id, program_id, current_rank_id, started_at)
    values (tid, pid, prog, first_rank, (p ->> 'starts_at')::date)
    on conflict (person_id, program_id) do update set status = 'active' where public.enrollments.status <> 'active';
  end loop;

  update public.people set status = case when pl.kind = 'trial' then 'trial' else 'active' end
   where id = pid and tenant_id = tid and status in ('lead', 'trial', 'cancelled', 'alumni', 'on_hold', 'active');

  -- Enrollment kit.
  if jsonb_typeof(p -> 'gear') = 'array' and jsonb_array_length(p -> 'gear') > 0 then
    select array_agg((g ->> 'variant_id')::uuid), jsonb_object_agg(coalesce(g ->> 'product_name', g ->> 'variant_id'), coalesce(g ->> 'size', ''))
      into gear_variants, gear_sizes
      from jsonb_array_elements(p -> 'gear') g
     where exists (select 1 from public.product_variants v where v.id = (g ->> 'variant_id')::uuid and v.tenant_id = tid);
    if gear_variants is not null then
      insert into public.gear_fulfilments (tenant_id, household_id, person_id, membership_id, variant_ids, sizes)
      values (tid, hh, pid, mid, gear_variants, gear_sizes)
      returning id into ful_id;
    end if;
  end if;

  -- Pay now in cash/check/external (card payments go through Stripe after this returns).
  if pay is not null and inv_id is not null then
    if pay ->> 'method' not in ('cash', 'check', 'external') then
      raise exception 'unsupported payment method' using errcode = '22023';
    end if;
    pay_amt := coalesce((pay ->> 'amount_cents')::int, total);
    if pay_amt <= 0 then
      raise exception 'payment must be positive' using errcode = '22023';
    end if;
    insert into public.payments (tenant_id, household_id, invoice_id, amount_cents, method, status, received_by_user_id, memo)
    values (tid, hh, inv_id, pay_amt, pay ->> 'method', 'succeeded', auth.uid(), nullif(pay ->> 'memo', ''))
    returning id into pay_id;
    insert into public.payment_allocations (tenant_id, payment_id, invoice_id, amount_cents)
    values (tid, pay_id, inv_id, least(pay_amt, total));
    if pay_amt > total then
      insert into public.credits (tenant_id, household_id, amount_cents, remaining_cents, reason, source_ref)
      values (tid, hh, pay_amt - total, pay_amt - total, 'Unapplied payment', 'payment:' || pay_id);
    end if;
  end if;

  return jsonb_build_object('membership_id', mid, 'invoice_id', inv_id, 'payment_id', pay_id, 'fulfilment_id', ful_id);
end;
$$;

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
      insert into public.invoice_lines (tenant_id, invoice_id, kind, description, quantity, unit_cents, total_cents, ref_type, ref_id, tax_rate, tax_cents)
      values (p_tenant_id, inv, line ->> 'kind', line ->> 'description', coalesce((line ->> 'quantity')::int, 1), (line ->> 'unit_cents')::int,
              (line ->> 'total_cents')::int, case when line ->> 'kind' = 'membership' then 'membership' end,
              case when line ->> 'kind' = 'membership' then mid end, nullif(line ->> 'tax_rate', '')::numeric, coalesce((line ->> 'tax_cents')::int, 0));
    end loop;
  end if;
  -- Advance only from the period we just billed (an already-advanced membership is left alone).
  update public.memberships set next_bill_at = (p ->> 'next_bill_at')::date
   where id = mid and tenant_id = p_tenant_id and next_bill_at = (p ->> 'period_start')::date;
  return inv;
end;
$$;

create or replace function public.pos_open_sale(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.require_pos();
  loc uuid := (p ->> 'location_id')::uuid;
  hh uuid := nullif(p ->> 'household_id', '')::uuid;
  sale uuid;
  inv uuid;
  l jsonb;
  price int;
begin
  if not exists (select 1 from public.locations where id = loc and tenant_id = tid) then
    raise exception 'unknown location' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p -> 'lines') <> 'array' or jsonb_array_length(p -> 'lines') = 0 then
    raise exception 'the cart is empty' using errcode = '22023';
  end if;
  if hh is not null and not exists (select 1 from public.households where id = hh and tenant_id = tid) then
    raise exception 'unknown household' using errcode = 'P0002';
  end if;
  for l in select * from jsonb_array_elements(p -> 'lines') loop
    select price_cents into price from public.product_variants where id = (l ->> 'variant_id')::uuid and tenant_id = tid and active;
    if price is null or price <> (l ->> 'unit_cents')::int or (l ->> 'qty')::int < 1 then
      raise exception 'prices changed — refresh the cart' using errcode = '22023';
    end if;
  end loop;
  if (select sum((x ->> 'total_cents')::int) from jsonb_array_elements(p -> 'lines') x) <> (p ->> 'total_cents')::int then
    raise exception 'cart totals do not add up' using errcode = '22023';
  end if;

  insert into public.invoices (tenant_id, household_id, person_id, number, status, due_at, subtotal_cents, discount_cents, tax_cents, total_cents, source, memo)
  values (tid, coalesce(hh, app.walk_in_household(tid)), nullif(p ->> 'person_id', '')::uuid, app.next_counter(tid, 'invoice'), 'open',
          app.tenant_today(tid), (p ->> 'subtotal_cents')::int, (p ->> 'discount_cents')::int, (p ->> 'tax_cents')::int, (p ->> 'total_cents')::int, 'pos', 'Point of sale')
  returning id into inv;
  insert into public.pos_sales (tenant_id, location_id, household_id, person_id, cashier_user_id, status, kind, subtotal_cents, discount_cents, tax_cents, total_cents, invoice_id)
  values (tid, loc, hh, nullif(p ->> 'person_id', '')::uuid, auth.uid(), 'open', 'sale', (p ->> 'subtotal_cents')::int, (p ->> 'discount_cents')::int,
          (p ->> 'tax_cents')::int, (p ->> 'total_cents')::int, inv)
  returning id into sale;
  for l in select * from jsonb_array_elements(p -> 'lines') loop
    insert into public.invoice_lines (tenant_id, invoice_id, kind, description, quantity, unit_cents, total_cents, ref_type, ref_id, tax_rate, tax_cents)
    values (tid, inv, 'product', l ->> 'description', (l ->> 'qty')::int, (l ->> 'unit_cents')::int, (l ->> 'total_cents')::int, 'variant',
            (l ->> 'variant_id')::uuid, nullif(l ->> 'tax_rate', '')::numeric, coalesce((l ->> 'tax_cents')::int, 0));
    insert into public.pos_sale_lines (tenant_id, sale_id, variant_id, qty, unit_cents, discount_cents, tax_cents, total_cents)
    values (tid, sale, (l ->> 'variant_id')::uuid, (l ->> 'qty')::int, (l ->> 'unit_cents')::int, coalesce((l ->> 'discount_cents')::int, 0),
            coalesce((l ->> 'tax_cents')::int, 0), (l ->> 'total_cents')::int);
  end loop;
  return jsonb_build_object('sale_id', sale, 'invoice_id', inv);
end;
$$;

-- Revenue by GL class and category, per school-local month (accrual: when invoiced; void/draft excluded).
create view public.v_revenue_lines with (security_invoker = true) as
  select i.tenant_id, i.id as invoice_id, i.number, i.household_id, i.issued_at, i.source,
         date_trunc('month', i.issued_at at time zone t.timezone)::date as month,
         (i.issued_at at time zone t.timezone)::date as issued_on,
         l.id as line_id, l.kind, l.description, l.quantity,
         case l.kind
           when 'membership' then 'Membership revenue'
           when 'fee' then 'Fee revenue'
           when 'product' then 'Retail sales'
           when 'testing' then 'Testing fees'
           when 'event' then 'Event revenue'
           else 'Adjustments & returns'
         end as gl_class,
         case when l.kind = 'product' then coalesce(p.category, 'other') else l.kind end as category,
         l.total_cents - l.tax_cents as net_cents, l.tax_cents, l.total_cents
  from public.invoice_lines l
  join public.invoices i on i.id = l.invoice_id
  join public.tenants t on t.id = i.tenant_id
  left join public.product_variants v on l.ref_type = 'variant' and v.id = l.ref_id
  left join public.products p on p.id = v.product_id
  where i.status not in ('void', 'draft');

-- Money in and out: succeeded payments (positive) and refunds as credit notes (negative).
create view public.v_payments_ledger with (security_invoker = true) as
  select p.tenant_id, 'payment'::text as kind, p.id as payment_id, null::uuid as refund_id, p.received_at as at,
         (p.received_at at time zone t.timezone)::date as on_date, p.method, p.amount_cents as amount_cents,
         p.household_id, h.name as household_name, i.number as invoice_number, p.memo as reference, p.stripe_payment_intent_id
  from public.payments p
  join public.tenants t on t.id = p.tenant_id
  join public.households h on h.id = p.household_id
  left join public.invoices i on i.id = p.invoice_id
  where p.status in ('succeeded', 'partially_refunded', 'refunded')
  union all
  select r.tenant_id, case when r.as_credit then 'credit_note' else 'refund' end, p.id, r.id, r.created_at,
         (r.created_at at time zone t.timezone)::date, p.method, -r.amount_cents,
         p.household_id, h.name, i.number, 'CN-' || r.credit_note_number || ': ' || r.reason, p.stripe_payment_intent_id
  from public.refunds r
  join public.payments p on p.id = r.payment_id
  join public.tenants t on t.id = r.tenant_id
  join public.households h on h.id = p.household_id
  left join public.invoices i on i.id = p.invoice_id
  where r.status = 'succeeded';

-- Each recurring membership's MRR span: from its start until it ended (cancel/expiry), if it did.
create view public.v_membership_mrr as
  select m.tenant_id, m.id as membership_id, m.household_id, m.person_id, pl.name as plan_name, m.starts_at,
         coalesce(m.cancel_at,
                  case when m.status = 'expired' then coalesce(m.contract_ends_at, m.ends_at, (m.updated_at at time zone 'UTC')::date) end,
                  case when m.status = 'cancelled' then (m.updated_at at time zone 'UTC')::date end) as ended_on,
         round(coalesce(m.price_override_cents, pl.price_cents) *
           case pl.interval when 'week' then 52.0 / 12 when 'month' then 1 when 'year' then 1.0 / 12 else 0 end / pl.interval_count)::int as mrr_cents
  from public.memberships m
  join public.membership_plans pl on pl.id = m.plan_id
  where pl.kind in ('recurring', 'contract') and m.status <> 'pending';
alter view public.v_membership_mrr set (security_invoker = true);

-- Last 12 school-local months: MRR at month end, new MRR (starts) and churned MRR (ends) in the month.
create view public.v_mrr_monthly with (security_invoker = true) as
  with months as (
    select t.id as tenant_id, gs::date as month, (gs + interval '1 month' - interval '1 day')::date as month_end
    from public.tenants t,
         generate_series(date_trunc('month', now() at time zone t.timezone) - interval '11 months', date_trunc('month', now() at time zone t.timezone), interval '1 month') gs
  )
  select mo.tenant_id, mo.month,
         coalesce(sum(s.mrr_cents) filter (where s.starts_at <= mo.month_end and (s.ended_on is null or s.ended_on > mo.month_end)), 0)::int as mrr_cents,
         coalesce(sum(s.mrr_cents) filter (where s.starts_at between mo.month and mo.month_end), 0)::int as new_mrr_cents,
         coalesce(sum(s.mrr_cents) filter (where s.ended_on between mo.month and mo.month_end), 0)::int as churned_mrr_cents,
         count(*) filter (where s.starts_at <= mo.month_end and (s.ended_on is null or s.ended_on > mo.month_end))::int as memberships
  from months mo
  left join public.v_membership_mrr s on s.tenant_id = mo.tenant_id
  group by mo.tenant_id, mo.month;

-- Paid-in-full memberships: the prepaid amount (net of tax) recognised evenly by month from the start; the
-- last month absorbs rounding (same schedule as the engine's recognitionSchedule).
create view public.v_deferred_revenue with (security_invoker = true) as
  with paid as (
    select m.tenant_id, m.id as membership_id, m.household_id, m.person_id, pl.name as plan_name, m.starts_at, pl.term_months as months,
           sum(l.total_cents - l.tax_cents)::int as amount_cents
    from public.memberships m
    join public.membership_plans pl on pl.id = m.plan_id and pl.kind = 'paid_in_full' and pl.term_months is not null
    join public.invoices i on i.membership_id = m.id and i.status = 'paid'
    join public.invoice_lines l on l.invoice_id = i.id and l.kind = 'membership'
    group by m.tenant_id, m.id, m.household_id, m.person_id, pl.name, m.starts_at, pl.term_months
  )
  select p.*, app.tenant_today(p.tenant_id) as as_of,
         coalesce((select sum(case when g = p.months - 1 then p.amount_cents - (p.amount_cents / p.months) * (p.months - 1) else p.amount_cents / p.months end)
                     from generate_series(0, p.months - 1) g
                    where (p.starts_at + make_interval(months => g))::date > app.tenant_today(p.tenant_id)), 0)::int as deferred_cents
  from paid p;
