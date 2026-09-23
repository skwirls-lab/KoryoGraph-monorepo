-- 0062 CSV imports (M5.03). The app parses and validates the file (mapping headers to fields, resolving program,
-- rank and plan names to ids) and sends normalized rows here in chunks. Each chunk is applied atomically as the
-- signed-in user (RLS applies). Everything an import creates is recorded so it can be rolled back; people are
-- matched by external id (then by name + date of birth), so re-importing the same file changes nothing.

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  preset text not null default 'generic',
  headers text[] not null default '{}',
  row_count int not null default 0,
  mapping jsonb not null default '{}'::jsonb,
  status text not null default 'uploaded' check (status in ('uploaded', 'committing', 'committed', 'rolled_back', 'failed')),
  stats jsonb not null default '{}'::jsonb,
  error text,
  created_by uuid references auth.users (id) on delete set null,
  committed_at timestamptz,
  rolled_back_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.setup_tenant_table('public.imports', 'people.write', 'people.write');

create table public.import_entities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  import_id uuid not null,
  entity_type text not null check (entity_type in ('person', 'household', 'household_member', 'enrollment', 'membership')),
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, import_id) references public.imports (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.import_entities', 'people.write', 'people.write');

-- p_rows: [{ row, external_id, first_name, last_name, dob, email, phone, status, email_consent,
--            guardian: { first_name, last_name, email, phone } | null,
--            program_id, rank_id, start_date, classes_since_promotion, plan_id, billing_day }]
create or replace function public.import_rows(p_import_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
  imp public.imports;
  r jsonb;
  g jsonb;
  pid uuid;
  gid uuid;
  hid uuid;
  eid uuid;
  mid uuid;
  created int := 0;
  updated int := 0;
  households int := 0;
  enrollments int := 0;
  memberships int := 0;
  today date := (now() at time zone (select timezone from public.tenants where id = tid))::date;
  sd date;
  bday int;
begin
  if tid is null or not app.has_permission('people.write') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into imp from public.imports where id = p_import_id and tenant_id = tid for update;
  if not found or imp.status not in ('uploaded', 'committing') then
    raise exception 'that import is not open' using errcode = '22023';
  end if;
  update public.imports set status = 'committing' where id = imp.id and status = 'uploaded';

  for r in select * from jsonb_array_elements(p_rows) loop
    pid := null;
    if nullif(r ->> 'external_id', '') is not null then
      select id into pid from public.people where tenant_id = tid and external_id = r ->> 'external_id';
    end if;
    if pid is null then
      select id into pid from public.people
       where tenant_id = tid and archived_at is null and 'student' = any (type_flags)
         and lower(first_name) = lower(r ->> 'first_name') and lower(last_name) = lower(r ->> 'last_name')
         and dob is not distinct from nullif(r ->> 'dob', '')::date
       limit 1;
    end if;
    if pid is null then
      insert into public.people (tenant_id, type_flags, first_name, last_name, dob, email, phone, status, source, external_id, email_consent)
      values (tid, '{student}', r ->> 'first_name', coalesce(r ->> 'last_name', ''), nullif(r ->> 'dob', '')::date, nullif(r ->> 'email', ''),
              nullif(r ->> 'phone', ''), coalesce(nullif(r ->> 'status', ''), 'active'), 'import', nullif(r ->> 'external_id', ''),
              coalesce((r ->> 'email_consent')::boolean, nullif(r ->> 'email', '') is not null))
      returning id into pid;
      insert into public.import_entities (tenant_id, import_id, entity_type, entity_id) values (tid, imp.id, 'person', pid);
      created := created + 1;
    else
      update public.people set
        first_name = r ->> 'first_name', last_name = coalesce(r ->> 'last_name', last_name),
        dob = coalesce(nullif(r ->> 'dob', '')::date, dob), email = coalesce(nullif(r ->> 'email', ''), email), phone = coalesce(nullif(r ->> 'phone', ''), phone),
        status = coalesce(nullif(r ->> 'status', ''), status), external_id = coalesce(external_id, nullif(r ->> 'external_id', ''))
      where id = pid
        and (first_name, last_name, dob, email::text, phone, status, external_id) is distinct from
            (r ->> 'first_name', coalesce(r ->> 'last_name', last_name), coalesce(nullif(r ->> 'dob', '')::date, dob), coalesce(nullif(r ->> 'email', ''), email::text),
             coalesce(nullif(r ->> 'phone', ''), phone), coalesce(nullif(r ->> 'status', ''), status), coalesce(external_id, nullif(r ->> 'external_id', '')));
      if found then updated := updated + 1; end if;
    end if;

    -- Household: the guardian's (matched by email), else a new one; adults without a guardian get their own.
    if not exists (select 1 from public.household_members where person_id = pid) then
      g := r -> 'guardian';
      hid := null;
      gid := null;
      if g is not null and jsonb_typeof(g) = 'object' and nullif(g ->> 'email', '') is not null then
        select p.id into gid from public.people p where p.tenant_id = tid and lower(p.email::text) = lower(g ->> 'email') and 'guardian' = any (p.type_flags) limit 1;
        if gid is not null then
          select hm.household_id into hid from public.household_members hm where hm.person_id = gid and hm.relationship = 'guardian' limit 1;
        else
          insert into public.people (tenant_id, type_flags, first_name, last_name, email, phone, status, source, email_consent)
          values (tid, '{guardian}', coalesce(nullif(g ->> 'first_name', ''), 'Guardian'), coalesce(nullif(g ->> 'last_name', ''), r ->> 'last_name', ''),
                  lower(g ->> 'email'), nullif(g ->> 'phone', ''), 'guardian_only', 'import', coalesce((r ->> 'email_consent')::boolean, true))
          returning id into gid;
          insert into public.import_entities (tenant_id, import_id, entity_type, entity_id) values (tid, imp.id, 'person', gid);
        end if;
      end if;
      if hid is null then
        insert into public.households (tenant_id, name, billing_email, primary_payer_person_id)
        values (tid, coalesce(nullif(g ->> 'last_name', ''), r ->> 'last_name', r ->> 'first_name') || ' family', lower(coalesce(g ->> 'email', r ->> 'email')), coalesce(gid, pid))
        returning id into hid;
        insert into public.import_entities (tenant_id, import_id, entity_type, entity_id) values (tid, imp.id, 'household', hid);
        households := households + 1;
        if gid is not null then
          insert into public.household_members (tenant_id, household_id, person_id, relationship, is_primary_guardian, can_pickup, receives_billing)
          values (tid, hid, gid, 'guardian', true, true, true) returning id into mid;
          insert into public.import_entities (tenant_id, import_id, entity_type, entity_id) values (tid, imp.id, 'household_member', mid);
        end if;
      end if;
      insert into public.household_members (tenant_id, household_id, person_id, relationship, is_primary_guardian, receives_billing)
      values (tid, hid, pid, 'student', false, gid is null) returning id into mid;
      insert into public.import_entities (tenant_id, import_id, entity_type, entity_id) values (tid, imp.id, 'household_member', mid);
    end if;

    -- Program and rank.
    if nullif(r ->> 'program_id', '') is not null then
      sd := coalesce(nullif(r ->> 'start_date', '')::date, today);
      select id into eid from public.enrollments where person_id = pid and program_id = (r ->> 'program_id')::uuid;
      if eid is null then
        insert into public.enrollments (tenant_id, person_id, program_id, current_rank_id, started_at, status, classes_since_promotion)
        values (tid, pid, (r ->> 'program_id')::uuid, nullif(r ->> 'rank_id', '')::uuid, sd, 'active', coalesce((r ->> 'classes_since_promotion')::int, 0))
        returning id into eid;
        insert into public.import_entities (tenant_id, import_id, entity_type, entity_id) values (tid, imp.id, 'enrollment', eid);
        enrollments := enrollments + 1;
      else
        update public.enrollments set current_rank_id = coalesce(nullif(r ->> 'rank_id', '')::uuid, current_rank_id),
               classes_since_promotion = coalesce((r ->> 'classes_since_promotion')::int, classes_since_promotion)
         where id = eid and (current_rank_id, classes_since_promotion) is distinct from
               (coalesce(nullif(r ->> 'rank_id', '')::uuid, current_rank_id), coalesce((r ->> 'classes_since_promotion')::int, classes_since_promotion));
      end if;
    end if;

    -- Membership on an existing plan: billing starts from the next billing day (nothing is back-billed).
    if nullif(r ->> 'plan_id', '') is not null and coalesce(nullif(r ->> 'status', ''), 'active') = 'active'
       and not exists (select 1 from public.memberships where person_id = pid and plan_id = (r ->> 'plan_id')::uuid and status in ('active', 'trial', 'past_due', 'on_hold')) then
      select household_id into hid from public.household_members where person_id = pid limit 1;
      bday := least(28, greatest(1, coalesce((r ->> 'billing_day')::int, extract(day from today)::int)));
      insert into public.memberships (tenant_id, household_id, person_id, plan_id, status, starts_at, billing_day, next_bill_at, autopay, notes)
      values (tid, hid, pid, (r ->> 'plan_id')::uuid, 'active', coalesce(nullif(r ->> 'start_date', '')::date, today), bday,
              case when make_date(extract(year from today)::int, extract(month from today)::int, bday) >= today
                   then make_date(extract(year from today)::int, extract(month from today)::int, bday)
                   else (make_date(extract(year from today)::int, extract(month from today)::int, bday) + interval '1 month')::date end,
              false, 'Imported')
      returning id into mid;
      insert into public.import_entities (tenant_id, import_id, entity_type, entity_id) values (tid, imp.id, 'membership', mid);
      memberships := memberships + 1;
    end if;
  end loop;

  return jsonb_build_object('created', created, 'updated', updated, 'households', households, 'enrollments', enrollments, 'memberships', memberships);
end;
$$;
revoke execute on function public.import_rows(uuid, jsonb) from public, anon;
grant execute on function public.import_rows(uuid, jsonb) to authenticated;

-- Finish (record the totals) or roll back everything the import created. Updates it made to people who
-- already existed are not undone (they're listed in the stats as "updated").
create or replace function public.finish_import(p_import_id uuid, p_stats jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.imports set status = 'committed', committed_at = now(), stats = coalesce(p_stats, '{}')
   where id = p_import_id and tenant_id = app.tenant_id() and status = 'committing';
  if not found then
    raise exception 'that import is not being committed' using errcode = '22023';
  end if;
end;
$$;
grant execute on function public.finish_import(uuid, jsonb) to authenticated;

create or replace function public.rollback_import(p_import_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
  n_people int;
  n_households int;
begin
  if tid is null or not app.has_permission('people.write') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.imports where id = p_import_id and tenant_id = tid and status in ('committed', 'committing', 'failed')) then
    raise exception 'that import can''t be rolled back' using errcode = '22023';
  end if;
  delete from public.memberships where id in (select entity_id from public.import_entities where import_id = p_import_id and entity_type = 'membership');
  delete from public.enrollments where id in (select entity_id from public.import_entities where import_id = p_import_id and entity_type = 'enrollment');
  delete from public.household_members where id in (select entity_id from public.import_entities where import_id = p_import_id and entity_type = 'household_member');
  delete from public.households where id in (select entity_id from public.import_entities where import_id = p_import_id and entity_type = 'household');
  get diagnostics n_households = row_count;
  delete from public.people where id in (select entity_id from public.import_entities where import_id = p_import_id and entity_type = 'person');
  get diagnostics n_people = row_count;
  update public.imports set status = 'rolled_back', rolled_back_at = now() where id = p_import_id;
  return jsonb_build_object('people', n_people, 'households', n_households);
end;
$$;
revoke execute on function public.rollback_import(uuid) from public, anon;
grant execute on function public.rollback_import(uuid) to authenticated;

-- Uploaded files: "<tenant>/imports/<file>", people writers only.
create policy tenant_media_imports_write on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-media' and (storage.foldername(name))[1] = (select app.tenant_id())::text
              and (storage.foldername(name))[2] = 'imports' and (select app.has_permission('people.write')));
create policy tenant_media_imports_read on storage.objects for select to authenticated
  using (bucket_id = 'tenant-media' and (storage.foldername(name))[1] = (select app.tenant_id())::text
         and (storage.foldername(name))[2] = 'imports' and (select app.has_permission('people.write')));

select app.index_foreign_keys();
