-- 0006 People & households (§4.2, F3.1, F2.5–F2.7).
-- Staff read people with people.read; Home users (guardians/students with a login) read only the
-- households they belong to (app.household_ids()). Medical notes live in people_medical, readable only
-- with people.medical.read (RLS cannot hide a single column).

create table public.people (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  type_flags text[] not null default '{student}' check (type_flags <@ array['student', 'guardian', 'staff', 'lead']::text[] and cardinality(type_flags) > 0),
  first_name text not null check (length(trim(first_name)) > 0),
  last_name text not null default '',
  preferred_name text,
  dob date check (dob is null or dob > '1900-01-01'),
  gender text,
  email extensions.citext,
  phone text,
  phone_sms_consent boolean not null default false,
  email_consent boolean not null default false,
  photo_path text,
  address jsonb not null default '{}'::jsonb,
  emergency_contacts jsonb not null default '[]'::jsonb,
  allergies text[] not null default '{}',
  injury_flags text[] not null default '{}',
  tags text[] not null default '{}',
  custom jsonb not null default '{}'::jsonb,
  user_id uuid references auth.users (id) on delete set null,
  primary_location_id uuid,
  status text not null default 'active' check (status in ('lead', 'trial', 'active', 'on_hold', 'cancelled', 'alumni', 'staff', 'guardian_only')),
  status_changed_at timestamptz not null default now(),
  status_reason text,
  source text,
  utm jsonb not null default '{}'::jsonb,
  referred_by_person_id uuid,
  kukkiwon_id text,
  uniform_size text,
  belt_size text,
  external_id text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, primary_location_id) references public.locations (tenant_id, id) on delete set null (primary_location_id),
  unique (tenant_id, user_id),
  unique (tenant_id, external_id)
);
select app.setup_tenant_table('public.people', 'people.write', 'people.read');
alter table public.people
  add constraint people_referred_by_fk foreign key (tenant_id, referred_by_person_id)
  references public.people (tenant_id, id) on delete set null (referred_by_person_id);

create index people_name_trgm on public.people
  using gin ((lower(first_name || ' ' || last_name || ' ' || coalesce(preferred_name, ''))) extensions.gin_trgm_ops);
create index people_email on public.people (tenant_id, email);
create index people_phone on public.people (tenant_id, phone);
create index people_status on public.people (tenant_id, status) where archived_at is null;

-- Track lifecycle changes (F3.2).
create or replace function app.people_status_changed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;
create trigger people_status_changed before update of status on public.people
  for each row execute function app.people_status_changed();

create table public.people_medical (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  person_id uuid not null,
  medical_notes text not null default '',
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id),
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.people_medical', 'people.medical.read', 'people.medical.read');
-- Writing medical notes also needs people.write.
drop policy people_medical_tenant_insert on public.people_medical;
drop policy people_medical_tenant_update on public.people_medical;
create policy people_medical_tenant_insert on public.people_medical for insert to authenticated
  with check (tenant_id = (select app.tenant_id()) and (select app.has_permission('people.medical.read')) and (select app.has_permission('people.write')));
create policy people_medical_tenant_update on public.people_medical for update to authenticated
  using (tenant_id = (select app.tenant_id()) and (select app.has_permission('people.medical.read')) and (select app.has_permission('people.write')))
  with check (tenant_id = (select app.tenant_id()) and (select app.has_permission('people.medical.read')) and (select app.has_permission('people.write')));

create table public.households (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  primary_payer_person_id uuid,
  stripe_customer_id text,
  billing_email extensions.citext,
  notes text,
  balance_cents int not null default 0,
  external_id text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, primary_payer_person_id) references public.people (tenant_id, id) on delete set null (primary_payer_person_id),
  unique (tenant_id, external_id)
);
select app.setup_tenant_table('public.households', 'people.write', 'people.read');
create index households_name_trgm on public.households using gin ((lower(name)) extensions.gin_trgm_ops);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  household_id uuid not null,
  person_id uuid not null,
  relationship text not null check (relationship in ('guardian', 'student', 'other')),
  is_primary_guardian boolean not null default false,
  can_pickup boolean not null default false,
  receives_billing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, person_id),
  foreign key (tenant_id, household_id) references public.households (tenant_id, id) on delete cascade,
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.household_members', 'people.write', 'people.read');
create index household_members_person on public.household_members (person_id);

-- Households of the signed-in Home user (their linked person's memberships in the current tenant).
create or replace function app.household_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct hm.household_id), '{}')
  from public.household_members hm
  join public.people p on p.id = hm.person_id
  where p.user_id = auth.uid() and p.tenant_id = app.tenant_id() and p.archived_at is null;
$$;
grant execute on function app.household_ids() to anon, authenticated, service_role;

-- People visible to the Home user: everyone in their households.
create or replace function app.household_person_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct hm.person_id), '{}')
  from public.household_members hm
  where hm.household_id = any (app.household_ids());
$$;
grant execute on function app.household_person_ids() to authenticated, service_role;

-- The signed-in user's own person record in the current tenant.
create or replace function app.person_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.people p where p.user_id = auth.uid() and p.tenant_id = app.tenant_id() limit 1;
$$;
grant execute on function app.person_id() to authenticated, service_role;

