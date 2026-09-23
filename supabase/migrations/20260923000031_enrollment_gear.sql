-- 0031 Enrollment flow (F7.2, F7.3, F8.4, F3.6 billing half). Brings forward the part of §4.7 that
-- membership gear packages need — products, product_variants, gear_fulfilments — ahead of the rest of
-- retail (M2.08). Enrollment is one atomic definer RPC: membership, invoice + lines, program enrollment,
-- gear fulfilment, optional immediate cash/check payment, person status → active.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  category text not null default 'other' check (category in ('uniforms', 'sparring_gear', 'belts', 'weapons', 'apparel', 'consumables', 'other')),
  description text not null default '',
  tax_class text not null default 'retail',
  images text[] not null default '{}',
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.setup_tenant_table('public.products', 'inventory.manage', null, 'retail');

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  product_id uuid not null,
  sku text not null check (length(trim(sku)) > 0),
  barcode text,
  options jsonb not null default '{}'::jsonb,
  price_cents int not null check (price_cents >= 0),
  cost_cents int not null default 0 check (cost_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, sku),
  foreign key (tenant_id, product_id) references public.products (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.product_variants', 'inventory.manage', null, 'retail');

create table public.gear_fulfilments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  household_id uuid not null,
  person_id uuid not null,
  membership_id uuid,
  variant_ids uuid[] not null default '{}',
  sizes jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'ready', 'delivered')),
  delivered_at timestamptz,
  delivered_by uuid references auth.users (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, household_id) references public.households (tenant_id, id) on delete cascade,
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade,
  foreign key (tenant_id, membership_id) references public.memberships (tenant_id, id) on delete set null (membership_id)
);
select app.setup_tenant_table('public.gear_fulfilments', 'retail.sell', 'retail.sell', 'retail');
create index gear_fulfilments_open on public.gear_fulfilments (tenant_id, status) where status <> 'delivered';

-- Discount codes are looked up by staff at enrollment; uses are counted in the RPC.
create index discounts_code on public.discounts (tenant_id, lower(code::text)) where code is not null;

-- ---------------------------------------------------------------------------------------------
-- enroll_membership(p jsonb) — staff with billing.charge. The invoice figures come from the billing engine
-- (packages/billing) in the server action; this function persists them atomically and validates shape.
-- p = { household_id, person_id, plan_id, starts_at, billing_day, next_bill_at, ends_at, contract_ends_at,
--       price_override_cents, discount_ids[], autopay, payment_method_id, notes,
--       invoice: { due_at, subtotal_cents, discount_cents, tax_cents, total_cents, memo,
--                  lines: [{ kind, description, quantity, unit_cents, total_cents, tax_rate }] },
--       gear: [{ variant_id, product_name, size }],
--       payment: null | { method: cash|check|external, amount_cents, memo } }
-- Returns { membership_id, invoice_id, payment_id, fulfilment_id }.
-- ---------------------------------------------------------------------------------------------
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
      insert into public.invoice_lines (tenant_id, invoice_id, kind, description, quantity, unit_cents, total_cents, ref_type, ref_id, tax_rate)
      values (tid, inv_id, line ->> 'kind', line ->> 'description', coalesce((line ->> 'quantity')::int, 1), (line ->> 'unit_cents')::int,
              (line ->> 'total_cents')::int, case when line ->> 'kind' = 'membership' then 'membership' end,
              case when line ->> 'kind' = 'membership' then mid end, nullif(line ->> 'tax_rate', '')::numeric);
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
revoke execute on function public.enroll_membership(jsonb) from public, anon;
grant execute on function public.enroll_membership(jsonb) to authenticated;

-- Fulfilment queue with names for the Desk.
create view public.v_gear_fulfilments with (security_invoker = true) as
  select f.tenant_id, f.id, f.status, f.sizes, f.variant_ids, f.created_at, f.delivered_at, f.notes,
         f.household_id, h.name as household_name, f.person_id,
         trim(coalesce(pe.preferred_name, pe.first_name) || ' ' || pe.last_name) as person_name,
         f.membership_id, mp.name as plan_name
  from public.gear_fulfilments f
  join public.households h on h.id = f.household_id
  join public.people pe on pe.id = f.person_id
  left join public.memberships m on m.id = f.membership_id
  left join public.membership_plans mp on mp.id = m.plan_id;

select app.index_foreign_keys();
