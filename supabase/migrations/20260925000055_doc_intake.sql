-- 0055 Document intake (A6, M4.08). A packing slip (image/PDF) is read by the vision tier into lines; each
-- line is matched to a product variant (exact SKU, else trigram similarity of names) with a confidence; the
-- draft waits in Approvals. Approving creates a received purchase order and the stock movements, atomically.

-- Best variant for each text: exact SKU match = 1.0, else similarity of "product name + size" to the text.
create or replace function public.intake_match(p_texts text[], p_skus text[])
returns table (idx int, variant_id uuid, sku text, label text, confidence real)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.idx::int, m.id, m.sku, m.label, m.conf
  from unnest(p_texts, p_skus) with ordinality as t(txt, sku_text, idx)
  cross join lateral (
    select v.id, v.sku, trim(p.name || ' ' || coalesce(v.options ->> 'size', '')) as label,
           case when upper(trim(coalesce(t.sku_text, ''))) = upper(v.sku) then 1.0::real
                else extensions.similarity(lower(p.name || ' ' || coalesce(v.options ->> 'size', '') || ' ' || v.sku), lower(coalesce(t.txt, ''))) end as conf
    from public.product_variants v join public.products p on p.id = v.product_id
    where v.active
    order by 4 desc
    limit 1
  ) m;
$$;
grant execute on function public.intake_match(text[], text[]) to authenticated;

-- Carry out an approved intake: one received PO (lines per included, matched row) + 'receive' movements.
create or replace function public.receive_intake(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
  it public.approval_items;
  p jsonb;
  r jsonb;
  po uuid;
  loc uuid;
  n int := 0;
  units int := 0;
  result jsonb;
begin
  if tid is null or not app.has_module('retail') or not app.has_module('intelligence') or not app.has_permission('inventory.manage') or not app.has_permission('ai.approve') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into it from public.approval_items where id = p_id and tenant_id = tid and kind = 'doc_intake' for update;
  if not found or it.status <> 'approved' then
    raise exception 'approve the intake first' using errcode = '22023';
  end if;
  if it.executed_at is not null then
    return it.execution_result;
  end if;
  p := it.payload;
  if not exists (select 1 from public.suppliers where id = (p ->> 'supplier_id')::uuid and tenant_id = tid) then
    raise exception 'choose the supplier' using errcode = '22023';
  end if;
  loc := coalesce(nullif(p ->> 'location_id', '')::uuid, (select id from public.locations where tenant_id = tid and is_default limit 1));
  insert into public.purchase_orders (tenant_id, supplier_id, location_id, status, notes, ai_intake_run_id)
  values (tid, (p ->> 'supplier_id')::uuid, loc, 'received', 'Received from packing slip' || coalesce(' ' || nullif(p ->> 'reference', ''), ''), it.ai_run_id)
  returning id into po;
  for r in select * from jsonb_array_elements(coalesce(p -> 'lines', '[]')) loop
    continue when not (r ->> 'include')::boolean or nullif(r ->> 'variant_id', '') is null or coalesce((r ->> 'quantity')::int, 0) <= 0;
    if not exists (select 1 from public.product_variants where id = (r ->> 'variant_id')::uuid and tenant_id = tid) then
      raise exception 'unknown product on a line' using errcode = '22023';
    end if;
    insert into public.purchase_order_lines (tenant_id, po_id, variant_id, qty_ordered, qty_received, unit_cost_cents)
    values (tid, po, (r ->> 'variant_id')::uuid, (r ->> 'quantity')::int, (r ->> 'quantity')::int, nullif(r ->> 'unit_cost_cents', '')::int);
    insert into public.inventory_movements (tenant_id, variant_id, location_id, delta, reason, ref_type, ref_id, by_user_id, note)
    values (tid, (r ->> 'variant_id')::uuid, loc, (r ->> 'quantity')::int, 'receive', 'purchase_order', po, auth.uid(), left(r ->> 'description', 200));
    n := n + 1;
    units := units + (r ->> 'quantity')::int;
  end loop;
  if n = 0 then
    raise exception 'no lines to receive' using errcode = '22023';
  end if;
  result := jsonb_build_object('ok', true, 'summary', units || ' units received on ' || n || ' line' || case when n = 1 then '' else 's' end, 'detail', jsonb_build_object('purchase_order_id', po, 'lines', n, 'units', units));
  update public.approval_items set executed_at = now(), execution_result = result, entity_type = 'purchase_order', entity_id = po where id = it.id;
  return result;
end;
$$;
revoke execute on function public.receive_intake(uuid) from public, anon;
grant execute on function public.receive_intake(uuid) to authenticated;

-- Uploaded slips: "<tenant>/intake/<file>", inventory managers only.
create policy tenant_media_intake_write on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-media' and (storage.foldername(name))[1] = (select app.tenant_id())::text
              and (storage.foldername(name))[2] = 'intake' and (select app.has_permission('inventory.manage')));
create policy tenant_media_intake_read on storage.objects for select to authenticated
  using (bucket_id = 'tenant-media' and (storage.foldername(name))[1] = (select app.tenant_id())::text
         and (storage.foldername(name))[2] = 'intake' and (select app.has_permission('inventory.manage')));
