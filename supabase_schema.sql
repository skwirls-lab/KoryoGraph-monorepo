-- =========================================================================
-- KORYOGRAPH SUITE — Core Database Schema
-- Paste this script into your Supabase SQL Editor to initialize the database
-- =========================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────
-- 1. SCHEMAS & ROLES DEFINITION
-- ─────────────────────────────────────────────────────────────────────────

-- Create custom roles lookup table
create table public.roles (
    id text primary key,
    label text not null,
    description text
);

-- Populate available system roles
insert into public.roles (id, label, description) values
('owner', 'Studio Owner', 'Full control over billing, dashboards, staff roles, and settings.'),
('admin', 'Front Desk Admin', 'Manages CRM leads, inventory POS, after-school registers, and belt logistics.'),
('instructor', 'Mat-Side Instructor', 'Tablet-optimized access for class schedules, roster attendance, and skill checkoffs.'),
('parent', 'Parent / Guardian', 'Portal switch family context, book events, pay fees, and view progression translation.'),
('student', 'Student', 'Portal to access training assets, technique logs, and biomechanical vision uploads.');

-- ─────────────────────────────────────────────────────────────────────────
-- 2. CORE IDENTITY TABLES
-- ─────────────────────────────────────────────────────────────────────────

-- Profile table (extends auth.users)
create table public.profiles (
    id uuid references auth.users on delete cascade primary key,
    first_name text,
    last_name text,
    phone_number text,
    avatar_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- User-Roles Junction (Supports multi-role switching, e.g. Owner who also instructs)
create table public.user_roles (
    user_id uuid references public.profiles(id) on delete cascade,
    role_id text references public.roles(id) on delete cascade,
    primary key (user_id, role_id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Family (Guardianship linking Parents to Kids)
create table public.families (
    id uuid default gen_random_uuid() primary key,
    name text not null, -- e.g., "The Crowley Family"
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Family Members (links profiles to families, indicating who is a guardian and who is a student)
create table public.family_members (
    family_id uuid references public.families(id) on delete cascade,
    profile_id uuid references public.profiles(id) on delete cascade,
    member_type text check (member_type in ('guardian', 'student')),
    primary key (family_id, profile_id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. TRIGGERS & PL/PGSQL FUNCTIONS (Automatic Profile Setup)
-- ─────────────────────────────────────────────────────────────────────────

-- Automatically create profile on new user signup
create or replace function public.handle_new_user()
returns trigger as $$
declare
    default_role text;
begin
    -- 1. Create the public profile
    insert into public.profiles (id, first_name, last_name, phone_number, avatar_url)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'first_name', ''),
        coalesce(new.raw_user_meta_data->>'last_name', ''),
        new.phone,
        new.raw_user_meta_data->>'avatar_url'
    );

    -- 2. Determine default role (defaults to parent if none specified during sign up)
    default_role := coalesce(new.raw_user_meta_data->>'role', 'parent');

    -- 3. Insert user role
    insert into public.user_roles (user_id, role_id)
    values (new.id, default_role);

    return new;
end;
$$ language plpgsql security definer;

-- Trigger signup sync
create or replace trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. RBAC SCHEMATIC ACCESS HELPER
-- ─────────────────────────────────────────────────────────────────────────

-- Helper function to check if a user has a specific role
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
-- 5. ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.roles enable row level security;

-- Roles access policy
create policy "Allow public reading of roles" on public.roles
    for select to authenticated, anon using (true);

-- Profile policies
create policy "Allow users to read their own profile" on public.profiles
    for select to authenticated using (auth.uid() = id);

create policy "Allow users to update their own profile" on public.profiles
    for update to authenticated using (auth.uid() = id);

create policy "Allow staff members (admin/owner) to view all profiles" on public.profiles
    for select to authenticated using (
        public.has_role(auth.uid(), 'owner') or public.has_role(auth.uid(), 'admin')
    );

-- User-roles policies
create policy "Allow users to read their own roles" on public.user_roles
    for select to authenticated using (auth.uid() = user_id);

create policy "Allow owners/admins to assign/modify roles" on public.user_roles
    using (
        public.has_role(auth.uid(), 'owner') or public.has_role(auth.uid(), 'admin')
    );
