-- 0040 Belt testing (§4.5, F6.1–F6.5): testing events, registrations (invite → register → pay → confirm →
-- result), per-judge scoresheets, certificate templates, bulk promotion. Registry fields on people (F6.5).

alter table public.people add column name_native text, add column nationality text, add column tcon_id text;

create table public.testing_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  location_id uuid,
  name text not null check (length(trim(name)) > 0),
  starts_at timestamptz not null,
  ends_at timestamptz,
  program_ids uuid[] not null default '{}',
  fee_cents int not null default 0 check (fee_cents >= 0),
  registration_deadline date,
  capacity int check (capacity is null or capacity > 0),
  judges uuid[] not null default '{}',
  status text not null default 'open' check (status in ('draft', 'open', 'closed', 'completed')),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id) on delete set null (location_id)
);
select app.setup_tenant_table('public.testing_events', 'testing.manage', 'people.read');

create table public.testing_registrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  testing_event_id uuid not null,
  enrollment_id uuid not null,
  person_id uuid not null,
  to_rank_id uuid,
  status text not null default 'invited' check (status in ('invited', 'registered', 'paid', 'confirmed', 'withdrawn', 'passed', 'conditional', 'failed')),
  eligibility_snapshot jsonb not null default '{}'::jsonb,
  override_reason text,
  invoice_id uuid,
  result_notes text,
  promotion_id uuid,
  invited_at timestamptz,
  registered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (testing_event_id, enrollment_id),
  foreign key (tenant_id, testing_event_id) references public.testing_events (tenant_id, id) on delete cascade,
  foreign key (tenant_id, enrollment_id) references public.enrollments (tenant_id, id) on delete cascade,
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade,
  foreign key (tenant_id, to_rank_id) references public.ranks (tenant_id, id) on delete set null (to_rank_id),
  foreign key (tenant_id, invoice_id) references public.invoices (tenant_id, id) on delete set null (invoice_id),
  foreign key (tenant_id, promotion_id) references public.promotions (tenant_id, id) on delete set null (promotion_id)
);
select app.setup_tenant_table('public.testing_registrations', 'testing.manage', 'people.read');
-- Families see their own students' registrations and the events those belong to.
create policy testing_registrations_household_select on public.testing_registrations for select to authenticated
  using (tenant_id = (select app.tenant_id()) and person_id = any ((select app.household_person_ids())::uuid[]));
create policy testing_events_household_select on public.testing_events for select to authenticated
  using (tenant_id = (select app.tenant_id()) and id in (select testing_event_id from public.testing_registrations));