create policy people_household_select on public.people for select to authenticated
  using (tenant_id = (select app.tenant_id()) and id = any ((select app.household_person_ids())::uuid[]));
create policy households_household_select on public.households for select to authenticated
  using (tenant_id = (select app.tenant_id()) and id = any ((select app.household_ids())::uuid[]));
create policy household_members_household_select on public.household_members for select to authenticated
  using (tenant_id = (select app.tenant_id()) and household_id = any ((select app.household_ids())::uuid[]));

-- COPPA consent records (F2.7). History is kept; the latest row per (person, kind) is current.
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  person_id uuid not null,
  guardian_person_id uuid,
  kind text not null check (kind in ('media_release', 'ai_processing', 'messaging', 'photo')),
  granted boolean not null,
  granted_at timestamptz not null default now(),
  method text not null default 'desk' check (method in ('desk', 'home', 'kiosk', 'paper', 'import')),
  ip text,
  document_path text,
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade,
  foreign key (tenant_id, guardian_person_id) references public.people (tenant_id, id) on delete set null (guardian_person_id)
);
select app.setup_tenant_table('public.consents', 'people.write', 'people.read');
create index consents_current on public.consents (person_id, kind, granted_at desc);
create policy consents_household_select on public.consents for select to authenticated
  using (tenant_id = (select app.tenant_id()) and person_id = any ((select app.household_person_ids())::uuid[]));
-- Guardians record consent for people in their own households (Home).
create policy consents_household_insert on public.consents for insert to authenticated
  with check (
    tenant_id = (select app.tenant_id())
    and person_id = any ((select app.household_person_ids())::uuid[])
    and guardian_person_id = (select app.person_id())
    and method = 'home'
  );

create view public.v_current_consents with (security_invoker = true) as
  select distinct on (c.person_id, c.kind) c.tenant_id, c.person_id, c.kind, c.granted, c.granted_at, c.guardian_person_id, c.method
  from public.consents c
  order by c.person_id, c.kind, c.granted_at desc;

-- Kiosk devices (paired in M1.09) and kiosk PINs (household or person; bcrypt hashes, never readable).
create table public.kiosk_devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  location_id uuid not null,
  name text not null,
  token_hash text not null unique,
  device_user_id uuid references auth.users (id) on delete set null,
  paired_by uuid references auth.users (id) on delete set null,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  settings jsonb not null default '{"confirm": "pin"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.kiosk_devices', 'kiosk.manage', 'kiosk.manage');

create table public.kiosk_pins (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  household_id uuid,
  person_id uuid,
  pin_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((household_id is null) <> (person_id is null)),
  unique (household_id),
  unique (person_id),
  foreign key (tenant_id, household_id) references public.households (tenant_id, id) on delete cascade,
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade
);
-- No direct access at all beyond kiosk.manage metadata reads; set/verify via security-definer RPCs.
select app.setup_tenant_table('public.kiosk_pins', null, 'kiosk.manage');

-- Set a household PIN (Desk with people.write, or a guardian of that household from Home).
create or replace function public.set_household_pin(p_household_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
begin
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must be 4 digits' using errcode = '22023';
  end if;
  if not exists (select 1 from public.households where id = p_household_id and tenant_id = tid) then
    raise exception 'household not found' using errcode = '42501';
  end if;
  if not (app.has_permission('people.write') or p_household_id = any (app.household_ids())) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.kiosk_pins (tenant_id, household_id, pin_hash)
  values (tid, p_household_id, extensions.crypt(p_pin, extensions.gen_salt('bf', 8)))
  on conflict (household_id) do update set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null;
end;
$$;
revoke execute on function public.set_household_pin(uuid, text) from public, anon;
grant execute on function public.set_household_pin(uuid, text) to authenticated;

-- Search view for Desk/Mat (security invoker → people RLS applies).
create view public.v_people_search with (security_invoker = true) as
  select p.id, p.tenant_id, p.first_name, p.last_name, p.preferred_name,
         trim(coalesce(p.preferred_name, p.first_name) || ' ' || p.last_name) as display_name,
         p.status, p.type_flags, p.dob, p.photo_path, p.email, p.phone, p.tags, p.allergies, p.injury_flags,
         lower(p.first_name || ' ' || p.last_name || ' ' || coalesce(p.preferred_name, '')) as search_text,
         (select array_agg(h.name order by h.name) from public.household_members hm join public.households h on h.id = hm.household_id where hm.person_id = p.id) as household_names,
         (select min(hm.household_id::text)::uuid from public.household_members hm where hm.person_id = p.id) as household_id
  from public.people p
  where p.archived_at is null;

-- Per-tenant sequence for invoice numbers (used from M2).
create table public.tenant_counters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  value bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);
select app.setup_tenant_table('public.tenant_counters', null, 'billing.read');

create or replace function app.next_counter(p_tenant_id uuid, p_name text)
returns bigint
language sql
security definer
set search_path = ''
as $$
  insert into public.tenant_counters (tenant_id, name, value) values (p_tenant_id, p_name, 1)
  on conflict (tenant_id, name) do update set value = public.tenant_counters.value + 1
  returning value;
$$;

select app.index_foreign_keys();
