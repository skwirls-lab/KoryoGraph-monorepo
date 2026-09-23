-- 0036 Retail & inventory (§4.7, F8.1, F8.2; POS tables for F8.3). products / product_variants /
-- gear_fulfilments already exist (0031). Stock is ledger-first: inventory_movements is append-only and a
-- trigger maintains inventory_levels.on_hand; people change stock only through adjust_inventory().

create table public.inventory_levels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  variant_id uuid not null,
  location_id uuid not null,
  on_hand int not null default 0,
  reserved int not null default 0 check (reserved >= 0),
  reorder_point int not null default 0 check (reorder_point >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (variant_id, location_id),
  foreign key (tenant_id, variant_id) references public.product_variants (tenant_id, id) on delete cascade,
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.inventory_levels', null, 'retail.sell', 'retail');

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  variant_id uuid not null,
  location_id uuid not null,
  delta int not null check (delta <> 0),
  reason text not null check (reason in ('sale', 'return', 'receive', 'adjust', 'transfer', 'package')),
  ref_type text,
  ref_id uuid,
  by_user_id uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, variant_id) references public.product_variants (tenant_id, id) on delete cascade,
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.inventory_movements', null, 'retail.sell', 'retail');
create index inventory_movements_variant on public.inventory_movements (tenant_id, variant_id, created_at desc);

create or replace function app.inventory_movement_applied()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.inventory_levels (tenant_id, variant_id, location_id, on_hand)
  values (new.tenant_id, new.variant_id, new.location_id, new.delta)
  on conflict (variant_id, location_id) do update set on_hand = public.inventory_levels.on_hand + excluded.on_hand;
  return null;
end;
$$;
create trigger inventory_movement_applied after insert on public.inventory_movements
  for each row execute function app.inventory_movement_applied();

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  contact jsonb not null default '{}'::jsonb,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.setup_tenant_table('public.suppliers', 'inventory.manage', 'inventory.manage', 'retail');

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  supplier_id uuid not null,
  location_id uuid,
  status text not null default 'draft' check (status in ('draft', 'sent', 'partial', 'received', 'cancelled')),
  expected_at date,
  notes text,
  ai_intake_run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, supplier_id) references public.suppliers (tenant_id, id),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id)
);
select app.setup_tenant_table('public.purchase_orders', 'inventory.manage', 'inventory.manage', 'retail');

create table public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  po_id uuid not null,
  variant_id uuid not null,
  qty_ordered int not null check (qty_ordered > 0),
  qty_received int not null default 0 check (qty_received >= 0),
  unit_cost_cents int not null default 0 check (unit_cost_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, po_id) references public.purchase_orders (tenant_id, id) on delete cascade,
  foreign key (tenant_id, variant_id) references public.product_variants (tenant_id, id)
);
select app.setup_tenant_table('public.purchase_order_lines', 'inventory.manage', 'inventory.manage', 'retail');

-- POS (used from M2.09).
create table public.terminal_readers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  location_id uuid,
  stripe_reader_id text not null,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, stripe_reader_id),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id) on delete set null (location_id)
);
select app.setup_tenant_table('public.terminal_readers', 'settings.manage', 'retail.sell', 'retail');

create table public.cash_drawers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  location_id uuid not null,
  opened_by uuid references auth.users (id) on delete set null,
  opened_at timestamptz not null default now(),
  opening_cents int not null check (opening_cents >= 0),
  closed_by uuid references auth.users (id) on delete set null,
  closed_at timestamptz,
  closing_cents int check (closing_cents >= 0),
  expected_cents int,
  variance_cents int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id)
);
select app.setup_tenant_table('public.cash_drawers', null, 'retail.sell', 'retail');
create unique index cash_drawers_one_open on public.cash_drawers (location_id) where closed_at is null;

create table public.pos_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  location_id uuid not null,
  household_id uuid,
  person_id uuid,
  cashier_user_id uuid references auth.users (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'completed', 'refunded', 'void')),
  kind text not null default 'sale' check (kind in ('sale', 'return')),
  original_sale_id uuid,
  subtotal_cents int not null default 0,
  discount_cents int not null default 0,
  tax_cents int not null default 0,
  total_cents int not null default 0,
  invoice_id uuid,
  receipt_number bigint,
  terminal_reader_id uuid,
  drawer_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, receipt_number),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id),
  foreign key (tenant_id, household_id) references public.households (tenant_id, id) on delete set null (household_id),
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete set null (person_id),
  foreign key (tenant_id, invoice_id) references public.invoices (tenant_id, id) on delete set null (invoice_id),
  foreign key (tenant_id, terminal_reader_id) references public.terminal_readers (tenant_id, id) on delete set null (terminal_reader_id),
  foreign key (tenant_id, drawer_id) references public.cash_drawers (tenant_id, id) on delete set null (drawer_id)
);
select app.setup_tenant_table('public.pos_sales', null, 'retail.sell', 'retail');
alter table public.pos_sales add foreign key (tenant_id, original_sale_id) references public.pos_sales (tenant_id, id);

create table public.pos_sale_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  sale_id uuid not null,
  variant_id uuid not null,
  qty int not null check (qty <> 0),
  unit_cents int not null,
  discount_cents int not null default 0 check (discount_cents >= 0),
  tax_cents int not null default 0,
  total_cents int not null,
  original_line_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, sale_id) references public.pos_sales (tenant_id, id) on delete cascade,
  foreign key (tenant_id, variant_id) references public.product_variants (tenant_id, id)
);
select app.setup_tenant_table('public.pos_sale_lines', null, 'retail.sell', 'retail');

