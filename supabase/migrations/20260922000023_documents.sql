-- 0023 Documents & compliance (§4.10, F12.1–F12.3). Versioned templates; immutable signatures of a
-- specific version; tenant-scoped Storage bucket; required-document view; signing links for families
-- without a login (definer RPCs validate a hashed token).

create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kind text not null default 'waiver' check (kind in ('waiver', 'contract', 'policy', 'media_release')),
  name text not null check (length(trim(name)) > 0),
  version int not null default 1 check (version >= 1),
  body text not null,
  required_for jsonb not null default '{"all_students": false, "program_ids": []}'::jsonb,
  active boolean not null default true,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name, version)
);
select app.setup_tenant_table('public.document_templates', 'settings.manage');

create table public.signatures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  template_id uuid not null,
  person_id uuid not null,
  signer_person_id uuid,
  signer_user_id uuid references auth.users (id) on delete set null,
  signed_at timestamptz not null default now(),
  ip text,
  user_agent text,
  typed_name text not null check (length(trim(typed_name)) >= 2),
  pdf_path text,
  method text not null check (method in ('home', 'kiosk', 'desk', 'link')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, person_id),
  foreign key (tenant_id, template_id) references public.document_templates (tenant_id, id) on delete restrict,
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade,
  foreign key (tenant_id, signer_person_id) references public.people (tenant_id, id) on delete set null (signer_person_id)
);
-- Staff record desk signatures (people.write); signatures are never edited or deleted (no policies for it)
-- except that the PDF path is attached once by the signer or the signature_pdfs job.
select app.apply_tenant_policies('public.signatures', null, 'people.read');
alter table public.signatures add constraint signatures_tenant_id_id_key unique (tenant_id, id);
select app.attach_audit('public.signatures');
create trigger set_updated_at before update on public.signatures for each row execute function app.set_updated_at();
create policy signatures_staff_insert on public.signatures for insert to authenticated
  with check (tenant_id = (select app.tenant_id()) and (select app.has_permission('people.write')) and method = 'desk' and signer_user_id = (select auth.uid()));
create policy signatures_household_select on public.signatures for select to authenticated
  using (tenant_id = (select app.tenant_id()) and person_id = any ((select app.household_person_ids())::uuid[]));
create policy signatures_household_insert on public.signatures for insert to authenticated
  with check (
    tenant_id = (select app.tenant_id()) and method = 'home' and signer_user_id = (select auth.uid())
    and person_id = any ((select app.household_person_ids())::uuid[])
    and (signer_person_id is null or signer_person_id = (select app.person_id()))
  );
-- The signer attaches the PDF path to their own fresh signature (only when still empty).
create policy signatures_pdf_attach on public.signatures for update to authenticated
  using (tenant_id = (select app.tenant_id()) and signer_user_id = (select auth.uid()) and pdf_path is null)
  with check (tenant_id = (select app.tenant_id()) and signer_user_id = (select auth.uid()));
create or replace function app.signatures_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.template_id, new.person_id, new.signer_person_id, new.signer_user_id, new.signed_at, new.typed_name, new.method, new.ip)
     is distinct from (old.template_id, old.person_id, old.signer_person_id, old.signer_user_id, old.signed_at, old.typed_name, old.method, old.ip) then
    raise exception 'signatures are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger signatures_immutable before update on public.signatures for each row execute function app.signatures_immutable();

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  person_id uuid,
  household_id uuid,
  kind text not null default 'other' check (kind in ('medical', 'photo', 'certificate', 'id', 'contract', 'other')),
  name text not null,
  storage_path text not null unique,
  mime text,
  size int,
  uploaded_by uuid references auth.users (id) on delete set null,
  expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade,
  foreign key (tenant_id, household_id) references public.households (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.documents', 'people.write', 'people.read');

create table public.staff_certifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  issuer text,
  number text,
  issued_at date,
  expires_at date,
  document_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, document_id) references public.documents (tenant_id, id) on delete set null (document_id)
);
select app.setup_tenant_table('public.staff_certifications', 'staff.manage', 'people.read');

-- Signing links for families without a login (created by staff, completed via definer RPCs).
create table public.signature_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  template_id uuid not null,
  person_id uuid not null,
  signer_person_id uuid,
  token_hash text not null unique,
  expires_at timestamptz not null default now() + interval '14 days',
  used_at timestamptz,
  signature_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, template_id) references public.document_templates (tenant_id, id) on delete cascade,
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade,
  foreign key (tenant_id, signer_person_id) references public.people (tenant_id, id) on delete set null (signer_person_id),
  foreign key (tenant_id, signature_id) references public.signatures (tenant_id, id) on delete set null (signature_id)
);
select app.setup_tenant_table('public.signature_requests', 'people.write', 'people.write');

