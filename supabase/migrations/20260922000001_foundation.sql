-- 0001 Foundation: extensions, the `app` schema, JWT helpers, the tenant policy generator.
-- Every tenant-scoped table is set up through app.setup_tenant_table(), which enables RLS, installs the
-- standard policies (§3.4), the updated_at trigger, the audit trigger (0004) and the (tenant_id, id)
-- unique key that child tables reference with composite foreign keys, so a row can never point at
-- another tenant's record (FK checks bypass RLS).

create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists citext with schema extensions;

create schema if not exists app;
grant usage on schema app to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Generic triggers
-- ---------------------------------------------------------------------------------------------
create or replace function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- JWT helpers. Claims are written by auth_hook.custom_access_token (0005) into app_metadata.
-- ---------------------------------------------------------------------------------------------
create or replace function app.user_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select auth.uid();
$$;

create or replace function app.tenant_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid;
$$;

create or replace function app.role()
returns text
language sql
stable
set search_path = ''
as $$
  select auth.jwt() -> 'app_metadata' ->> 'role';
$$;

create or replace function app.has_permission(permission text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' -> 'permissions') ? permission, false);
$$;

create or replace function app.has_module(module text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' -> 'modules') ? module, false);
$$;

-- Platform admin status is checked against the table (not only the claim) so revocation is immediate.
-- Defined here as a stub; 0002 replaces it once platform_admins exists.
create or replace function app.is_platform_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select false;
$$;

-- Households the signed-in user belongs to (as a guardian/student with a login). Real body in M1.01.
create or replace function app.household_ids()
returns uuid[]
language sql
stable
set search_path = ''
as $$
  select '{}'::uuid[];
$$;

grant execute on function
  app.user_id(), app.tenant_id(), app.role(), app.has_permission(text), app.has_module(text),
  app.is_platform_admin(), app.household_ids()
to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Policy generator (§3.4). Creates the standard tenant policies on a table with a tenant_id column.
--   select: tenant_id = app.tenant_id() [and has_permission(read_permission)]
--   insert/update/delete: tenant_id = app.tenant_id() and app.has_permission(write_permission)
-- write_permission null → read-only for tenant users (writes via security-definer RPCs / service role).
-- ---------------------------------------------------------------------------------------------
create or replace function app.apply_tenant_policies(
  tbl regclass,
  write_permission text,
  read_permission text default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  t text := tbl::text;
  n text := (select c.relname from pg_catalog.pg_class c where c.oid = tbl);
  tenant_pred text := 'tenant_id = (select app.tenant_id())';
  read_pred text;
  write_pred text;
begin
  execute format('alter table %s enable row level security', t);

  read_pred := tenant_pred;
  if read_permission is not null then
    read_pred := format('%s and (select app.has_permission(%L))', tenant_pred, read_permission);
  end if;

  execute format('drop policy if exists %I on %s', n || '_tenant_select', t);
  execute format('create policy %I on %s for select to authenticated using (%s)', n || '_tenant_select', t, read_pred);

  execute format('drop policy if exists %I on %s', n || '_tenant_insert', t);
  execute format('drop policy if exists %I on %s', n || '_tenant_update', t);
  execute format('drop policy if exists %I on %s', n || '_tenant_delete', t);

  if write_permission is not null then
    write_pred := format('%s and (select app.has_permission(%L))', tenant_pred, write_permission);
    execute format('create policy %I on %s for insert to authenticated with check (%s)', n || '_tenant_insert', t, write_pred);
    execute format('create policy %I on %s for update to authenticated using (%s) with check (%s)', n || '_tenant_update', t, write_pred, write_pred);
    execute format('create policy %I on %s for delete to authenticated using (%s)', n || '_tenant_delete', t, write_pred);
  end if;
end;
$$;

-- Audit attachment is a no-op until 0004 replaces it.
create or replace function app.attach_audit(tbl regclass)
returns void
language plpgsql
set search_path = ''
as $$
begin
  return;
end;
$$;

-- One call per tenant-scoped table: RLS + policies + (tenant_id, id) key + updated_at + audit.
create or replace function app.setup_tenant_table(
  tbl regclass,
  write_permission text,
  read_permission text default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  t text := tbl::text;
  n text := (select c.relname from pg_catalog.pg_class c where c.oid = tbl);
begin
  perform app.apply_tenant_policies(tbl, write_permission, read_permission);

  if not exists (
    select 1 from pg_catalog.pg_constraint where conrelid = tbl and conname = n || '_tenant_id_id_key'
  ) then
    execute format('alter table %s add constraint %I unique (tenant_id, id)', t, n || '_tenant_id_id_key');
  end if;

  if exists (
    select 1 from pg_catalog.pg_attribute where attrelid = tbl and attname = 'updated_at' and not attisdropped
  ) then
    execute format('drop trigger if exists set_updated_at on %s', t);
    execute format('create trigger set_updated_at before update on %s for each row execute function app.set_updated_at()', t);
  end if;

  perform app.attach_audit(tbl);
end;
$$;

-- Guard (e): every foreign key column set in `public` has a covering index. Called at the end of
-- each migration so new FKs are always indexed.
create or replace function app.index_foreign_keys()
returns void
language plpgsql
set search_path = ''
as $$
declare
  r record;
  cols text;
  idx text;
begin
  for r in
    select c.conrelid, c.conkey, cl.relname
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_class cl on cl.oid = c.conrelid
    join pg_catalog.pg_namespace ns on ns.oid = cl.relnamespace
    where c.contype = 'f' and ns.nspname = 'public'
      and not exists (
        select 1 from pg_catalog.pg_index i
        where i.indrelid = c.conrelid
          and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] @> c.conkey
          and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] <@ c.conkey
      )
  loop
    select string_agg(quote_ident(a.attname), ', ' order by k.ord), string_agg(a.attname, '_' order by k.ord)
      into cols, idx
    from unnest(r.conkey) with ordinality as k(attnum, ord)
    join pg_catalog.pg_attribute a on a.attrelid = r.conrelid and a.attnum = k.attnum;
    idx := left(r.relname || '_' || idx || '_fkx', 63);
    execute format('create index if not exists %I on public.%I (%s)', idx, r.relname, cols);
  end loop;
end;
$$;
