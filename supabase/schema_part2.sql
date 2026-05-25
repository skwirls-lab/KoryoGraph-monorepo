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
