-- ─────────────────────────────────────────────────────────────────────────
-- PART 8: EVENTS, CAMPS, WAIVERS, DIRECT MESSAGING
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.events_and_camps (
    id uuid default gen_random_uuid() primary key,
    tenant_id uuid references public.tenants(id) on delete cascade not null,
    location_id uuid references public.locations(id),
    name text not null,
    event_type text check (event_type in ('after_school','summer_camp','seminar','tournament','special_class')) not null,
    description text,
    start_date date not null,
    end_date date,
    start_time time,
    end_time time,
    capacity int,
    price numeric(10,2) default 0,
    billing_interval text check (billing_interval in ('once','weekly','monthly')),
    requires_waiver boolean default false,
    is_active boolean default true,
    created_at timestamptz default now() not null
);

create table if not exists public.event_registrations (
    id uuid default gen_random_uuid() primary key,
    event_id uuid references public.events_and_camps(id) on delete cascade not null,
    student_id uuid references public.profiles(id) on delete cascade not null,
    guardian_id uuid references public.profiles(id),
    invoice_id uuid references public.invoices(id),
    check_in_time timestamptz,
    check_out_time timestamptz,
    waiver_signed_at timestamptz,
    status text default 'registered' check (status in ('registered','waitlisted','canceled','attended')),
    created_at timestamptz default now() not null,
    unique (event_id, student_id)
);

create table if not exists public.waivers (
    id uuid default gen_random_uuid() primary key,
    tenant_id uuid references public.tenants(id) on delete cascade not null,
    name text not null,
    content_html text not null,
    version int default 1,
    is_active boolean default true,
    created_at timestamptz default now() not null
);

create table if not exists public.waiver_signatures (
    id uuid default gen_random_uuid() primary key,
    waiver_id uuid references public.waivers(id) on delete cascade not null,
    profile_id uuid references public.profiles(id) on delete cascade not null,
    signed_by_guardian_id uuid references public.profiles(id),
    signature_data text,         -- base64 signature or docusign reference
    signed_at timestamptz default now() not null,
    ip_address text,
    unique (waiver_id, profile_id)
);

create table if not exists public.messages (
    id uuid default gen_random_uuid() primary key,
    tenant_id uuid references public.tenants(id) on delete cascade not null,
    sender_id uuid references public.profiles(id) on delete set null,
    recipient_id uuid references public.profiles(id) on delete cascade not null,
    subject text,
    body text not null,
    is_read boolean default false,
    read_at timestamptz,
    created_at timestamptz default now() not null
);

-- ─────────────────────────────────────────────────────────────────────────
-- PART 9: TRIGGERS & FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────

-- Auto-create profile on signup (tenant-aware)
create or replace function public.handle_new_user()
returns trigger as $$
declare
    default_role text;
begin
    insert into public.profiles (id, first_name, last_name, phone_number, avatar_url)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'first_name', ''),
        coalesce(new.raw_user_meta_data->>'last_name', ''),
        new.phone,
        new.raw_user_meta_data->>'avatar_url'
    );

    default_role := coalesce(new.raw_user_meta_data->>'role', 'parent');

    -- tenant_id will be null until an admin links the user to a tenant
    insert into public.user_roles (user_id, role_id, tenant_id)
    values (new.id, default_role,
        (new.raw_user_meta_data->>'tenant_id')::uuid
    );

    return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

-- Auto-update updated_at timestamps
create or replace function public.set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create or replace trigger set_profiles_updated_at
    before update on public.profiles
    for each row execute procedure public.set_updated_at();

create or replace trigger set_tenants_updated_at
    before update on public.tenants
    for each row execute procedure public.set_updated_at();

-- Role check helper
create or replace function public.has_role(user_uuid uuid, role_name text)
returns boolean as $$
begin
    return exists (
        select 1 from public.user_roles
        where user_id = user_uuid and role_id = role_name
    );
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────────────────────────
-- PART 10: ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────

-- Enable RLS on all tables
alter table public.tenants              enable row level security;
alter table public.locations            enable row level security;
alter table public.profiles             enable row level security;
alter table public.user_roles           enable row level security;
alter table public.roles                enable row level security;
alter table public.families             enable row level security;
alter table public.family_members       enable row level security;
alter table public.programs             enable row level security;
alter table public.curriculum_ranks     enable row level security;
alter table public.skills_checklist     enable row level security;
alter table public.student_progression  enable row level security;
alter table public.classes              enable row level security;
alter table public.attendance_logs      enable row level security;
alter table public.skill_evaluations    enable row level security;
alter table public.class_transcripts    enable row level security;
alter table public.belt_testing_events  enable row level security;
alter table public.belt_test_registrations enable row level security;
alter table public.subscriptions        enable row level security;
alter table public.invoices             enable row level security;
alter table public.products             enable row level security;
alter table public.product_variants     enable row level security;
alter table public.pos_transactions     enable row level security;
alter table public.leads                enable row level security;
alter table public.communications_log   enable row level security;
alter table public.events_and_camps     enable row level security;
alter table public.event_registrations  enable row level security;
alter table public.waivers              enable row level security;
alter table public.waiver_signatures    enable row level security;
alter table public.messages             enable row level security;

-- Public read (no auth required)
create policy "Roles are public" on public.roles
    for select using (true);

-- Profiles: own data + admin/owner sees all
create policy "Own profile" on public.profiles
    for select to authenticated using (auth.uid() = id);

create policy "Update own profile" on public.profiles
    for update to authenticated using (auth.uid() = id);

create policy "Staff sees all profiles" on public.profiles
    for select to authenticated using (
        public.has_role(auth.uid(), 'owner') or
        public.has_role(auth.uid(), 'admin')
    );

-- User roles: own roles
create policy "Own roles" on public.user_roles
    for select to authenticated using (auth.uid() = user_id);

create policy "Admin manages roles" on public.user_roles
    using (
        public.has_role(auth.uid(), 'owner') or
        public.has_role(auth.uid(), 'admin')
    );

-- Messages: sender or recipient
create policy "Message participants" on public.messages
    for select to authenticated using (
        auth.uid() = sender_id or auth.uid() = recipient_id
    );

create policy "Send messages" on public.messages
    for insert to authenticated with check (auth.uid() = sender_id);

-- Communications log: admin approval only
create policy "Staff manages comms" on public.communications_log
    using (
        public.has_role(auth.uid(), 'owner') or
        public.has_role(auth.uid(), 'admin')
    );
