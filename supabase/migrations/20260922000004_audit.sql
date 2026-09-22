-- 0004 Audit log (F1.6). Every insert/update/delete on a tenant-scoped table writes audit_events
-- with actor, entity and a before/after diff. Attached by app.setup_tenant_table() from here on,
-- and retro-fitted to the tenant tables created in 0002–0003.

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  actor_user_id uuid,
  actor_role text,
  entity_type text not null,
  entity_id uuid,
  action text not null check (action in ('create', 'update', 'delete', 'custom')),
  before jsonb,
  after jsonb,
  ip text,
  request_id text,
  note text,
  created_at timestamptz not null default now()
);
create index audit_events_entity on public.audit_events (tenant_id, entity_type, entity_id, created_at desc);
create index audit_events_created on public.audit_events (tenant_id, created_at desc);
-- Readable with audit.read; written only by the trigger (security definer) and app.audit_custom().
select app.apply_tenant_policies('public.audit_events', null, 'audit.read');
alter table public.audit_events add constraint audit_events_tenant_id_id_key unique (tenant_id, id);

create or replace function app.request_header(name text)
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('request.headers', true), '')::jsonb ->> name;
$$;

create or replace function app.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_j jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_j jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  b jsonb;
  a jsonb;
  k text;
  row_j jsonb := coalesce(new_j, old_j);
  tid uuid := (row_j ->> 'tenant_id')::uuid;
begin
  if tg_op = 'UPDATE' then
    b := '{}'::jsonb;
    a := '{}'::jsonb;
    for k in select jsonb_object_keys(new_j) loop
      if k <> 'updated_at' and (old_j -> k) is distinct from (new_j -> k) then
        b := b || jsonb_build_object(k, old_j -> k);
        a := a || jsonb_build_object(k, new_j -> k);
      end if;
    end loop;
    if a = '{}'::jsonb then
      return null;
    end if;
  else
    b := old_j;
    a := new_j;
  end if;

  -- Tenant deleted in the same transaction (cascade): nothing to attach the event to.
  if not exists (select 1 from public.tenants where id = tid) then
    return null;
  end if;

  insert into public.audit_events (tenant_id, actor_user_id, actor_role, entity_type, entity_id, action, before, after, ip, request_id)
  values (
    tid,
    auth.uid(),
    coalesce(app.role(), current_user),
    tg_table_name,
    (row_j ->> 'id')::uuid,
    case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'delete' end,
    b,
    a,
    coalesce(app.request_header('x-forwarded-for'), app.request_header('x-real-ip')),
    app.request_header('x-request-id')
  );
  return null;
end;
$$;

create or replace function app.attach_audit(tbl regclass)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format('drop trigger if exists audit on %s', tbl::text);
  execute format('create trigger audit after insert or update or delete on %s for each row execute function app.audit_trigger()', tbl::text);
end;
$$;

-- Explicit audit entry for actions that are not a plain row change (e.g. "impersonated", "exported").
create or replace function app.audit_custom(entity_type text, entity_id uuid, note text, payload jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.tenant_id() is null then
    raise exception 'no tenant in session' using errcode = '42501';
  end if;
  insert into public.audit_events (tenant_id, actor_user_id, actor_role, entity_type, entity_id, action, after, note, ip, request_id)
  values (app.tenant_id(), auth.uid(), app.role(), entity_type, entity_id, 'custom', payload, note,
          coalesce(app.request_header('x-forwarded-for'), app.request_header('x-real-ip')),
          app.request_header('x-request-id'));
end;
$$;
grant execute on function app.audit_custom(text, uuid, text, jsonb) to authenticated;

-- Retro-fit audit triggers to every tenant-scoped table created so far (except the log itself).
do $$
declare
  r record;
begin
  for r in
    select c.oid::regclass as tbl
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'audit_events'
      and exists (select 1 from pg_catalog.pg_attribute a where a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped)
  loop
    perform app.attach_audit(r.tbl);
  end loop;
end;
$$;

-- Tenants themselves are audited against their own id.
create or replace function app.audit_tenant_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  b jsonb := '{}'::jsonb;
  a jsonb := '{}'::jsonb;
  k text;
  old_j jsonb := to_jsonb(old);
  new_j jsonb := to_jsonb(new);
begin
  for k in select jsonb_object_keys(new_j) loop
    if k <> 'updated_at' and (old_j -> k) is distinct from (new_j -> k) then
      b := b || jsonb_build_object(k, old_j -> k);
      a := a || jsonb_build_object(k, new_j -> k);
    end if;
  end loop;
  if a <> '{}'::jsonb then
    insert into public.audit_events (tenant_id, actor_user_id, actor_role, entity_type, entity_id, action, before, after)
    values (new.id, auth.uid(), coalesce(app.role(), current_user), 'tenants', new.id, 'update', b, a);
  end if;
  return null;
end;
$$;
create trigger audit after update on public.tenants for each row execute function app.audit_tenant_trigger();

select app.index_foreign_keys();
