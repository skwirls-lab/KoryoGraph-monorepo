-- 0005 Custom access token hook (F2.2) and app.create_tenant (F1.3).

create schema if not exists auth_hook;

-- Adds app_metadata.{tenant_id, role, permissions[], modules[], platform_admin} to every access token.
-- Tenant = profiles.active_tenant_id when the user is an active member of it, else their oldest active
-- membership. No membership → tenant claims removed (the app routes such users to onboarding).
create or replace function auth_hook.custom_access_token(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (event ->> 'user_id')::uuid;
  claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  meta jsonb := coalesce(claims -> 'app_metadata', '{}'::jsonb);
  preferred uuid;
  tid uuid;
  rid uuid;
  rkey text;
  perms jsonb;
  mods jsonb;
  is_admin boolean;
begin
  select p.active_tenant_id into preferred from public.profiles p where p.id = uid;

  select tu.tenant_id, tu.role_id into tid, rid
  from public.tenant_users tu
  join public.tenants t on t.id = tu.tenant_id
  where tu.user_id = uid and tu.status = 'active' and t.status <> 'suspended'
  order by (tu.tenant_id = preferred) desc nulls last, tu.created_at asc
  limit 1;

  select exists (select 1 from public.platform_admins pa where pa.user_id = uid) into is_admin;

  meta := meta - 'tenant_id' - 'role' - 'permissions' - 'modules' - 'platform_admin';

  if tid is not null then
    select r.key into rkey from public.roles r where r.id = rid;
    select coalesce(jsonb_agg(rp.permission_key order by rp.permission_key), '[]'::jsonb) into perms
      from public.role_permissions rp where rp.role_id = rid;
    select coalesce(jsonb_agg(te.module_key order by te.module_key), '[]'::jsonb) into mods
      from public.tenant_entitlements te
      where te.tenant_id = tid and te.starts_at <= now() and (te.ends_at is null or te.ends_at > now());
    meta := meta || jsonb_build_object('tenant_id', tid, 'role', rkey, 'permissions', perms, 'modules', mods);
  end if;

  if is_admin then
    meta := meta || jsonb_build_object('platform_admin', true);
  end if;

  claims := jsonb_set(claims, '{app_metadata}', meta);
  return jsonb_build_object('claims', claims);
end;
$$;

grant usage on schema auth_hook to supabase_auth_admin;
grant execute on function auth_hook.custom_access_token(jsonb) to supabase_auth_admin;
revoke execute on function auth_hook.custom_access_token(jsonb) from authenticated, anon, public;

-- ---------------------------------------------------------------------------------------------
-- Default roles for a new tenant.
-- ---------------------------------------------------------------------------------------------
create or replace function app.default_role_permissions(role_key text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case role_key
    when 'owner' then array[
      'desk.access','mat.access','home.access','people.read','people.write','people.medical.read','attendance.write',
      'curriculum.write','ranks.promote','testing.manage','billing.read','billing.charge','billing.refund','retail.sell',
      'inventory.manage','crm.manage','comms.send','automations.manage','events.manage','staff.manage','roles.manage',
      'settings.manage','reports.read','ai.approve','ai.use','exports.run','audit.read','kiosk.manage']
    when 'admin' then array[
      'desk.access','mat.access','people.read','people.write','people.medical.read','attendance.write',
      'curriculum.write','ranks.promote','testing.manage','billing.read','billing.charge','billing.refund','retail.sell',
      'inventory.manage','crm.manage','comms.send','automations.manage','events.manage','staff.manage',
      'settings.manage','reports.read','ai.approve','ai.use','exports.run','audit.read','kiosk.manage']
    when 'front_desk' then array[
      'desk.access','people.read','people.write','attendance.write','billing.read','billing.charge','retail.sell',
      'crm.manage','comms.send','events.manage','reports.read','ai.use','kiosk.manage']
    when 'instructor' then array[
      'mat.access','people.read','people.medical.read','attendance.write','curriculum.write','ranks.promote',
      'testing.manage','comms.send','ai.use','ai.approve']
    when 'assistant_instructor' then array['mat.access','people.read','attendance.write']
    when 'parent' then array['home.access']
    when 'student' then array['home.access']
    else array[]::text[]
  end;
$$;

create or replace function app.seed_default_roles(tid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  new_role uuid;
begin
  for r in
    select * from (values
      ('owner', 'Owner', 'desk', 'Full access, including billing, roles and settings.'),
      ('admin', 'Admin', 'desk', 'Everything except editing roles.'),
      ('front_desk', 'Front desk', 'desk', 'People, attendance, payments, POS, CRM and messaging.'),
      ('instructor', 'Instructor', 'mat', 'Classes, attendance, curriculum, promotions and testing.'),
      ('assistant_instructor', 'Assistant instructor', 'mat', 'Class rosters and attendance.'),
      ('parent', 'Parent / guardian', 'home', 'Family progress, schedule, billing and messages.'),
      ('student', 'Student', 'home', 'Own progress, schedule and messages.')
    ) as v(key, name, surface, description)
  loop
    insert into public.roles (tenant_id, key, name, surface, is_system, description)
    values (tid, r.key, r.name, r.surface, true, r.description)
    on conflict (tenant_id, key) do update set name = excluded.name
    returning id into new_role;

    insert into public.role_permissions (tenant_id, role_id, permission_key)
    select tid, new_role, p from unnest(app.default_role_permissions(r.key)) as p
    where exists (select 1 from public.permissions where key = p)
    on conflict do nothing;
  end loop;
end;
$$;

-- Hook for later milestones to add per-tenant defaults (programs, pipeline stages, templates …).
create or replace function app.seed_tenant_defaults(tid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  return;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Self-serve tenant creation: tenant + default location + roles + owner membership + 14-day trial of
-- every module, in one transaction. Callable by the owner themself or a platform admin.
-- ---------------------------------------------------------------------------------------------
create or replace function app.create_tenant(
  p_name text,
  p_slug text,
  p_timezone text,
  p_owner_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid;
  base_slug text;
  final_slug text;
  n int := 1;
  owner_role uuid;
begin
  if p_owner_user_id is null then
    raise exception 'owner is required' using errcode = '22023';
  end if;
  -- Inside security definer current_user is the owner, so authorise on the JWT and the session user:
  -- the owner themself, a platform admin, the service role, or a direct superuser session (seed scripts).
  if not (
    auth.uid() is not distinct from p_owner_user_id
    or app.is_platform_admin()
    or coalesce(auth.role(), '') = 'service_role'
    or (auth.uid() is null and session_user in ('postgres', 'supabase_admin'))
  ) then
    raise exception 'not allowed to create a tenant for another user' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'school name is required' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'unknown timezone %', p_timezone using errcode = '22023';
  end if;

  base_slug := trim(both '-' from regexp_replace(lower(coalesce(nullif(trim(p_slug), ''), p_name)), '[^a-z0-9]+', '-', 'g'));
  base_slug := left(coalesce(nullif(base_slug, ''), 'school'), 40);
  final_slug := base_slug;
  while exists (select 1 from public.tenants where slug = final_slug) loop
    n := n + 1;
    final_slug := base_slug || '-' || n;
  end loop;

  insert into public.tenants (name, slug, timezone, status, trial_ends_at, onboarding)
  values (
    trim(p_name), final_slug, p_timezone, 'trial', now() + interval '14 days',
    jsonb_build_object('steps', jsonb_build_object(
      'location', false, 'programs', false, 'schedule', false, 'students', false,
      'payments', false, 'staff', false, 'branding', false), 'dismissed', false)
  )
  returning id into tid;

  insert into public.locations (tenant_id, name, timezone, is_default)
  values (tid, 'Main location', p_timezone, true);

  perform app.seed_default_roles(tid);
  select id into owner_role from public.roles where tenant_id = tid and key = 'owner';

  insert into public.tenant_users (tenant_id, user_id, role_id, status, accepted_at)
  values (tid, p_owner_user_id, owner_role, 'active', now());

  insert into public.tenant_entitlements (tenant_id, module_key, source, starts_at, ends_at)
  select tid, m.key, 'trial', now(), now() + interval '14 days' from public.modules m;

  insert into public.tenant_subscriptions (tenant_id, plan_key, status, current_period_end)
  values (tid, null, 'trialing', now() + interval '14 days');

  perform app.seed_tenant_defaults(tid);

  update public.profiles set active_tenant_id = tid where id = p_owner_user_id;

  return tid;
end;
$$;
revoke execute on function app.create_tenant(text, text, text, uuid) from public, anon;
grant execute on function app.create_tenant(text, text, text, uuid) to authenticated, service_role;

-- Public wrapper so PostgREST (which exposes `public` only) can call it: supabase.rpc('create_tenant').
create or replace function public.create_tenant(p_name text, p_slug text, p_timezone text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select app.create_tenant(p_name, p_slug, p_timezone, auth.uid());
$$;
revoke execute on function public.create_tenant(text, text, text) from public, anon;
grant execute on function public.create_tenant(text, text, text) to authenticated;

-- Switch the active tenant (validated by app.check_active_tenant). Client then refreshes the session.
create or replace function public.switch_tenant(p_tenant_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.profiles set active_tenant_id = p_tenant_id where id = auth.uid();
$$;
revoke execute on function public.switch_tenant(uuid) from public, anon;
grant execute on function public.switch_tenant(uuid) to authenticated;

-- Supabase exposes new public functions to anon by default; lock down the app schema too.
revoke execute on all functions in schema app from public;
grant execute on function
  app.user_id(), app.tenant_id(), app.role(), app.has_permission(text), app.has_module(text),
  app.is_platform_admin(), app.household_ids(), app.member_tenant_ids()
to anon, authenticated, service_role;
grant execute on function app.audit_custom(text, uuid, text, jsonb) to authenticated;
grant execute on function app.create_tenant(text, text, text, uuid) to authenticated, service_role;
