-- 0058 Technique feedback (A11, vision) and schedule suggestions (A12) — M4.11.
-- A student (or their guardian) uploads a ≤60 s practice clip for a skill; a job extracts keyframes and the
-- vision tier scores them against the skill's rubric. The draft waits for an instructor; the student sees
-- nothing until it's released. Minors need a guardian's recorded AI-processing consent — the database
-- refuses the submission otherwise.

-- Optional instructor reference clip per skill (keyframes extracted by the same job).
alter table public.skills add column gold_video_path text, add column gold_keyframe_paths text[] not null default '{}';

create table public.technique_submissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  person_id uuid not null,
  skill_id uuid not null,
  video_path text not null,
  duration_ms int,
  note text check (note is null or length(note) <= 500),
  keyframe_paths text[] not null default '{}',
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'review', 'released', 'returned', 'failed')),
  -- Written only when an instructor releases it (the AI draft lives in the approval item until then).
  feedback jsonb,
  return_reason text,
  error text,
  ai_run_id uuid references public.ai_runs (id) on delete set null,
  approval_item_id uuid references public.approval_items (id) on delete set null,
  reviewed_by_user_id uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  released_to_student boolean not null default false,
  released_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade,
  foreign key (tenant_id, skill_id) references public.skills (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.technique_submissions', 'attendance.write', 'attendance.write', 'vision');
create policy technique_submissions_household_select on public.technique_submissions for select to authenticated
  using (tenant_id = (select app.tenant_id()) and (select app.has_module('vision')) and person_id = any ((select app.household_person_ids())::uuid[]));

-- Minor without a current AI-processing consent?
create or replace function app.needs_ai_consent(p_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p.dob is not null and p.dob > current_date - interval '18 years'
         and coalesce((select c.granted from public.consents c where c.person_id = p.id and c.kind = 'ai_processing' order by c.granted_at desc limit 1), false) = false
  from public.people p where p.id = p_person_id;
$$;

create or replace function app.technique_consent_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(app.needs_ai_consent(new.person_id), true) then
    raise exception 'a guardian needs to give AI-processing consent before a clip of a minor is analysed' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger technique_consent_check before insert on public.technique_submissions for each row execute function app.technique_consent_check();

-- A family submits a clip for one of its students (the file is already in storage under that student's folder).
create or replace function public.submit_technique(p_person_id uuid, p_skill_id uuid, p_video_path text, p_duration_ms int, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
  sid uuid;
begin
  if tid is null or not app.has_module('vision') or not (p_person_id = any (app.household_person_ids())) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.skills where id = p_skill_id and tenant_id = tid and archived_at is null) then
    raise exception 'unknown skill' using errcode = '22023';
  end if;
  if p_video_path is null or p_video_path not like tid::text || '/technique/' || p_person_id::text || '/%' then
    raise exception 'upload the clip first' using errcode = '22023';
  end if;
  if p_duration_ms is null or p_duration_ms > 61000 then
    raise exception 'clips can be at most 60 seconds' using errcode = '22023';
  end if;
  if (select count(*) from public.technique_submissions where person_id = p_person_id and status in ('uploaded', 'processing', 'review')) >= 3 then
    raise exception 'there are already 3 clips waiting for review for this student' using errcode = '22023';
  end if;
  insert into public.technique_submissions (tenant_id, person_id, skill_id, video_path, duration_ms, note, created_by)
  values (tid, p_person_id, p_skill_id, p_video_path, p_duration_ms, nullif(trim(p_note), ''), auth.uid())
  returning id into sid;
  return sid;
end;
$$;
revoke execute on function public.submit_technique(uuid, uuid, text, int, text) from public, anon;
grant execute on function public.submit_technique(uuid, uuid, text, int, text) to authenticated;

-- Release an approved draft to the student (atomic, once), from the approved payload.
create or replace function public.release_technique_feedback(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
  it public.approval_items;
  result jsonb;
begin
  if tid is null or not app.has_module('vision') or not app.has_permission('ai.approve') or not app.has_permission('attendance.write') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into it from public.approval_items where id = p_id and tenant_id = tid and kind = 'vision_feedback' for update;
  if not found or it.status <> 'approved' then
    raise exception 'approve the feedback first' using errcode = '22023';
  end if;
  if it.executed_at is not null then
    return it.execution_result;
  end if;
  update public.technique_submissions
     set feedback = it.payload -> 'feedback', status = 'released', released_to_student = true, released_at = now(),
         reviewed_by_user_id = auth.uid(), reviewed_at = now()
   where id = (it.payload ->> 'submission_id')::uuid and tenant_id = tid and approval_item_id = it.id and status = 'review';
  if not found then
    raise exception 'that clip is no longer waiting for review' using errcode = '22023';
  end if;
  result := jsonb_build_object('ok', true, 'summary', 'Released to the student');
  update public.approval_items set executed_at = now(), execution_result = result, entity_type = 'technique_submission', entity_id = (it.payload ->> 'submission_id')::uuid where id = it.id;
  return result;
end;
$$;
revoke execute on function public.release_technique_feedback(uuid) from public, anon;
grant execute on function public.release_technique_feedback(uuid) to authenticated;

-- Rejecting the draft sends the clip back to the family with the reviewer's reason.
create or replace function app.technique_returned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'vision_feedback' and new.status = 'rejected' and old.status = 'pending' then
    update public.technique_submissions set status = 'returned', return_reason = new.feedback, reviewed_by_user_id = new.decided_by, reviewed_at = now()
     where approval_item_id = new.id and status = 'review';
  end if;
  return new;
end;
$$;
create trigger technique_returned after update of status on public.approval_items for each row execute function app.technique_returned();

-- Consents recorded from Home: a guardian for a student in their household, or an adult for themselves.
drop policy consents_household_insert on public.consents;
create policy consents_household_insert on public.consents for insert to authenticated
  with check (
    tenant_id = (select app.tenant_id()) and method = 'home' and guardian_person_id = (select app.person_id())
    and person_id = any ((select app.household_person_ids())::uuid[])
    and (
      exists (select 1 from public.household_members g join public.household_members s on s.household_id = g.household_id
              where g.person_id = (select app.person_id()) and g.relationship = 'guardian' and s.person_id = consents.person_id)
      or (person_id = (select app.person_id()) and exists (select 1 from public.people me where me.id = consents.person_id and (me.dob is null or me.dob <= current_date - interval '18 years')))
    )
  );

-- Clips: "<tenant>/technique/<person>/<file>" — the family writes/reads its own students' folders; staff who
-- review read them. Gold-standard clips: "<tenant>/gold/<skill>/<file>", curriculum writers.
create policy tenant_media_technique_write on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-media' and (storage.foldername(name))[1] = (select app.tenant_id())::text
              and (storage.foldername(name))[2] = 'technique' and (select app.has_module('vision'))
              and (storage.foldername(name))[3] = any ((select app.household_person_ids())::text[]));
create policy tenant_media_technique_read on storage.objects for select to authenticated
  using (bucket_id = 'tenant-media' and (storage.foldername(name))[1] = (select app.tenant_id())::text
         and (storage.foldername(name))[2] = 'technique'
         and ((storage.foldername(name))[3] = any ((select app.household_person_ids())::text[]) or (select app.has_permission('attendance.write'))));
create policy tenant_media_gold_write on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-media' and (storage.foldername(name))[1] = (select app.tenant_id())::text
              and (storage.foldername(name))[2] = 'gold' and (select app.has_permission('curriculum.write')));
create policy tenant_media_gold_read on storage.objects for select to authenticated
  using (bucket_id = 'tenant-media' and (storage.foldername(name))[1] = (select app.tenant_id())::text
         and (storage.foldername(name))[2] = 'gold' and ((select app.has_permission('curriculum.write')) or (select app.has_permission('attendance.write'))));

-- A12: weekly timetable suggestions for the owner.
create table public.schedule_suggestions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  week_of date not null,
  kind text not null check (kind in ('add_section', 'merge', 'move', 'no_show')),
  template_id uuid,
  title text not null,
  rationale text not null,
  stats jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'dismissed', 'done')),
  ai_run_id uuid references public.ai_runs (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, week_of, kind, template_id),
  foreign key (tenant_id, template_id) references public.class_templates (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.schedule_suggestions', 'schedule.manage', 'schedule.manage', 'intelligence');

-- Per recurring class over the last p_weeks complete weeks: sessions, capacity, attendance, waitlist, no-shows.
create or replace function public.schedule_stats(p_tenant_id uuid, p_weeks int default 4)
returns table (template_id uuid, name text, weekday text, start_time text, program_ids uuid[], sessions int, capacity int,
               avg_attended numeric, avg_booked numeric, avg_waitlisted numeric, no_show_rate numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with s as (
    select cs.id, cs.template_id, coalesce(cs.capacity, ct.capacity) as capacity,
           extract(isodow from cs.starts_at at time zone t.timezone)::int as dow, to_char(cs.starts_at at time zone t.timezone, 'Dy') as dy,
           to_char(cs.starts_at at time zone t.timezone, 'FMHH12:MI AM') as tm
    from public.class_sessions cs join public.class_templates ct on ct.id = cs.template_id join public.tenants t on t.id = cs.tenant_id
    where cs.tenant_id = p_tenant_id and ct.active and cs.status <> 'cancelled'
      and cs.starts_at >= now() - make_interval(weeks => p_weeks) and cs.starts_at < now()
  ),
  per as (
    select s.template_id, s.capacity, s.dow, s.dy, s.tm,
           (select count(*) from public.attendance a where a.session_id = s.id) as attended,
           (select count(*) from public.bookings b where b.session_id = s.id and b.status in ('booked', 'attended', 'no_show')) as booked,
           (select count(*) from public.bookings b where b.session_id = s.id and b.status = 'waitlisted') as waitlisted,
           (select count(*) from public.bookings b where b.session_id = s.id and b.status = 'no_show') as no_shows
    from s
  )
  select ct.id, ct.name,
         (select string_agg(x.dy, '/' order by x.dow) from (select distinct p2.dow, p2.dy from per p2 where p2.template_id = ct.id) x),
         min(per.tm), ct.program_ids,
         count(*)::int, max(per.capacity)::int,
         round(avg(per.attended), 2), round(avg(per.booked), 2), round(avg(per.waitlisted), 2),
         round(coalesce(sum(per.no_shows)::numeric / nullif(sum(per.booked), 0), 0), 3)
  from per join public.class_templates ct on ct.id = per.template_id
  group by ct.id, ct.name, ct.program_ids;
$$;
revoke execute on function public.schedule_stats(uuid, int) from public, anon, authenticated;
grant execute on function public.schedule_stats(uuid, int) to service_role;

-- Whether a draft came from a recorded dev fixture must be visible to whoever reviews it, but ai_runs (cost,
-- model, errors) is readable only with settings.manage. Copy just the transport onto the reviewed rows.
alter table public.approval_items add column ai_transport text;
alter table public.schedule_suggestions add column ai_transport text;
create or replace function app.copy_ai_transport()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.ai_transport := case when new.ai_run_id is null then null else (select r.transport from public.ai_runs r where r.id = new.ai_run_id) end;
  return new;
end;
$$;
create trigger copy_ai_transport before insert or update of ai_run_id on public.approval_items for each row execute function app.copy_ai_transport();
create trigger copy_ai_transport before insert or update of ai_run_id on public.schedule_suggestions for each row execute function app.copy_ai_transport();
update public.approval_items a set ai_transport = r.transport from public.ai_runs r where r.id = a.ai_run_id;

insert into public.jobs (name, schedule, description) values
  ('technique_feedback', '* * * * *', 'Extract keyframes from uploaded practice clips and draft rubric feedback for instructor review'),
  ('schedule_suggestions', '0 6 * * 1', 'Suggest timetable changes from utilization, waitlists and no-shows')
on conflict (name) do update set schedule = excluded.schedule, description = excluded.description;

select app.index_foreign_keys();
