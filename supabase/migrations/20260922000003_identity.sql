-- 0003 Identity, access (§4.2): profiles, permissions catalogue, roles, tenant membership, invitations.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email extensions.citext,
  full_name text,
  avatar_url text,
  phone text,
  preferred_theme text check (preferred_theme in ('koryo-red', 'dark', 'light', 'midnight', 'warm')),
  active_tenant_id uuid references public.tenants (id) on delete set null,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.profiles for each row execute function app.set_updated_at();

-- Profile row for every auth user.
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

create or replace function app.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email) execute function app.handle_user_email_change();

create table public.permissions (
  key text primary key,
  domain text not null,
  description text not null default ''
);
alter table public.permissions enable row level security;
create policy permissions_read on public.permissions for select to authenticated using (true);
create policy permissions_admin_write on public.permissions
  for all to authenticated using ((select app.is_platform_admin())) with check ((select app.is_platform_admin()));

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  name text not null,
  surface text not null default 'desk' check (surface in ('desk', 'mat', 'home')),
  is_system boolean not null default false,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key)
);
select app.setup_tenant_table('public.roles', 'roles.manage');

create table public.role_permissions (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  role_id uuid not null,
  permission_key text not null references public.permissions (key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_key),
  foreign key (tenant_id, role_id) references public.roles (tenant_id, id) on delete cascade
);
-- role_permissions has no `id`; policies only (no (tenant_id, id) key).
select app.apply_tenant_policies('public.role_permissions', 'roles.manage');

create table public.tenant_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id uuid not null,
  status text not null default 'active' check (status in ('invited', 'active', 'disabled')),
  invited_email extensions.citext,
  invited_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  location_ids uuid[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id),
  foreign key (tenant_id, role_id) references public.roles (tenant_id, id)
);
select app.setup_tenant_table('public.tenant_users', 'staff.manage');
-- A user always sees their own memberships (tenant switcher).
create policy tenant_users_self_select on public.tenant_users
  for select to authenticated using (user_id = (select auth.uid()));

-- Tenants a user belongs to are readable (switcher), in addition to the current tenant.
create or replace function app.member_tenant_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(tenant_id), '{}') from public.tenant_users
  where user_id = auth.uid() and status = 'active';
$$;
grant execute on function app.member_tenant_ids() to authenticated;
create policy tenants_member_select on public.tenants
  for select to authenticated using (id = any (app.member_tenant_ids()));

-- Profiles: self, plus co-members of the current tenant (names of staff and linked guardians).
alter table public.profiles enable row level security;
create policy profiles_self_select on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_self_update on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_tenant_select on public.profiles
  for select to authenticated using (
    exists (
      select 1 from public.tenant_users tu
      where tu.user_id = profiles.id and tu.tenant_id = (select app.tenant_id())
    )
  );

-- active_tenant_id may only point at a tenant the user is an active member of.
create or replace function app.check_active_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.active_tenant_id is not null
     and new.active_tenant_id is distinct from old.active_tenant_id
     and not exists (
       select 1 from public.tenant_users
       where user_id = new.id and tenant_id = new.active_tenant_id and status = 'active'
     )
     and not exists (select 1 from public.platform_admins where user_id = new.id) then
    raise exception 'not a member of tenant %', new.active_tenant_id using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger check_active_tenant before update of active_tenant_id on public.profiles
  for each row execute function app.check_active_tenant();

create table public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  email extensions.citext not null,
  role_id uuid not null,
  token_hash text not null unique,
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, role_id) references public.roles (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.staff_invitations', 'staff.manage', 'staff.manage');

select app.index_foreign_keys();
