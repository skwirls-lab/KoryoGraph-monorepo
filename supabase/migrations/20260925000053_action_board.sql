-- 0053 Post-class Action Board (A4, M4.06). An instructor records a class (or pastes notes); the audio is
-- transcribed and analysed into a draft board — attendance confirmations, skill notes, injury flags and
-- follow-ups — that waits in Approvals and is written only when someone approves it. Recording a class with
-- minors requires every minor on the roster to have AI-processing consent; the database refuses otherwise.

create table public.class_recordings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  session_id uuid not null,
  source text not null default 'audio' check (source in ('audio', 'notes')),
  storage_path text,
  mime text,
  size_bytes int,
  status text not null default 'uploaded' check (status in ('uploaded', 'transcribing', 'transcribed', 'analyzing', 'ready', 'failed')),
  transcript text,
  error text,
  approval_item_id uuid references public.approval_items (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((source = 'audio') = (storage_path is not null)),
  foreign key (tenant_id, session_id) references public.class_sessions (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.class_recordings', 'attendance.write', 'attendance.write', 'intelligence');

-- Minors on a session's roster (enrolled/booked/attended) without a current AI-processing consent.
create or replace function public.recording_consent_gaps(p_session_id uuid)
returns table (person_id uuid, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.person_id, r.display_name
  from public.v_class_roster r join public.people p on p.id = r.person_id
  where r.session_id = p_session_id and r.tenant_id = app.tenant_id() and app.has_permission('attendance.write')
    and p.dob is not null and p.dob > current_date - interval '18 years'
    and coalesce((select c.granted from public.consents c where c.person_id = p.id and c.kind = 'ai_processing' order by c.granted_at desc limit 1), false) = false;
$$;
grant execute on function public.recording_consent_gaps(uuid) to authenticated;

-- Refuse audio recordings while any minor on the roster lacks consent (the app checks first; this is the backstop).
create or replace function app.recording_consent_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source = 'audio' and exists (select 1 from public.recording_consent_gaps(new.session_id)) then
    raise exception 'every minor on the roster needs AI-processing consent before a class is recorded' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger recording_consent_check before insert on public.class_recordings for each row execute function app.recording_consent_check();

-- Audio files: "<tenant>/recordings/<session>/<file>", written and read by staff who take attendance.
create policy tenant_media_recordings_write on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-media' and (storage.foldername(name))[1] = (select app.tenant_id())::text
              and (storage.foldername(name))[2] = 'recordings' and (select app.has_permission('attendance.write')));
create policy tenant_media_recordings_read on storage.objects for select to authenticated
  using (bucket_id = 'tenant-media' and (storage.foldername(name))[1] = (select app.tenant_id())::text
         and (storage.foldername(name))[2] = 'recordings' and (select app.has_permission('attendance.write')));
create policy tenant_media_recordings_delete on storage.objects for delete to authenticated
  using (bucket_id = 'tenant-media' and (storage.foldername(name))[1] = (select app.tenant_id())::text
         and (storage.foldername(name))[2] = 'recordings' and (select app.has_permission('attendance.write')));

insert into public.jobs (name, schedule, description) values
  ('transcribe', '* * * * *', 'Transcribe uploaded class recordings and draft their action boards')
on conflict (name) do update set schedule = excluded.schedule, description = excluded.description;

select app.index_foreign_keys();
