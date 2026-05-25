-- =========================================================================
-- KORYOGRAPH SUITE — Full Database Schema v2
-- Run this in your Supabase SQL Editor. Safe to re-run (uses IF NOT EXISTS).
-- =========================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "vector";

-- ─────────────────────────────────────────────────────────────────────────
-- PART 1: MULTI-TENANCY
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.tenants (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    slug text unique not null, -- e.g. "koryo-martial-arts"
    logo_url text,
    primary_color text default '#e11d48',
    subscription_tier text default 'starter' check (subscription_tier in ('starter','growth','elite')),
    stripe_customer_id text,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

create table if not exists public.locations (
    id uuid default gen_random_uuid() primary key,
    tenant_id uuid references public.tenants(id) on delete cascade not null,
    name text not null,
    address text,
    city text,
    state text,
    zip text,
    phone text,
    timezone text default 'America/New_York',
    is_active boolean default true,
    created_at timestamptz default now() not null
);

-- ─────────────────────────────────────────────────────────────────────────
-- PART 2: ROLES
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.roles (
    id text primary key,
    label text not null,
    description text
);

insert into public.roles (id, label, description) values
('owner',      'Studio Owner',      'Full control over all settings, billing, staff, and dashboards.'),
('admin',      'Front Desk Admin',  'Manages CRM, inventory, POS, after-school, and belt logistics.'),
('instructor', 'Instructor',        'Tablet-optimized: attendance, skill log, class schedule.'),
('parent',     'Parent/Guardian',   'Family context switcher, event booking, billing, progression view.'),
('student',    'Student',           'Training assets, technique logs, and vision uploads.')
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- PART 3: PROFILES & IDENTITY
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
    id uuid references auth.users on delete cascade primary key,
    tenant_id uuid references public.tenants(id) on delete set null,
    first_name text,
    last_name text,
    phone_number text,
    date_of_birth date,
    avatar_url text,
    bio text,
    preferred_theme text default 'koryo-red',
    emergency_contact_name text,
    emergency_contact_phone text,
    medical_notes text,   -- allergies, injuries
    is_active boolean default true,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

create table if not exists public.user_roles (
    user_id uuid references public.profiles(id) on delete cascade,
    role_id text references public.roles(id) on delete cascade,
    tenant_id uuid references public.tenants(id) on delete cascade,
    primary key (user_id, role_id, tenant_id),
    created_at timestamptz default now() not null
);

create table if not exists public.families (
    id uuid default gen_random_uuid() primary key,
    tenant_id uuid references public.tenants(id) on delete cascade not null,
    name text not null,
    billing_email text,
    stripe_customer_id text,
    created_at timestamptz default now() not null
);

create table if not exists public.family_members (
    family_id uuid references public.families(id) on delete cascade,
    profile_id uuid references public.profiles(id) on delete cascade,
    member_type text check (member_type in ('guardian','student')) not null,
    is_primary_guardian boolean default false,
    primary key (family_id, profile_id),
    created_at timestamptz default now() not null
);

-- ─────────────────────────────────────────────────────────────────────────
-- PART 4: PROGRAMS & CURRICULUM
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.programs (
    id uuid default gen_random_uuid() primary key,
    tenant_id uuid references public.tenants(id) on delete cascade not null,
    name text not null,          -- "Taekwondo", "Hapkido", "Little Tigers"
    description text,
    min_age int,
    max_age int,
    is_active boolean default true,
    created_at timestamptz default now() not null
);

create table if not exists public.curriculum_ranks (
    id uuid default gen_random_uuid() primary key,
    program_id uuid references public.programs(id) on delete cascade not null,
    name text not null,          -- "White Belt", "Yellow Belt", "1st Dan"
    belt_color text,             -- hex color for UI display
    order_index int not null,    -- 1, 2, 3... determines progression order
    min_time_weeks int,          -- minimum weeks before eligible for testing
    testing_fee numeric(10,2) default 0,
    created_at timestamptz default now() not null
);

create table if not exists public.skills_checklist (
    id uuid default gen_random_uuid() primary key,
    rank_id uuid references public.curriculum_ranks(id) on delete cascade not null,
    name text not null,          -- "Dollyo Chagi (Roundhouse Kick)"
    description text,
    category text,               -- "Kicks", "Forms", "Sparring", "Self-Defense"
    order_index int default 0,
    master_video_url text,       -- Gold Standard baseline video (for Vision Master)
    created_at timestamptz default now() not null
);

create table if not exists public.student_progression (
    id uuid default gen_random_uuid() primary key,
    student_id uuid references public.profiles(id) on delete cascade not null,
    program_id uuid references public.programs(id) on delete cascade not null,
    current_rank_id uuid references public.curriculum_ranks(id),
    enrolled_at timestamptz default now() not null,
    promoted_at timestamptz,
    is_active boolean default true,
    notes text,
    unique (student_id, program_id)
);
-- ─────────────────────────────────────────────────────────────────────────
-- PART 5: MAT-SIDE — CLASSES, ATTENDANCE, SKILLS, BELT TESTING
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.classes (
    id uuid default gen_random_uuid() primary key,
    tenant_id uuid references public.tenants(id) on delete cascade not null,
    location_id uuid references public.locations(id) on delete set null,
    program_id uuid references public.programs(id) on delete set null,
    instructor_id uuid references public.profiles(id) on delete set null,
    name text not null,
    day_of_week text[],          -- ["Monday","Wednesday"]
    start_time time not null,
    end_time time not null,
    capacity int,
    is_active boolean default true,
    created_at timestamptz default now() not null
);

create table if not exists public.attendance_logs (
    id uuid default gen_random_uuid() primary key,
    class_id uuid references public.classes(id) on delete cascade not null,
    student_id uuid references public.profiles(id) on delete cascade not null,
    class_date date not null,
    checked_in_at timestamptz default now(),
    checked_in_by uuid references public.profiles(id),  -- instructor who tapped
    source text default 'manual' check (source in ('manual','ai_transcript','kiosk')),
    notes text,
    unique (class_id, student_id, class_date)
);

create table if not exists public.skill_evaluations (
    id uuid default gen_random_uuid() primary key,
    student_id uuid references public.profiles(id) on delete cascade not null,
    skill_id uuid references public.skills_checklist(id) on delete cascade not null,
    evaluated_by uuid references public.profiles(id),
    class_id uuid references public.classes(id),
    class_date date,
    passed boolean default false,
    accuracy_score numeric(5,2),     -- 0-100, from Vision Master
    actionable_tip text,             -- AI-generated feedback
    source text default 'manual' check (source in ('manual','vision_master','ai_transcript')),
    notes text,
    created_at timestamptz default now() not null
);

create table if not exists public.class_transcripts (
    id uuid default gen_random_uuid() primary key,
    class_id uuid references public.classes(id) on delete cascade not null,
    class_date date not null,
    instructor_id uuid references public.profiles(id),
    audio_file_url text,
    raw_transcript text,
    ai_processed_at timestamptz,
    action_board_data jsonb,         -- AI-extracted attendance + skill notes
    approved_by uuid references public.profiles(id),
    approved_at timestamptz,
    status text default 'pending' check (status in ('pending','processing','ready','approved')),
    created_at timestamptz default now() not null
);

create table if not exists public.belt_testing_events (
    id uuid default gen_random_uuid() primary key,
    tenant_id uuid references public.tenants(id) on delete cascade not null,
    location_id uuid references public.locations(id),
    name text not null,
    test_date date not null,
    registration_deadline date,
    fee numeric(10,2) default 0,
    notes text,
    created_at timestamptz default now() not null
);

create table if not exists public.belt_test_registrations (
    id uuid default gen_random_uuid() primary key,
    event_id uuid references public.belt_testing_events(id) on delete cascade not null,
    student_id uuid references public.profiles(id) on delete cascade not null,
    target_rank_id uuid references public.curriculum_ranks(id),
    fee_paid boolean default false,
    invoice_id uuid,               -- FK added after invoices table below
    result text check (result in ('pass','fail','pending')) default 'pending',
    certificate_url text,
    kukkiwon_id text,
    created_at timestamptz default now() not null,
    unique (event_id, student_id)
);
-- ─────────────────────────────────────────────────────────────────────────
-- PART 6: BILLING, INVOICES, SUBSCRIPTIONS, POS
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.subscriptions (
    id uuid default gen_random_uuid() primary key,
    tenant_id uuid references public.tenants(id) on delete cascade not null,
    family_id uuid references public.families(id) on delete cascade,
    student_id uuid references public.profiles(id) on delete cascade,
    stripe_subscription_id text unique,
    stripe_price_id text,
    status text default 'active' check (status in ('active','past_due','canceled','paused')),
    plan_name text,
    amount numeric(10,2) not null,
    billing_interval text default 'month' check (billing_interval in ('month','year')),
    current_period_start timestamptz,
    current_period_end timestamptz,
    cancel_at_period_end boolean default false,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

create table if not exists public.invoices (
    id uuid default gen_random_uuid() primary key,
    tenant_id uuid references public.tenants(id) on delete cascade not null,
    family_id uuid references public.families(id) on delete set null,
    student_id uuid references public.profiles(id) on delete set null,
    subscription_id uuid references public.subscriptions(id) on delete set null,
    stripe_invoice_id text unique,
    stripe_payment_intent_id text,
    amount_due numeric(10,2) not null,
    amount_paid numeric(10,2) default 0,
    status text default 'open' check (status in ('draft','open','paid','void','uncollectible')),
    description text,
    due_date date,
    paid_at timestamptz,
    pdf_url text,
    created_at timestamptz default now() not null
);

-- Add the FK from belt_test_registrations now that invoices exists
alter table public.belt_test_registrations
    add constraint fk_btr_invoice
    foreign key (invoice_id) references public.invoices(id) on delete set null;

create table if not exists public.products (
    id uuid default gen_random_uuid() primary key,
    tenant_id uuid references public.tenants(id) on delete cascade not null,
    name text not null,
    description text,
    category text,               -- "Uniforms","Gear","Weapons","Apparel"
    stripe_product_id text,
    is_active boolean default true,
    created_at timestamptz default now() not null
);

create table if not exists public.product_variants (
    id uuid default gen_random_uuid() primary key,
    product_id uuid references public.products(id) on delete cascade not null,
    sku text unique,
    size text,
    color text,
    price numeric(10,2) not null,
    cost_basis numeric(10,2),
    stock_quantity int default 0,
    low_stock_threshold int default 5,
    stripe_price_id text,
    created_at timestamptz default now() not null
);

create table if not exists public.pos_transactions (
    id uuid default gen_random_uuid() primary key,
    tenant_id uuid references public.tenants(id) on delete cascade not null,
    location_id uuid references public.locations(id),
    family_id uuid references public.families(id),
    stripe_terminal_id text,
    stripe_payment_intent_id text,
    total numeric(10,2) not null,
    status text default 'pending' check (status in ('pending','succeeded','failed','refunded')),
    line_items jsonb,            -- [{variant_id, qty, unit_price}]
    processed_by uuid references public.profiles(id),
    created_at timestamptz default now() not null
);

-- ─────────────────────────────────────────────────────────────────────────
-- PART 7: CRM, LEADS, MARKETING
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.leads (
    id uuid default gen_random_uuid() primary key,
    tenant_id uuid references public.tenants(id) on delete cascade not null,
    first_name text,
    last_name text,
    email text,
    phone text,
    interested_program_id uuid references public.programs(id),
    pipeline_stage text default 'new' check (pipeline_stage in ('new','contacted','trial_booked','trial_done','signed_up','lost')),
    source text,                 -- "website","referral","social_media","walk_in"
    notes text,
    assigned_to uuid references public.profiles(id),
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

create table if not exists public.communications_log (
    id uuid default gen_random_uuid() primary key,
    tenant_id uuid references public.tenants(id) on delete cascade not null,
    recipient_profile_id uuid references public.profiles(id),
    recipient_lead_id uuid references public.leads(id),
    channel text check (channel in ('sms','email','in_app')) not null,
    subject text,
    body text not null,
    status text default 'draft' check (status in ('draft','pending_approval','approved','sent','failed')),
    ai_generated boolean default false,
    approved_by uuid references public.profiles(id),
    approved_at timestamptz,
    sent_at timestamptz,
    trigger_type text,           -- "drift_detector","billing_recovery","manual","broadcast"
    created_at timestamptz default now() not null
);
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
