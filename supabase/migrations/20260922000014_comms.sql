-- 0014 Communications foundation (§4.9, F10.1–F10.4). Pulled forward into M1.07 (class cancellations
-- notify the roster); M1.11 adds inbox UI, template overrides UI and provider webhooks.
--
-- Every outbound message is a `communications` row. The app renders and (when a provider key exists)
-- sends it, then records it through public.record_communication(), a security-definer RPC that checks the
-- caller belongs to the tenant and the recipient belongs to the tenant. No provider → status
-- 'unsent_no_provider' (the Outbox). Quiet hours → 'deferred' with scheduled_for (outbox_dispatch job).

-- Staff names for pickers and chrome: tenant_users → profiles is embeddable.
alter table public.tenant_users
  add constraint tenant_users_user_profile_fk foreign key (user_id) references public.profiles (id) on delete cascade;

create table public.message_threads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  household_id uuid not null,
  subject text not null default '',
  last_message_at timestamptz not null default now(),
  unread_staff int not null default 0,
  unread_household int not null default 0,
  assigned_user_id uuid references auth.users (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, household_id) references public.households (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.message_threads', 'comms.send', 'comms.send');
create policy message_threads_household_select on public.message_threads for select to authenticated
  using (tenant_id = (select app.tenant_id()) and household_id = any ((select app.household_ids())::uuid[]));
create index message_threads_recent on public.message_threads (tenant_id, last_message_at desc);

create table public.communications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'push', 'inapp')),
  direction text not null default 'out' check (direction in ('out', 'in')),
  person_id uuid,
  household_id uuid,
  to_address text,
  template_key text,
  subject text,
  body_text text not null default '',
  body_html text,
  status text not null default 'queued' check (status in ('queued', 'deferred', 'sent', 'delivered', 'failed', 'unsent_no_provider', 'bounced', 'opted_out', 'no_address')),
  provider text,
  provider_message_id text,
  error text,
  scheduled_for timestamptz,
  thread_id uuid,
  campaign_id uuid,
  automation_run_id uuid,
  approval_item_id uuid,
  related_type text,
  related_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete set null (person_id),
  foreign key (tenant_id, household_id) references public.households (tenant_id, id) on delete set null (household_id),
  foreign key (tenant_id, thread_id) references public.message_threads (tenant_id, id) on delete set null (thread_id)
);
-- Staff with comms.send read the log; nobody inserts directly (record_communication / service role).
select app.setup_tenant_table('public.communications', null, 'comms.send');
create policy communications_household_select on public.communications for select to authenticated
  using (tenant_id = (select app.tenant_id()) and channel = 'inapp'
         and (person_id = any ((select app.household_person_ids())::uuid[]) or household_id = any ((select app.household_ids())::uuid[])));
create index communications_recent on public.communications (tenant_id, created_at desc);
create index communications_related on public.communications (related_type, related_id);
create index communications_deferred on public.communications (scheduled_for) where status = 'deferred';

create table public.thread_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  thread_id uuid not null,
  sender_user_id uuid references auth.users (id) on delete set null,
  sender_person_id uuid,
  from_staff boolean not null,
  body text not null check (length(trim(body)) > 0),
  attachments jsonb not null default '[]'::jsonb,
  read_by jsonb not null default '{}'::jsonb,
  communication_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, thread_id) references public.message_threads (tenant_id, id) on delete cascade,
  foreign key (tenant_id, sender_person_id) references public.people (tenant_id, id) on delete set null (sender_person_id),
  foreign key (tenant_id, communication_id) references public.communications (tenant_id, id) on delete set null (communication_id)
);
select app.setup_tenant_table('public.thread_messages', 'comms.send', 'comms.send');
create policy thread_messages_household_select on public.thread_messages for select to authenticated
  using (tenant_id = (select app.tenant_id()) and thread_id in (select id from public.message_threads where household_id = any ((select app.household_ids())::uuid[])));

-- Per-tenant overrides of the system templates that live in code (packages/comms).
create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  key text not null,
  channel text not null check (channel in ('email', 'sms', 'push', 'inapp')),
  subject text,
  body text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key, channel)
);
select app.setup_tenant_table('public.message_templates', 'automations.manage', 'comms.send');

