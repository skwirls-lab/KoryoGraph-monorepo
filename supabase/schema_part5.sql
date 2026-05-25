-- =========================================================================
-- KORYOGRAPH SUITE — SaaS Subscription & Tenant Onboarding
-- Run this in your Supabase SQL Editor. Safe to re-run (uses IF NOT EXISTS).
-- =========================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- PART 1: SAAS SUBSCRIPTION MANAGEMENT (For billing DOJANG MASTERS)
-- ─────────────────────────────────────────────────────────────────────────

-- Track your SaaS subscriptions (what dojang masters pay YOU)
create table if not exists public.saas_subscriptions (
    id uuid default gen_random_uuid() primary key,
    tenant_id uuid references public.tenants(id) on delete cascade not null,
    stripe_customer_id text unique,
    stripe_subscription_id text unique,
    stripe_price_id text,
    
    -- Subscription status
    status text default 'trial' check (status in ('trial','active','past_due','canceled','paused','expired')),
    
    -- Plan details
    plan_name text not null,  -- e.g., "starter", "growth", "elite"
    plan_amount numeric(10,2) not null,  -- Amount in cents (e.g., 9900 = $99.00)
    billing_interval text default 'month' check (billing_interval in ('month','year')),
    
    -- Billing dates
    current_period_start timestamptz not null,
    current_period_end timestamptz,
    cancel_at_period_end boolean default false,
    
    -- Trial info
    trial_start timestamptz,
    trial_end timestamptz,
    
    -- Features included
    features jsonb default '{}',  -- e.g., {"ai_features": true, "unlimited_locations": false}
    
    -- Created by (your sales team)
    created_by text,  -- "manual", "self_signup", "admin_invite"
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

-- ─────────────────────────────────────────────────────────────────────────
-- PART 2: TENANT ONBOARDING & SIGNUP FLOW
-- ─────────────────────────────────────────────────────────────────────────

-- Pending signups (users who signed up but haven't been provisioned yet)
create table if not exists public.pending_tenants (
    id uuid default gen_random_uuid() primary key,
    
    -- Contact info
    email text unique not null,
    first_name text not null,
    last_name text not null,
    phone_number text,
    
    -- Studio info (collected during signup)
    studio_name text not null,
    studio_slug text unique,  -- URL-friendly version of studio name
    website_url text,
    
    -- Plan selection (default to trial)
    selected_plan text default 'trial' check (selected_plan in ('trial','starter','growth','elite')),
    
    -- Stripe setup
    stripe_setup_future true,  -- Flag to show Stripe setup UI
    stripe_payment_intent_id text,  -- For collecting payment during signup
    
    -- Status
    status text default 'pending_verification' check (status in ('pending_verification','verified','rejected','cancelled')),
    rejection_reason text,
    
    -- Verification
    verification_token text unique,
    verified_at timestamptz,
    
    created_at timestamptz default now() not null
);

-- ─────────────────────────────────────────────────────────────────────────
-- PART 3: SAAS PRICING & PLANS
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.saas_plans (
    id text primary key,
    name text not null,
    slug text unique not null,
    
    -- Pricing
    amount numeric(10,2) not null,  -- Amount in cents
    billing_interval text default 'month' check (billing_interval in ('month','year')),
    
    -- Features
    max_students int,
    max_locations int default 1,
    ai_features boolean default false,
    priority_support boolean default false,
    custom_branding boolean default false,
    
    -- Description for marketing
    description text,
    features_list text[],  -- Array of feature strings
    
    is_active boolean default true,
    created_at timestamptz default now() not null
);

-- Insert standard pricing plans
insert into public.saas_plans (id, name, slug, amount, billing_interval, max_students, max_locations, ai_features, priority_support, custom_branding, description, features_list) values
('starter', 'Starter', 'starter', 9900, 'month', 50, 1, false, false, false, 'Perfect for small studios just getting started', array['Up to 50 students', '1 location', 'Basic attendance tracking', 'Student progression tracking']),
('growth', 'Growth', 'growth', 19900, 'month', 200, 3, true, false, false, 'For growing studios with multiple locations', array['Up to 200 students', 'Up to 3 locations', 'AI class transcription', 'Advanced analytics', 'Inventory management']),
('elite', 'Elite', 'elite', 49900, 'month', 500, 10, true, true, true, 'For large studios and chains', array['Up to 500 students', 'Up to 10 locations', 'All AI features', 'Priority support', 'Custom branding', 'White-label reports']),
('trial', 'Trial', 'trial', 0, 'month', 50, 1, false, false, false, '7-day free trial - all core features', array['Up to 50 students', '1 location', 'All core features', 'No credit card required']));

-- ─────────────────────────────────────────────────────────────────────────
-- PART 4: SAAS USAGE METRICS (For analytics & churn prediction)
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.saas_usage_metrics (
    id uuid default gen_random_uuid() primary key,
    tenant_id uuid references public.tenants(id) on delete cascade not null,
    
    -- Metrics collected daily
    date_date date not null,
    
    active_students int default 0,
    classes_held int default 0,
    attendance_logs_created int default 0,
    skill_evaluations_logged int default 0,
    invoices_generated int default 0,
    
    -- Engagement signals
    last_active_at timestamptz,
    login_count int default 0,
    
    created_at timestamptz default now() not null,
    unique (tenant_id, date_date)
);

-- ─────────────────────────────────────────────────────────────────────────
-- PART 5: TRIGGERS & FUNCTIONS FOR AUTO-PROVISIONING
-- ─────────────────────────────────────────────────────────────────────────

-- Auto-create tenant when pending_tenant is verified
create or replace function public.verify_pending_tenant()
returns trigger as $$
declare
    new_tenant_id uuid;
begin
    -- Create the tenant record
    insert into public.tenants (id, name, slug, subscription_tier, stripe_customer_id)
    values (
        gen_random_uuid(),
        new.studio_name,
        new.studio_slug,
        case 
            when new.selected_plan = 'trial' then 'starter'
            when new.selected_plan = 'starter' then 'starter'
            when new.selected_plan = 'growth' then 'growth'
            when new.selected_plan = 'elite' then 'elite'
            else 'starter'
        end,
        null  -- Stripe customer ID will be set after payment
    )
    returning id into new_tenant_id;
    
    -- Update pending tenant with tenant ID and verify
    update public.pending_tenants
    set tenant_id = new_tenant_id,
        status = 'verified',
        verified_at = now()
    where id = new.id;
    
    return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_pending_tenant_verified
    after update on public.pending_tenants
    for each row execute procedure public.verify_pending_tenant();

-- ─────────────────────────────────────────────────────────────────────────
-- PART 6: ROW LEVEL SECURITY (RLS) FOR SAAS TABLES
-- ─────────────────────────────────────────────────────────────────────────

-- Enable RLS on all new tables
alter table public.saas_subscriptions enable row level security;
alter table public.pending_tenants enable row level security;
alter table public.saas_plans enable row level security;
alter table public.saas_usage_metrics enable row level security;

-- SaaS subscriptions: Only admins/owners can see their own tenant's subscription
create policy "Tenants see own saas_subscription" on public.saas_subscriptions
    for select using (
        exists (select 1 from public.tenants t 
                 where t.id = saas_subscriptions.tenant_id 
                 and (public.has_role(t.id::uuid, 'owner') or public.has_role(t.id::uuid, 'admin')))
    );

create policy "Admins can update saas_subscription" on public.saas_subscriptions
    for update using (
        exists (select 1 from public.tenants t 
                 where t.id = saas_subscriptions.tenant_id 
                 and (public.has_role(t.id::uuid, 'owner') or public.has_role(t.id::uuid, 'admin')))
    );

-- Pending tenants: Only admins can see pending tenant requests
create policy "Admins see pending tenants" on public.pending_tenants
    for select using (
        exists (select 1 from public.tenants t 
                 where t.id = (select tenant_id from public.saas_subscriptions s where s.stripe_customer_id is not null limit 1)
                 and (public.has_role(t.id::uuid, 'owner') or public.has_role(t.id::uuid, 'admin')))
    );

create policy "Admins can update pending tenants" on public.pending_tenants
    for insert with check (true);  -- Allow any authenticated user to create pending tenant
create policy "Admins can update pending tenants" on public.pending_tenants
    for update using (
        exists (select 1 from public.tenants t 
                 where t.id = (select tenant_id from public.saas_subscriptions s where s.stripe_customer_id is not null limit 1)
                 and (public.has_role(t.id::uuid, 'owner') or public.has_role(t.id::uuid, 'admin')))
    );

-- SaaS plans: Public read for pricing display
create policy "Public read saas_plans" on public.saas_plans
    for select using (true);

-- SaaS usage metrics: Tenants see their own usage
create policy "Tenants see own usage metrics" on public.saas_usage_metrics
    for select using (tenant_id = (select id from public.tenants where id in (select tenant_id from public.saas_subscriptions)));

-- ─────────────────────────────────────────────────────────────────────────
-- PART 7: INDEXES FOR PERFORMANCE
-- ─────────────────────────────────────────────────────────────────────────

create index if not exists idx_saas_subscriptions_tenant on public.saas_subscriptions(tenant_id);
create index if not exists idx_saas_subscriptions_status on public.saas_subscriptions(status);
create index if not exists idx_saas_subscriptions_stripe_customer on public.saas_subscriptions(stripe_customer_id);

create index if not exists idx_pending_tenants_email on public.pending_tenants(email);
create index if not exists idx_pending_tenants_status on public.pending_tenants(status);

create index if not exists idx_saas_usage_tenant_date on public.saas_usage_metrics(tenant_id, date_date);
