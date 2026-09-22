-- 0011 Programs, ranks, curriculum, progression (§4.3, F4.1–F4.5).
-- Curriculum (programs, ranks, skills, requirements) is readable by every member of the tenant (Home shows
-- rank names and curriculum videos); written with curriculum.write. Progression (enrollments, promotions,
-- stripes, sign-offs) is readable by staff with people.read and by the student's own household.

create table public.certificate_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  background_path text,
  layout jsonb not null default '{}'::jsonb,
  signature_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.setup_tenant_table('public.certificate_templates', 'curriculum.write');

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,60}$'),
  description text not null default '',
  age_min int check (age_min is null or age_min between 0 and 120),
  age_max int check (age_max is null or age_max between 0 and 120),
  color text not null default '#e11d48',
  sort int not null default 0,
  active boolean not null default true,
  invite_only boolean not null default false,
  terminology jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug),
  check (age_min is null or age_max is null or age_min <= age_max)
);
select app.setup_tenant_table('public.programs', 'curriculum.write');

create table public.ranks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  program_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  belt_color text not null default '#f5f5f5',
  position int not null check (position >= 1),
  stripes_max int not null default 0 check (stripes_max between 0 and 10),
  testing_fee_cents int not null default 0 check (testing_fee_cents >= 0),
  certificate_template_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Deferrable so a ladder can be reordered in one transaction.
  constraint ranks_program_position_key unique (program_id, position) deferrable initially deferred,
  foreign key (tenant_id, program_id) references public.programs (tenant_id, id) on delete cascade,
  foreign key (tenant_id, certificate_template_id) references public.certificate_templates (tenant_id, id) on delete set null (certificate_template_id)
);
select app.setup_tenant_table('public.ranks', 'curriculum.write');

create table public.rank_requirements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  rank_id uuid not null unique,
  min_classes int not null default 0 check (min_classes >= 0),
  min_days int not null default 0 check (min_days >= 0),
  requires_instructor_approval boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, rank_id) references public.ranks (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.rank_requirements', 'curriculum.write');

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  program_id uuid,
  category text not null default 'other' check (category in ('kick', 'form', 'one_step', 'self_defense', 'sparring', 'breaking', 'terminology', 'conditioning', 'other')),
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  video_url text check (video_url is null or video_url ~ '^https?://'),
  rubric jsonb not null default '[]'::jsonb,
  sort int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, program_id) references public.programs (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.skills', 'curriculum.write');
create index skills_name_trgm on public.skills using gin ((lower(name)) extensions.gin_trgm_ops);

create table public.rank_skills (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  rank_id uuid not null,
  skill_id uuid not null,
  required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rank_id, skill_id),
  foreign key (tenant_id, rank_id) references public.ranks (tenant_id, id) on delete cascade,
  foreign key (tenant_id, skill_id) references public.skills (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.rank_skills', 'curriculum.write');

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  person_id uuid not null,
  program_id uuid not null,
  current_rank_id uuid,
  stripes int not null default 0 check (stripes >= 0),
  started_at date not null default current_date,
  last_promoted_at timestamptz,
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  classes_since_promotion int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, program_id),
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade,
  foreign key (tenant_id, program_id) references public.programs (tenant_id, id) on delete cascade,
  foreign key (tenant_id, current_rank_id) references public.ranks (tenant_id, id) on delete set null (current_rank_id)
);
select app.setup_tenant_table('public.enrollments', 'people.write', 'people.read');
-- Instructors (ranks.promote) change rank/stripes too.
drop policy enrollments_tenant_update on public.enrollments;
create policy enrollments_tenant_update on public.enrollments for update to authenticated
  using (tenant_id = (select app.tenant_id()) and ((select app.has_permission('people.write')) or (select app.has_permission('ranks.promote'))))
  with check (tenant_id = (select app.tenant_id()) and ((select app.has_permission('people.write')) or (select app.has_permission('ranks.promote'))));