-- Record an outbound communication on behalf of the signed-in user. The caller must belong to the tenant
-- (JWT) and the recipient person/household must belong to it too; everything else is data the server
-- already rendered and (maybe) sent.
create or replace function public.record_communication(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
  pid uuid := nullif(p ->> 'person_id', '')::uuid;
  hid uuid := nullif(p ->> 'household_id', '')::uuid;
  cid uuid;
begin
  if tid is null or auth.uid() is null then
    raise exception 'not signed in to a tenant' using errcode = '42501';
  end if;
  -- Staff may record anything; Home users only the system messages their own actions trigger.
  if not (app.has_permission('comms.send') or app.has_permission('attendance.write') or app.has_permission('schedule.manage')
          or coalesce(p ->> 'template_key', '') in ('waitlist_promoted', 'booking_confirmed', 'booking_cancelled', 'thread_message')) then
    raise exception 'not allowed to send this message' using errcode = '42501';
  end if;
  if pid is not null and not exists (select 1 from public.people where id = pid and tenant_id = tid) then
    raise exception 'recipient not in tenant' using errcode = '42501';
  end if;
  if hid is not null and not exists (select 1 from public.households where id = hid and tenant_id = tid) then
    raise exception 'household not in tenant' using errcode = '42501';
  end if;
  insert into public.communications (
    tenant_id, channel, direction, person_id, household_id, to_address, template_key, subject, body_text, body_html,
    status, provider, provider_message_id, error, scheduled_for, thread_id, related_type, related_id, created_by, sent_at)
  values (
    tid, p ->> 'channel', 'out', pid, hid, p ->> 'to_address', p ->> 'template_key', p ->> 'subject',
    coalesce(p ->> 'body_text', ''), p ->> 'body_html', p ->> 'status', p ->> 'provider', p ->> 'provider_message_id',
    p ->> 'error', nullif(p ->> 'scheduled_for', '')::timestamptz, nullif(p ->> 'thread_id', '')::uuid,
    p ->> 'related_type', nullif(p ->> 'related_id', '')::uuid, auth.uid(),
    case when p ->> 'status' = 'sent' then now() else null end)
  returning id into cid;
  return cid;
end;
$$;
revoke execute on function public.record_communication(jsonb) from public, anon;
grant execute on function public.record_communication(jsonb) to authenticated;

-- Contact details + consent for recipients of a system message (e.g. a class cancellation): guardians of
-- the given people (or the people themselves when adults with contact info). Readable by any tenant
-- member with attendance.write or comms.send, so instructors can notify a roster.
create or replace function public.message_recipients(p_person_ids uuid[])
returns table (person_id uuid, recipient_person_id uuid, household_id uuid, first_name text, last_name text, email text, phone text, email_consent boolean, sms_consent boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with targets as (
    select unnest(p_person_ids) as person_id
  ),
  via_household as (
    select t.person_id, g.id as recipient_person_id, hm.household_id
    from targets t
    join public.household_members hm on hm.person_id = t.person_id
    join public.household_members gm on gm.household_id = hm.household_id and gm.relationship = 'guardian'
    join public.people g on g.id = gm.person_id
    where g.tenant_id = app.tenant_id()
  ),
  self as (
    select t.person_id, t.person_id as recipient_person_id,
           (select hm.household_id from public.household_members hm where hm.person_id = t.person_id limit 1) as household_id
    from targets t
    where not exists (select 1 from via_household v where v.person_id = t.person_id)
  )
  select r.person_id, r.recipient_person_id, r.household_id, p.first_name, p.last_name, p.email::text, p.phone, p.email_consent, p.phone_sms_consent
  from (select * from via_household union select * from self) r
  join public.people p on p.id = r.recipient_person_id
  where p.tenant_id = app.tenant_id()
    and (app.has_permission('attendance.write') or app.has_permission('comms.send'));
$$;
revoke execute on function public.message_recipients(uuid[]) from public, anon;
grant execute on function public.message_recipients(uuid[]) to authenticated;

select app.index_foreign_keys();
