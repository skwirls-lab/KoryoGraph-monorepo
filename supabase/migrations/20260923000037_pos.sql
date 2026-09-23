-- 0037 Point of sale (F8.3). A sale is an open invoice (source 'pos') until its tenders pay it; the tender
-- that brings the balance to zero completes the sale (receipt number, stock out, drawer). Prices come from
-- product_variants and totals from the billing engine; these functions re-check both. Returns reference
-- the original sale, put stock back and refund through credit notes (money back or account credit).

create or replace function app.require_pos()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
begin
  if app.tenant_id() is null or not app.has_module('retail') or not app.has_permission('retail.sell') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return app.tenant_id();
end;
$$;

-- A fully refunded invoice (everything paid came back) reads 'refunded', even when its total is now zero.
create or replace function app.invoice_status_for(p_status text, p_total int, p_paid int, p_due date, p_had_payment boolean, p_today date)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_status in ('void', 'draft') then p_status
    when p_paid >= p_total and p_total > 0 then 'paid'
    when p_paid <= 0 and p_had_payment then 'refunded'
    when p_total = 0 then 'paid'
    when p_paid > 0 then case when p_due < p_today then 'past_due' else 'partially_paid' end
    when p_due < p_today then 'past_due'
    else 'open'
  end;
$$;

