-- 0007 Person notes (F3.3 timeline, F3.9 base). Written by staff (Desk/Mat) and by the Action Board (M4).
-- Visibility: staff with people.read. Guardians never see staff notes.

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  person_id uuid not null,
  kind text not null default 'general' check (kind in ('general', 'injury', 'behavior', 'progress', 'billing', 'follow_up')),
  body text not null check (length(trim(body)) > 0),
  pinned boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'action_board', 'import', 'automation')),
  by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.notes', 'people.write', 'people.read');
create index notes_person on public.notes (person_id, created_at desc);

-- Instructors (people.read + attendance.write, but not people.write) may add notes from the Mat.
create policy notes_instructor_insert on public.notes for insert to authenticated
  with check (tenant_id = (select app.tenant_id()) and (select app.has_permission('attendance.write')) and by_user_id = (select auth.uid()));

select app.index_foreign_keys();