create table public.testing_scores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  registration_id uuid not null,
  judge_user_id uuid not null references auth.users (id) on delete cascade,
  scores jsonb not null default '{}'::jsonb,
  total numeric,
  result text check (result is null or result in ('pass', 'conditional', 'fail')),
  comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (registration_id, judge_user_id),
  foreign key (tenant_id, registration_id) references public.testing_registrations (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.testing_scores', 'testing.manage', 'testing.manage');

-- certificate_templates exists since 0011 (programs reference it); add the text fields the PDF uses.
alter table public.certificate_templates
  add column title text not null default 'Certificate of Rank',
  add column body text not null default 'This certifies that {{student_name}} has been promoted to {{rank_name}} on {{date}}.',
  add column signer_name text,
  add column signer_title text,
  add column is_default boolean not null default true;
create unique index certificate_templates_one_default on public.certificate_templates (tenant_id) where is_default;

-- ---------------------------------------------------------------------------------------------
-- Home: register an invited student (creates the fee invoice, source 'testing').
-- ---------------------------------------------------------------------------------------------
create or replace function public.register_for_testing(p_registration_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.testing_registrations;
  ev public.testing_events;
  hh uuid;
  inv uuid;
  who text;
  taken int;
begin
  select * into r from public.testing_registrations where id = p_registration_id and tenant_id = app.tenant_id() for update;
  if not found or not (r.person_id = any (app.household_person_ids()) or app.has_permission('testing.manage')) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into ev from public.testing_events where id = r.testing_event_id;
  if r.status <> 'invited' then
    return r.invoice_id;
  end if;
  if ev.status <> 'open' or (ev.registration_deadline is not null and ev.registration_deadline < app.tenant_today(ev.tenant_id)) then
    raise exception 'registration for this test is closed' using errcode = '22023';
  end if;
  select count(*) into taken from public.testing_registrations where testing_event_id = ev.id and status in ('registered', 'paid', 'confirmed');
  if ev.capacity is not null and taken >= ev.capacity then
    raise exception 'this test is full' using errcode = '22023';
  end if;
  if ev.fee_cents > 0 then
    select hm.household_id into hh from public.household_members hm
     where hm.person_id = r.person_id and (hm.household_id = any (app.household_ids()) or app.has_permission('testing.manage'))
     order by (hm.household_id = any (app.household_ids())) desc limit 1;
    select trim(coalesce(preferred_name, first_name) || ' ' || last_name) into who from public.people where id = r.person_id;
    insert into public.invoices (tenant_id, household_id, person_id, number, status, due_at, subtotal_cents, total_cents, source, memo)
    values (r.tenant_id, hh, r.person_id, app.next_counter(r.tenant_id, 'invoice'), 'open',
            coalesce(ev.registration_deadline, app.tenant_today(r.tenant_id)), ev.fee_cents, ev.fee_cents, 'testing', ev.name)
    returning id into inv;
    insert into public.invoice_lines (tenant_id, invoice_id, kind, description, quantity, unit_cents, total_cents, ref_type, ref_id)
    values (r.tenant_id, inv, 'testing', 'Testing fee: ' || ev.name || ' — ' || who, 1, ev.fee_cents, ev.fee_cents, 'testing_registration', r.id);
  end if;
  update public.testing_registrations set status = case when inv is null then 'paid' else 'registered' end, registered_at = now(), invoice_id = inv
   where id = r.id;
  return inv;
end;
$$;

-- Paying the testing fee (any path) moves the registration to 'paid'.
create or replace function app.testing_fee_paid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source = 'testing' and new.status = 'paid' and old.status is distinct from 'paid' then
    update public.testing_registrations set status = 'paid' where invoice_id = new.id and status = 'registered';
  end if;
  return null;
end;
$$;
create trigger testing_fee_paid after update of status on public.invoices
  for each row execute function app.testing_fee_paid();

-- ---------------------------------------------------------------------------------------------
-- Bulk promote passed/conditional registrations (ranks.promote); queues a congratulation per family.
-- ---------------------------------------------------------------------------------------------
create or replace function public.bulk_promote(p_event_id uuid, p_registration_ids uuid[])
returns table (registration_id uuid, promotion_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  tid uuid := app.tenant_id();
  ev public.testing_events;
  r record;
  pid uuid;
  rank_name text;
begin
  if tid is null or not app.has_permission('ranks.promote') or not app.has_permission('testing.manage') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into ev from public.testing_events where id = p_event_id and tenant_id = tid;
  if not found then
    raise exception 'testing event not found' using errcode = 'P0002';
  end if;
  for r in select tr.* from public.testing_registrations tr
            where tr.testing_event_id = ev.id and tr.id = any (p_registration_ids) and tr.status in ('passed', 'conditional')
              and tr.promotion_id is null and tr.to_rank_id is not null for update loop
    insert into public.promotions (tenant_id, enrollment_id, from_rank_id, to_rank_id, testing_event_id, promoted_by_user_id, reason, promoted_at)
    select tid, e.id, e.current_rank_id, r.to_rank_id, ev.id, auth.uid(), 'Passed ' || ev.name, now()
    from public.enrollments e where e.id = r.enrollment_id
    returning id into pid;
    update public.enrollments set current_rank_id = r.to_rank_id, stripes = 0, last_promoted_at = now(), classes_since_promotion = 0
     where id = r.enrollment_id;
    update public.testing_registrations set promotion_id = pid where id = r.id;
    select name into rank_name from public.ranks where id = r.to_rank_id;
    perform app.enqueue_system_message(tid, 'promotion_congrats', array[r.person_id],
      jsonb_build_object('rank_name', rank_name, 'event_name', ev.name), 'promotion', pid);
    registration_id := r.id;
    promotion_id := pid;
    return next;
  end loop;
  if not exists (select 1 from public.testing_registrations where testing_event_id = ev.id and status in ('invited', 'registered', 'paid', 'confirmed')) then
    update public.testing_events set status = 'completed' where id = ev.id;
  end if;
end;
$$;

revoke execute on function public.register_for_testing(uuid), public.bulk_promote(uuid, uuid[]) from public, anon;
grant execute on function public.register_for_testing(uuid), public.bulk_promote(uuid, uuid[]) to authenticated;

-- Certificates live next to the student's household docs; staff with testing.manage may write them.
create policy tenant_media_certificates_write on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-media' and (storage.foldername(name))[1] = (select app.tenant_id())::text
              and (storage.foldername(name))[2] = 'certificates' and (select app.has_permission('testing.manage')));
create policy tenant_media_certificates_read on storage.objects for select to authenticated
  using (bucket_id = 'tenant-media' and (storage.foldername(name))[1] = (select app.tenant_id())::text
         and (storage.foldername(name))[2] = 'certificates' and (select app.has_permission('people.read')));

select app.index_foreign_keys();