create policy enrollments_household_select on public.enrollments for select to authenticated
  using (tenant_id = (select app.tenant_id()) and person_id = any ((select app.household_person_ids())::uuid[]));

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  enrollment_id uuid not null,
  from_rank_id uuid,
  to_rank_id uuid not null,
  promoted_at timestamptz not null default now(),
  testing_event_id uuid,
  promoted_by_user_id uuid references auth.users (id) on delete set null,
  certificate_path text,
  reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, enrollment_id) references public.enrollments (tenant_id, id) on delete cascade,
  foreign key (tenant_id, from_rank_id) references public.ranks (tenant_id, id) on delete set null (from_rank_id),
  foreign key (tenant_id, to_rank_id) references public.ranks (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.promotions', 'ranks.promote', 'people.read');

create table public.stripe_awards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  enrollment_id uuid not null,
  rank_id uuid,
  awarded_at timestamptz not null default now(),
  awarded_by_user_id uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, enrollment_id) references public.enrollments (tenant_id, id) on delete cascade,
  foreign key (tenant_id, rank_id) references public.ranks (tenant_id, id) on delete set null (rank_id)
);
select app.setup_tenant_table('public.stripe_awards', 'ranks.promote', 'people.read');

create table public.skill_signoffs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  enrollment_id uuid not null,
  skill_id uuid not null,
  signed_off_at timestamptz not null default now(),
  by_user_id uuid references auth.users (id) on delete set null,
  score numeric check (score is null or score between 0 and 100),
  notes text,
  source text not null default 'manual' check (source in ('manual', 'action_board', 'vision', 'testing', 'import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrollment_id, skill_id),
  foreign key (tenant_id, enrollment_id) references public.enrollments (tenant_id, id) on delete cascade,
  foreign key (tenant_id, skill_id) references public.skills (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.skill_signoffs', 'ranks.promote', 'people.read');

-- Instructor approval towards a specific next rank (requirement "requires_instructor_approval").
create table public.promotion_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  enrollment_id uuid not null,
  rank_id uuid not null,
  approved_by_user_id uuid references auth.users (id) on delete set null,
  approved_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrollment_id, rank_id),
  foreign key (tenant_id, enrollment_id) references public.enrollments (tenant_id, id) on delete cascade,
  foreign key (tenant_id, rank_id) references public.ranks (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.promotion_approvals', 'ranks.promote', 'people.read');

-- Home: a household sees its students' progression.
create policy promotions_household_select on public.promotions for select to authenticated
  using (tenant_id = (select app.tenant_id()) and enrollment_id in (select id from public.enrollments));
create policy stripe_awards_household_select on public.stripe_awards for select to authenticated
  using (tenant_id = (select app.tenant_id()) and enrollment_id in (select id from public.enrollments));
create policy skill_signoffs_household_select on public.skill_signoffs for select to authenticated
  using (tenant_id = (select app.tenant_id()) and enrollment_id in (select id from public.enrollments));
create policy promotion_approvals_household_select on public.promotion_approvals for select to authenticated
  using (tenant_id = (select app.tenant_id()) and enrollment_id in (select id from public.enrollments));

create table public.lesson_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  program_id uuid,
  name text not null check (length(trim(name)) > 0),
  sections jsonb not null default '[]'::jsonb,
  is_template boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  source text not null default 'manual' check (source in ('manual', 'ai')),
  ai_run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, program_id) references public.programs (tenant_id, id) on delete set null (program_id)
);
select app.setup_tenant_table('public.lesson_plans', 'curriculum.write', 'people.read');

-- ---------------------------------------------------------------------------------------------
-- Progression RPCs (security invoker: RLS + permissions apply; they make multi-row changes atomic).
-- ---------------------------------------------------------------------------------------------

-- Promote to a rank: history row + enrollment update (stripes reset, counters reset).
create or replace function public.promote(p_enrollment_id uuid, p_to_rank_id uuid, p_reason text default null, p_testing_event_id uuid default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  e public.enrollments;
  pid uuid;
begin
  select * into e from public.enrollments where id = p_enrollment_id for update;
  if not found then
    raise exception 'enrollment not found' using errcode = '42501';
  end if;
  if not exists (select 1 from public.ranks where id = p_to_rank_id and program_id = e.program_id) then
    raise exception 'rank is not in this program' using errcode = '22023';
  end if;
  if not app.has_permission('ranks.promote') then
    raise exception 'missing permission ranks.promote' using errcode = '42501';
  end if;
  insert into public.promotions (tenant_id, enrollment_id, from_rank_id, to_rank_id, testing_event_id, promoted_by_user_id, reason)
  values (e.tenant_id, e.id, e.current_rank_id, p_to_rank_id, p_testing_event_id, auth.uid(), nullif(trim(p_reason), ''))
  returning id into pid;
  update public.enrollments
     set current_rank_id = p_to_rank_id, stripes = 0, last_promoted_at = now(), classes_since_promotion = 0
   where id = e.id;
  return pid;
end;
$$;

create or replace function public.award_stripe(p_enrollment_id uuid, p_note text default null)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  e public.enrollments;
  maxs int;
begin
  select * into e from public.enrollments where id = p_enrollment_id for update;
  if not found then
    raise exception 'enrollment not found' using errcode = '42501';
  end if;
  select stripes_max into maxs from public.ranks where id = e.current_rank_id;
  if coalesce(maxs, 0) = 0 then
    raise exception 'this rank has no stripes' using errcode = '22023';
  end if;
  if e.stripes >= maxs then
    raise exception 'already at the maximum of % stripes', maxs using errcode = '22023';
  end if;
  insert into public.stripe_awards (tenant_id, enrollment_id, rank_id, awarded_by_user_id, note)
  values (e.tenant_id, e.id, e.current_rank_id, auth.uid(), nullif(trim(p_note), ''));
  update public.enrollments set stripes = stripes + 1 where id = e.id;
  return e.stripes + 1;
end;
$$;

create or replace function public.sign_off_skill(p_enrollment_id uuid, p_skill_id uuid, p_score numeric default null, p_notes text default null, p_source text default 'manual')
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
  sid uuid;
begin
  insert into public.skill_signoffs (tenant_id, enrollment_id, skill_id, by_user_id, score, notes, source)
  values (tid, p_enrollment_id, p_skill_id, auth.uid(), p_score, nullif(trim(p_notes), ''), p_source)
  on conflict (enrollment_id, skill_id) do update
    set signed_off_at = now(), by_user_id = auth.uid(), score = excluded.score, notes = excluded.notes, source = excluded.source
  returning id into sid;
  return sid;
end;
$$;

revoke execute on function public.promote(uuid, uuid, text, uuid), public.award_stripe(uuid, text),
  public.sign_off_skill(uuid, uuid, numeric, text, text) from public, anon;
grant execute on function public.promote(uuid, uuid, text, uuid), public.award_stripe(uuid, text),
  public.sign_off_skill(uuid, uuid, numeric, text, text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Progress view (F4.2 inputs for the eligibility engine). The attendance count is materialised in
-- enrollments.classes_since_promotion by triggers on attendance (attached in 0012 with the table).
-- ---------------------------------------------------------------------------------------------
create view public.v_enrollment_progress with (security_invoker = true) as
  select
    e.id as enrollment_id, e.tenant_id, e.person_id, e.program_id, e.status, e.stripes, e.started_at, e.last_promoted_at,
    e.classes_since_promotion,
    (current_date - coalesce(e.last_promoted_at::date, e.started_at)) as days_since_promotion,
    cr.id as current_rank_id, cr.name as current_rank_name, cr.belt_color as current_belt_color, cr.position as current_position,
    cr.stripes_max,
    nr.id as next_rank_id, nr.name as next_rank_name, nr.belt_color as next_belt_color, nr.testing_fee_cents as next_testing_fee_cents,
    rr.min_classes, rr.min_days, coalesce(rr.requires_instructor_approval, false) as requires_instructor_approval,
    (select count(*) from public.rank_skills rs where rs.rank_id = nr.id and rs.required)::int as required_skills,
    (select count(*) from public.rank_skills rs join public.skill_signoffs so on so.skill_id = rs.skill_id and so.enrollment_id = e.id
       where rs.rank_id = nr.id and rs.required)::int as signed_required_skills,
    exists (select 1 from public.promotion_approvals pa where pa.enrollment_id = e.id and pa.rank_id = nr.id) as instructor_approved
  from public.enrollments e
  left join public.ranks cr on cr.id = e.current_rank_id
  left join lateral (
    select r.* from public.ranks r
    where r.program_id = e.program_id and r.position > coalesce(cr.position, 0)
    order by r.position limit 1
  ) nr on true
  left join public.rank_requirements rr on rr.rank_id = nr.id;

select app.index_foreign_keys();