create table public.pos_tenders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  sale_id uuid not null,
  method text not null check (method in ('cash', 'check', 'card', 'terminal', 'credit', 'external')),
  amount_cents int not null,
  payment_id uuid,
  change_cents int not null default 0 check (change_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, sale_id) references public.pos_sales (tenant_id, id) on delete cascade,
  foreign key (tenant_id, payment_id) references public.payments (tenant_id, id) on delete set null (payment_id)
);
select app.setup_tenant_table('public.pos_tenders', null, 'retail.sell', 'retail');

-- ---------------------------------------------------------------------------------------------
-- Stock operations (inventory.manage)
-- ---------------------------------------------------------------------------------------------
create or replace function public.adjust_inventory(p_variant_id uuid, p_location_id uuid, p_delta int, p_reason text, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
  mid uuid;
begin
  if tid is null or not app.has_module('retail') or not app.has_permission('inventory.manage') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_reason not in ('receive', 'adjust', 'return', 'transfer') or coalesce(p_delta, 0) = 0 then
    raise exception 'give a non-zero quantity and a reason' using errcode = '22023';
  end if;
  if p_reason = 'adjust' and length(trim(coalesce(p_note, ''))) < 2 then
    raise exception 'say why the stock is being adjusted' using errcode = '22023';
  end if;
  if not exists (select 1 from public.product_variants where id = p_variant_id and tenant_id = tid)
     or not exists (select 1 from public.locations where id = p_location_id and tenant_id = tid) then
    raise exception 'unknown variant or location' using errcode = 'P0002';
  end if;
  insert into public.inventory_movements (tenant_id, variant_id, location_id, delta, reason, by_user_id, note)
  values (tid, p_variant_id, p_location_id, p_delta, p_reason, auth.uid(), nullif(trim(p_note), ''))
  returning id into mid;
  return mid;
end;
$$;

create or replace function public.set_reorder_point(p_variant_id uuid, p_location_id uuid, p_reorder_point int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
begin
  if tid is null or not app.has_module('retail') or not app.has_permission('inventory.manage') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_reorder_point is null or p_reorder_point < 0 then
    raise exception 'reorder point must be zero or more' using errcode = '22023';
  end if;
  if not exists (select 1 from public.product_variants where id = p_variant_id and tenant_id = tid)
     or not exists (select 1 from public.locations where id = p_location_id and tenant_id = tid) then
    raise exception 'unknown variant or location' using errcode = 'P0002';
  end if;
  insert into public.inventory_levels (tenant_id, variant_id, location_id, reorder_point)
  values (tid, p_variant_id, p_location_id, p_reorder_point)
  on conflict (variant_id, location_id) do update set reorder_point = excluded.reorder_point;
end;
$$;

revoke execute on function public.adjust_inventory(uuid, uuid, int, text, text), public.set_reorder_point(uuid, uuid, int) from public, anon;
grant execute on function public.adjust_inventory(uuid, uuid, int, text, text), public.set_reorder_point(uuid, uuid, int) to authenticated;

-- Handing out an enrollment kit takes the items out of stock at the default location (and puts them back
-- if the delivery is undone).
create or replace function app.gear_fulfilment_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  loc uuid;
  v uuid;
  sign int;
begin
  if (new.status = 'delivered') = (old.status = 'delivered') then
    return null;
  end if;
  sign := case when new.status = 'delivered' then -1 else 1 end;
  select id into loc from public.locations where tenant_id = new.tenant_id order by is_default desc, created_at limit 1;
  if loc is null then
    return null;
  end if;
  foreach v in array new.variant_ids loop
    insert into public.inventory_movements (tenant_id, variant_id, location_id, delta, reason, ref_type, ref_id, by_user_id, note)
    values (new.tenant_id, v, loc, sign, 'package', 'gear_fulfilment', new.id, auth.uid(), case when sign > 0 then 'Delivery undone' end);
  end loop;
  return null;
end;
$$;
create trigger gear_fulfilment_stock after update of status on public.gear_fulfilments
  for each row execute function app.gear_fulfilment_stock();

-- Stock view: every active variant × location, with availability and the low-stock flag.
create view public.v_inventory with (security_invoker = true) as
  select v.tenant_id, v.id as variant_id, p.id as product_id, p.name as product_name, p.category, v.sku, v.barcode, v.options,
         v.price_cents, l.id as location_id, l.name as location_name,
         coalesce(il.on_hand, 0) as on_hand, coalesce(il.reserved, 0) as reserved,
         coalesce(il.on_hand, 0) - coalesce(il.reserved, 0) as available, coalesce(il.reorder_point, 0) as reorder_point,
         (coalesce(il.reorder_point, 0) > 0 and coalesce(il.on_hand, 0) - coalesce(il.reserved, 0) < coalesce(il.reorder_point, 0)) as low
  from public.product_variants v
  join public.products p on p.id = v.product_id
  join public.locations l on l.tenant_id = v.tenant_id
  left join public.inventory_levels il on il.variant_id = v.id and il.location_id = l.id
  where v.active and p.active;

-- Product images: staff who manage inventory write "<tenant>/products/…"; anyone in the tenant may read them.
create policy tenant_media_products_write on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-media' and (storage.foldername(name))[1] = (select app.tenant_id())::text
              and (storage.foldername(name))[2] = 'products' and (select app.has_permission('inventory.manage')));
create policy tenant_media_products_delete on storage.objects for delete to authenticated
  using (bucket_id = 'tenant-media' and (storage.foldername(name))[1] = (select app.tenant_id())::text
         and (storage.foldername(name))[2] = 'products' and (select app.has_permission('inventory.manage')));
create policy tenant_media_products_read on storage.objects for select to authenticated
  using (bucket_id = 'tenant-media' and (storage.foldername(name))[1] = (select app.tenant_id())::text
         and (storage.foldername(name))[2] = 'products');

select app.index_foreign_keys();