-- Card payments are also taken at the POS by staff with retail.sell.
create or replace function public.record_payment_intent(p_pi jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.tenant_id() is null or not app.has_module('billing') or not (app.has_permission('billing.charge') or app.has_permission('retail.sell')) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return app.record_payment_intent(app.tenant_id(), p_pi);
end;
$$;

-- Walk-in customers are billed to one system household per tenant.
create or replace function app.walk_in_household(p_tenant uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  hid uuid;
begin
  select id into hid from public.households where tenant_id = p_tenant and external_id = 'pos:walk-in';
  if hid is null then
    insert into public.households (tenant_id, name, external_id, notes)
    values (p_tenant, 'Walk-in sales', 'pos:walk-in', 'System household for POS sales without a customer.')
    on conflict (tenant_id, external_id) do nothing
    returning id into hid;
    if hid is null then
      select id into hid from public.households where tenant_id = p_tenant and external_id = 'pos:walk-in';
    end if;
  end if;
  return hid;
end;
$$;

create or replace function app.open_drawer_for(p_location uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.cash_drawers where location_id = p_location and closed_at is null limit 1;
$$;

-- p = { location_id, household_id?, person_id?, subtotal_cents, discount_cents, tax_cents, total_cents,
--       lines: [{ variant_id, qty, unit_cents, discount_cents, tax_cents, total_cents, tax_rate, description }] }
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
    insert into public.invoice_lines (tenant_id, invoice_id, kind, description, quantity, unit_cents, total_cents, ref_type, ref_id, tax_rate)
    values (tid, inv, 'product', l ->> 'description', (l ->> 'qty')::int, (l ->> 'unit_cents')::int, (l ->> 'total_cents')::int, 'variant',
            (l ->> 'variant_id')::uuid, nullif(l ->> 'tax_rate', '')::numeric);
    insert into public.pos_sale_lines (tenant_id, sale_id, variant_id, qty, unit_cents, discount_cents, tax_cents, total_cents)
    values (tid, sale, (l ->> 'variant_id')::uuid, (l ->> 'qty')::int, (l ->> 'unit_cents')::int, coalesce((l ->> 'discount_cents')::int, 0),
            coalesce((l ->> 'tax_cents')::int, 0), (l ->> 'total_cents')::int);
  end loop;
  return jsonb_build_object('sale_id', sale, 'invoice_id', inv);
end;
$$;

-- Completes a sale whose invoice is paid: receipt number, stock out, drawer.
create or replace function app.pos_finalize(p_sale uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.pos_sales;
  rn bigint;
  l record;
begin
  select * into s from public.pos_sales where id = p_sale for update;
  if s.status <> 'open' then
    return s.receipt_number;
  end if;
  rn := app.next_counter(s.tenant_id, 'receipt');
  update public.pos_sales set status = 'completed', receipt_number = rn, drawer_id = coalesce(drawer_id, app.open_drawer_for(s.location_id)) where id = s.id;
  for l in select variant_id, sum(qty)::int as qty from public.pos_sale_lines where sale_id = s.id group by variant_id loop
    insert into public.inventory_movements (tenant_id, variant_id, location_id, delta, reason, ref_type, ref_id, by_user_id)
    values (s.tenant_id, l.variant_id, s.location_id, -l.qty, 'sale', 'pos_sale', s.id, auth.uid());
  end loop;
  return rn;
end;
$$;

-- Add a tender. cash/check/external/credit are recorded here; card/terminal pass the payment the server
-- already recorded from Stripe (p_payment_id). Returns the remaining balance and whether the sale completed.
create or replace function public.pos_add_tender(p_sale_id uuid, p_method text, p_amount_cents int, p_tendered_cents int default null, p_payment_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.require_pos();
  s public.pos_sales;
  inv public.invoices;
  applied int;
  change int := 0;
  pid uuid;
  drawer uuid;
  available int;
  left_ int;
  take int;
  c record;
  rn bigint;
  bal int;
begin
  select * into s from public.pos_sales where id = p_sale_id and tenant_id = tid for update;
  if not found or s.status <> 'open' or s.kind <> 'sale' then
    raise exception 'this sale is not open' using errcode = '22023';
  end if;
  select * into inv from public.invoices where id = s.invoice_id for update;

  if p_method in ('card', 'terminal') then
    select id, amount_cents into pid, applied from public.payments
     where id = p_payment_id and tenant_id = tid and invoice_id = inv.id and status = 'succeeded';
    if pid is null then
      raise exception 'the card payment was not completed' using errcode = '22023';
    end if;
  elsif p_method in ('cash', 'check', 'external') then
    if p_amount_cents is null or p_amount_cents <= 0 then
      raise exception 'enter an amount' using errcode = '22023';
    end if;
    if p_method = 'cash' then
      drawer := app.open_drawer_for(s.location_id);
      if drawer is null then
        raise exception 'open the cash drawer first' using errcode = '22023';
      end if;
      applied := least(coalesce(p_tendered_cents, p_amount_cents), inv.balance_cents);
      change := greatest(coalesce(p_tendered_cents, p_amount_cents) - inv.balance_cents, 0);
    else
      applied := least(p_amount_cents, inv.balance_cents);
    end if;
    if applied <= 0 then
      raise exception 'nothing left to pay' using errcode = '22023';
    end if;
    insert into public.payments (tenant_id, household_id, invoice_id, amount_cents, method, status, received_by_user_id, memo)
    values (tid, inv.household_id, inv.id, applied, p_method, 'succeeded', auth.uid(), 'POS')
    returning id into pid;
    insert into public.payment_allocations (tenant_id, payment_id, invoice_id, amount_cents) values (tid, pid, inv.id, applied);
  elsif p_method = 'credit' then
    if s.household_id is null then
      raise exception 'attach a household to use account credit' using errcode = '22023';
    end if;
    select coalesce(sum(remaining_cents), 0) into available from public.credits
     where household_id = s.household_id and remaining_cents > 0 and (expires_at is null or expires_at >= app.tenant_today(tid));
    applied := least(coalesce(p_amount_cents, inv.balance_cents), inv.balance_cents, available);
    if applied <= 0 then
      raise exception 'no account credit available' using errcode = '22023';
    end if;
    left_ := applied;
    for c in select id, remaining_cents from public.credits
              where household_id = s.household_id and remaining_cents > 0 and (expires_at is null or expires_at >= app.tenant_today(tid))
              order by expires_at nulls last, created_at for update loop
      exit when left_ <= 0;
      take := least(left_, c.remaining_cents);
      update public.credits set remaining_cents = remaining_cents - take where id = c.id;
      left_ := left_ - take;
    end loop;
    insert into public.payments (tenant_id, household_id, invoice_id, amount_cents, method, status, received_by_user_id, memo)
    values (tid, inv.household_id, inv.id, applied, 'credit', 'succeeded', auth.uid(), 'POS · account credit')
    returning id into pid;
    insert into public.payment_allocations (tenant_id, payment_id, invoice_id, amount_cents) values (tid, pid, inv.id, applied);
  else
    raise exception 'unsupported tender' using errcode = '22023';
  end if;

  insert into public.pos_tenders (tenant_id, sale_id, method, amount_cents, payment_id, change_cents)
  values (tid, s.id, p_method, applied + change, pid, change);

  select balance_cents into bal from public.invoices where id = inv.id;
  if bal = 0 then
    rn := app.pos_finalize(s.id);
  end if;
  return jsonb_build_object('balance_cents', bal, 'applied_cents', applied, 'change_cents', change, 'completed', bal = 0, 'receipt_number', rn);
end;
$$;

create or replace function public.pos_cancel_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.require_pos();
  s public.pos_sales;
begin
  select * into s from public.pos_sales where id = p_sale_id and tenant_id = tid for update;
  if not found or s.status <> 'open' then
    raise exception 'only an open sale can be cancelled' using errcode = '22023';
  end if;
  if exists (select 1 from public.pos_tenders where sale_id = s.id) then
    raise exception 'payments were taken — complete the sale, then return the items' using errcode = '22023';
  end if;
  update public.pos_sales set status = 'void' where id = s.id;
  update public.invoices set status = 'void', voided_at = now(), void_reason = 'POS sale cancelled' where id = s.invoice_id;
end;
$$;

-- Return items from a completed sale. p = { original_sale_id, lines: [{ line_id, qty }], refund_to: 'original'|'credit', reason }
-- Restocks, records a 'return' sale, and refunds against the original payments (non-Stripe ones here; the
-- server refunds Stripe payments at Stripe and records them — returned in `stripe`).
create or replace function public.pos_return(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.require_pos();
  orig public.pos_sales;
  ret uuid;
  l jsonb;
  ol public.pos_sale_lines;
  already int;
  q int;
  amount int;
  total int := 0;
  tax int := 0;
  remaining int;
  pay record;
  take int;
  to_credit boolean := (p ->> 'refund_to') = 'credit';
  reason text := coalesce(nullif(trim(p ->> 'reason'), ''), 'Returned items');
  stripe_due jsonb := '[]'::jsonb;
  cash_out int := 0;
  rn bigint;
begin
  select * into orig from public.pos_sales where id = (p ->> 'original_sale_id')::uuid and tenant_id = tid for update;
  if not found or orig.kind <> 'sale' or orig.status not in ('completed', 'refunded') then
    raise exception 'only completed sales can be returned' using errcode = '22023';
  end if;
  rn := app.next_counter(tid, 'receipt');
  insert into public.pos_sales (tenant_id, location_id, household_id, person_id, cashier_user_id, status, kind, original_sale_id, invoice_id, receipt_number, drawer_id)
  values (tid, orig.location_id, orig.household_id, orig.person_id, auth.uid(), 'completed', 'return', orig.id, orig.invoice_id, rn, app.open_drawer_for(orig.location_id))
  returning id into ret;

  for l in select * from jsonb_array_elements(coalesce(p -> 'lines', '[]'::jsonb)) loop
    select * into ol from public.pos_sale_lines where id = (l ->> 'line_id')::uuid and sale_id = orig.id;
    if not found then
      raise exception 'that item is not on this sale' using errcode = '22023';
    end if;
    q := (l ->> 'qty')::int;
    select coalesce(-sum(r.qty), 0) into already from public.pos_sale_lines r join public.pos_sales rs on rs.id = r.sale_id
     where r.original_line_id = ol.id and rs.kind = 'return';
    if q is null or q < 1 or q + already > ol.qty then
      raise exception 'you can return at most % of that item', ol.qty - already using errcode = '22023';
    end if;
    amount := case when q + already = ol.qty then ol.total_cents - coalesce((select -sum(r.total_cents) from public.pos_sale_lines r where r.original_line_id = ol.id), 0)
                   else round(ol.total_cents::numeric * q / ol.qty)::int end;
    insert into public.pos_sale_lines (tenant_id, sale_id, variant_id, qty, unit_cents, discount_cents, tax_cents, total_cents, original_line_id)
    values (tid, ret, ol.variant_id, -q, ol.unit_cents, 0, -round(ol.tax_cents::numeric * q / ol.qty)::int, -amount, ol.id);
    insert into public.inventory_movements (tenant_id, variant_id, location_id, delta, reason, ref_type, ref_id, by_user_id, note)
    values (tid, ol.variant_id, orig.location_id, q, 'return', 'pos_sale', ret, auth.uid(), reason);
    total := total + amount;
    tax := tax + round(ol.tax_cents::numeric * q / ol.qty)::int;
  end loop;
  if total <= 0 then
    raise exception 'choose items to return' using errcode = '22023';
  end if;
  update public.pos_sales set subtotal_cents = -(total - tax), tax_cents = -tax, total_cents = -total where id = ret;
  -- The returned goods come off the original invoice first, so refunding doesn't reopen a balance.
  insert into public.invoice_lines (tenant_id, invoice_id, kind, description, quantity, unit_cents, total_cents)
  values (tid, orig.invoice_id, 'adjustment', 'Returned items (receipt ' || rn || ')', 1, -total, -total);
  update public.invoices set subtotal_cents = subtotal_cents - (total - tax), tax_cents = tax_cents - tax, total_cents = total_cents - total
   where id = orig.invoice_id;

  -- Refund against the original sale's payments, newest first.
  remaining := total;
  for pay in select id, method, amount_cents - refunded_cents as left_cents, stripe_payment_intent_id from public.payments
              where invoice_id = orig.invoice_id and status in ('succeeded', 'partially_refunded') order by received_at desc loop
    exit when remaining <= 0;
    take := least(remaining, pay.left_cents);
    continue when take <= 0;
    if pay.stripe_payment_intent_id is not null and not to_credit then
      stripe_due := stripe_due || jsonb_build_object('payment_id', pay.id, 'amount_cents', take);
    else
      perform app.apply_refund(tid, pay.id, take, reason || ' (return ' || rn || ')', null, auth.uid(), to_credit or pay.method = 'credit');
      if pay.method = 'cash' and not to_credit then
        cash_out := cash_out + take;
      end if;
    end if;
    remaining := remaining - take;
  end loop;
  if cash_out > 0 and app.open_drawer_for(orig.location_id) is null then
    raise exception 'open the cash drawer to give cash back' using errcode = '22023';
  end if;
  if cash_out > 0 then
    insert into public.pos_tenders (tenant_id, sale_id, method, amount_cents, change_cents) values (tid, ret, 'cash', -cash_out, 0);
  end if;
  if not exists (
    select 1 from public.pos_sale_lines ol2
     where ol2.sale_id = orig.id
       and ol2.qty > coalesce((select -sum(r.qty) from public.pos_sale_lines r where r.original_line_id = ol2.id), 0)) then
    update public.pos_sales set status = 'refunded' where id = orig.id;
  end if;
  return jsonb_build_object('return_sale_id', ret, 'receipt_number', rn, 'refund_cents', total, 'cash_out_cents', cash_out, 'stripe', stripe_due);
end;
$$;

-- Cash drawer: open with a float; close with the counted cash → expected and variance.
create or replace function public.pos_open_drawer(p_location_id uuid, p_opening_cents int)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.require_pos();
  did uuid;
begin
  if not exists (select 1 from public.locations where id = p_location_id and tenant_id = tid) then
    raise exception 'unknown location' using errcode = 'P0002';
  end if;
  if p_opening_cents is null or p_opening_cents < 0 then
    raise exception 'enter the starting cash' using errcode = '22023';
  end if;
  if app.open_drawer_for(p_location_id) is not null then
    raise exception 'a drawer is already open here' using errcode = '22023';
  end if;
  insert into public.cash_drawers (tenant_id, location_id, opened_by, opening_cents) values (tid, p_location_id, auth.uid(), p_opening_cents)
  returning id into did;
  return did;
end;
$$;

create or replace function app.drawer_expected(p_drawer uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select d.opening_cents + coalesce((
    select sum(t.amount_cents - t.change_cents) from public.pos_tenders t join public.pos_sales s on s.id = t.sale_id
     where s.drawer_id = d.id and t.method = 'cash' and s.status <> 'void'), 0)::int
  from public.cash_drawers d where d.id = p_drawer;
$$;

create or replace function public.pos_close_drawer(p_drawer_id uuid, p_counted_cents int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.require_pos();
  d public.cash_drawers;
  expected int;
begin
  select * into d from public.cash_drawers where id = p_drawer_id and tenant_id = tid for update;
  if not found or d.closed_at is not null then
    raise exception 'this drawer is not open' using errcode = '22023';
  end if;
  if p_counted_cents is null or p_counted_cents < 0 then
    raise exception 'enter the counted cash' using errcode = '22023';
  end if;
  expected := app.drawer_expected(d.id);
  update public.cash_drawers set closed_at = now(), closed_by = auth.uid(), closing_cents = p_counted_cents, expected_cents = expected,
         variance_cents = p_counted_cents - expected where id = d.id;
  return jsonb_build_object('expected_cents', expected, 'counted_cents', p_counted_cents, 'variance_cents', p_counted_cents - expected);
end;
$$;

create or replace function public.pos_drawer_expected(p_drawer_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require_pos();
  if not exists (select 1 from public.cash_drawers where id = p_drawer_id and tenant_id = app.tenant_id()) then
    raise exception 'drawer not found' using errcode = 'P0002';
  end if;
  return app.drawer_expected(p_drawer_id);
end;
$$;

revoke execute on function public.pos_open_sale(jsonb), public.pos_add_tender(uuid, text, int, int, uuid), public.pos_cancel_sale(uuid),
  public.pos_return(jsonb), public.pos_open_drawer(uuid, int), public.pos_close_drawer(uuid, int), public.pos_drawer_expected(uuid) from public, anon;
grant execute on function public.pos_open_sale(jsonb), public.pos_add_tender(uuid, text, int, int, uuid), public.pos_cancel_sale(uuid),
  public.pos_return(jsonb), public.pos_open_drawer(uuid, int), public.pos_close_drawer(uuid, int), public.pos_drawer_expected(uuid) to authenticated;
revoke execute on function app.require_pos(), app.walk_in_household(uuid), app.open_drawer_for(uuid), app.pos_finalize(uuid), app.drawer_expected(uuid) from public;

select app.index_foreign_keys();