-- ---------------------------------------------------------------------------------------------
-- Required documents: each active (latest) template × each active/trial student it applies to.
-- ---------------------------------------------------------------------------------------------
create view public.v_required_documents with (security_invoker = true) as
  select t.tenant_id, t.id as template_id, t.name as template_name, t.version, t.kind, p.id as person_id,
         trim(coalesce(p.preferred_name, p.first_name) || ' ' || p.last_name) as person_name, p.dob,
         s.id as signature_id, s.signed_at, s.pdf_path,
         exists (select 1 from public.signatures os join public.document_templates ot on ot.id = os.template_id
                 where os.person_id = p.id and ot.name = t.name and ot.tenant_id = t.tenant_id and ot.version < t.version) as signed_older_version
  from public.document_templates t
  join public.people p on p.tenant_id = t.tenant_id and p.archived_at is null and p.status in ('active', 'trial') and 'student' = any (p.type_flags)
  left join public.signatures s on s.template_id = t.id and s.person_id = p.id
  where t.active
    and (coalesce((t.required_for ->> 'all_students')::boolean, false)
         or exists (select 1 from public.enrollments e where e.person_id = p.id and e.status = 'active'
                    and e.program_id::text in (select jsonb_array_elements_text(coalesce(t.required_for -> 'program_ids', '[]'::jsonb)))));

-- Publish a new version of a document: deactivate older versions, insert version N+1.
create or replace function public.publish_document(p_name text, p_kind text, p_body text, p_required_for jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
  v int;
  nid uuid;
begin
  select coalesce(max(version), 0) + 1 into v from public.document_templates where tenant_id = tid and name = trim(p_name);
  update public.document_templates set active = false where tenant_id = tid and name = trim(p_name) and active;
  insert into public.document_templates (tenant_id, kind, name, version, body, required_for, active, published_by)
  values (tid, p_kind, trim(p_name), v, p_body, coalesce(p_required_for, '{}'::jsonb), true, auth.uid())
  returning id into nid;
  return nid;
end;
$$;
revoke execute on function public.publish_document(text, text, text, jsonb) from public, anon;
grant execute on function public.publish_document(text, text, text, jsonb) to authenticated;

-- Signing-link RPCs (anon): look up by token; complete once.
create or replace function public.signature_request_info(p_token text)
returns table (request_id uuid, tenant_name text, template_name text, version int, body text, person_name text, signer_name text, expired boolean, used boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, tn.name, t.name, t.version, t.body,
         trim(coalesce(p.preferred_name, p.first_name) || ' ' || p.last_name),
         case when g.id is null then null else trim(g.first_name || ' ' || g.last_name) end,
         r.expires_at < now(), r.used_at is not null
  from public.signature_requests r
  join public.tenants tn on tn.id = r.tenant_id
  join public.document_templates t on t.id = r.template_id
  join public.people p on p.id = r.person_id
  left join public.people g on g.id = r.signer_person_id
  where r.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

create or replace function public.complete_signature_request(p_token text, p_typed_name text, p_ip text, p_user_agent text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.signature_requests;
  sid uuid;
begin
  select * into r from public.signature_requests
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') for update;
  if not found or r.expires_at < now() then
    raise exception 'this signing link is invalid or expired' using errcode = '42501';
  end if;
  if r.used_at is not null then
    raise exception 'this document was already signed' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_typed_name, ''))) < 2 then
    raise exception 'type your full name to sign' using errcode = '22023';
  end if;
  insert into public.signatures (tenant_id, template_id, person_id, signer_person_id, typed_name, ip, user_agent, method)
  values (r.tenant_id, r.template_id, r.person_id, r.signer_person_id, trim(p_typed_name), p_ip, left(p_user_agent, 300), 'link')
  on conflict (template_id, person_id) do nothing
  returning id into sid;
  update public.signature_requests set used_at = now(), signature_id = sid where id = r.id;
  return sid;
end;
$$;
revoke execute on function public.signature_request_info(text), public.complete_signature_request(text, text, text, text) from public;
grant execute on function public.signature_request_info(text), public.complete_signature_request(text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Storage: private bucket, paths "<tenant_id>/…". Staff (people.read/write) use the whole tenant folder;
-- Home users read/write "<tenant_id>/households/<their household>/…" only.
-- ---------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('tenant-media', 'tenant-media', false, 52428800)
on conflict (id) do nothing;

create policy tenant_media_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'tenant-media' and (storage.foldername(name))[1] = (select app.tenant_id())::text and (select app.has_permission('people.read')));
create policy tenant_media_staff_write on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-media' and (storage.foldername(name))[1] = (select app.tenant_id())::text and (select app.has_permission('people.write')));
create policy tenant_media_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'tenant-media' and (storage.foldername(name))[1] = (select app.tenant_id())::text and (select app.has_permission('people.write')));
create policy tenant_media_household_read on storage.objects for select to authenticated
  using (bucket_id = 'tenant-media' and (storage.foldername(name))[1] = (select app.tenant_id())::text
         and (storage.foldername(name))[2] = 'households'
         and (storage.foldername(name))[3] in (select unnest((select app.household_ids()))::text));
create policy tenant_media_household_write on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-media' and (storage.foldername(name))[1] = (select app.tenant_id())::text
              and (storage.foldername(name))[2] = 'households'
              and (storage.foldername(name))[3] in (select unnest((select app.household_ids()))::text)
              and (storage.foldername(name))[4] = 'signatures');

select app.index_foreign_keys();
