-- 0033 Billing dates are the school's calendar dates. `current_date` is the database's (UTC) date, which is
-- already "tomorrow" on a New York evening — an invoice due today must not turn past due at 8 pm.

create or replace function app.tenant_today(p_tenant_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (now() at time zone t.timezone)::date from public.tenants t where t.id = p_tenant_id), current_date);
$$;
grant execute on function app.tenant_today(uuid) to authenticated, service_role;

create or replace function app.invoice_status_for(p_status text, p_total int, p_paid int, p_due date, p_had_payment boolean, p_today date)
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
    when p_paid > 0 then case when p_due < p_today then 'past_due' else 'partially_paid' end
    when p_due < p_today then 'past_due'
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
         status = app.invoice_status_for(i.status, i.total_cents, paid, i.due_at, coalesce(had, false), app.tenant_today(i.tenant_id))
   where i.id = p_invoice_id;
end;
$$;

drop function app.invoice_status_for(text, int, int, date, boolean);

create or replace function app.recompute_household_balance(p_household_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.households h set balance_cents =
    coalesce((select sum(balance_cents) from public.invoices where household_id = h.id and status in ('open', 'partially_paid', 'past_due')), 0)
    - coalesce((select sum(remaining_cents) from public.credits where household_id = h.id and (expires_at is null or expires_at >= app.tenant_today(h.tenant_id))), 0)
  where h.id = p_household_id;
$$;

create or replace view public.v_ar_aging with (security_invoker = true) as
  with d as (select i.*, app.tenant_today(i.tenant_id) as today from public.invoices i
             where i.status in ('open', 'partially_paid', 'past_due') and i.balance_cents > 0)
  select d.tenant_id, d.id as invoice_id, d.number, d.household_id, h.name as household_name, d.due_at, d.total_cents, d.balance_cents, d.status,
         greatest(d.today - d.due_at, 0) as days_overdue,
         case when d.today - d.due_at <= 0 then 'current'
              when d.today - d.due_at <= 30 then '1-30'
              when d.today - d.due_at <= 60 then '31-60'
              when d.today - d.due_at <= 90 then '61-90'
              else '90+' end as bucket,
         coalesce((d.dunning_state ->> 'stage')::int, 0) as dunning_stage
  from d
  join public.households h on h.id = d.household_id;

create or replace view public.v_household_balance with (security_invoker = true) as
  select h.tenant_id, h.id as household_id, h.name,
         coalesce(sum(i.balance_cents) filter (where i.status in ('open', 'partially_paid', 'past_due')), 0)::int as open_cents,
         coalesce(sum(i.balance_cents) filter (where i.status = 'past_due'), 0)::int as past_due_cents,
         (select coalesce(sum(c.remaining_cents), 0) from public.credits c where c.household_id = h.id and (c.expires_at is null or c.expires_at >= app.tenant_today(h.tenant_id)))::int as credit_cents
  from public.households h
  left join public.invoices i on i.household_id = h.id
  group by h.tenant_id, h.id, h.name;

-- apply_credit: expiry against the school's date.
create or replace function public.apply_credit(p_invoice_id uuid, p_amount_cents int default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.require_billing('billing.charge');
  today date := app.tenant_today(app.tenant_id());
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
   where household_id = inv.household_id and remaining_cents > 0 and (expires_at is null or expires_at >= today);
  want := least(coalesce(p_amount_cents, inv.balance_cents), inv.balance_cents, available);
  if want <= 0 then
    raise exception 'no credit available' using errcode = '22023';
  end if;
  left_ := want;
  for c in select id, remaining_cents from public.credits
            where household_id = inv.household_id and remaining_cents > 0 and (expires_at is null or expires_at >= today)
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

-- Invoices already marked past due by the UTC clock on their due date go back to open/partially paid.
update public.invoices i set status = app.invoice_status_for('open', i.total_cents, i.paid_cents, i.due_at, i.paid_cents > 0, app.tenant_today(i.tenant_id))
 where i.status = 'past_due' and i.due_at >= app.tenant_today(i.tenant_id);
