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
