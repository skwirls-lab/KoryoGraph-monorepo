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
