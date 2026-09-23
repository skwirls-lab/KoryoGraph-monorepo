-- 0042 Automations & broadcasts (§4.9, F10.5, F10.6).
-- Domain events are emitted by triggers into automation_runs (pending); the `automations` job evaluates
-- scheduled triggers (absence, birthday, expiring memberships, contract ends), checks conditions and runs
-- actions step by step (send template, wait N days, create task, add tag, notify staff) with a run log.
-- Broadcasts send to a segment; only recipients with consent and an address are queued.

create table public.automations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  template_key text,
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  trigger jsonb not null,
  conditions jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  active boolean not null default false,
  runs int not null default 0,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, template_key)
);
select app.setup_tenant_table('public.automations', 'automations.manage', 'comms.send', 'grow');

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  automation_id uuid not null,
  person_id uuid,
  context jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  status text not null default 'pending' check (status in ('pending', 'waiting', 'done', 'skipped', 'failed')),
  step int not null default 0,
  resume_at timestamptz,
  log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (automation_id, dedupe_key),
  foreign key (tenant_id, automation_id) references public.automations (tenant_id, id) on delete cascade,
  foreign key (tenant_id, person_id) references public.people (tenant_id, id) on delete cascade
);
select app.setup_tenant_table('public.automation_runs', null, 'comms.send', 'grow');
create index automation_runs_due on public.automation_runs (status, resume_at) where status in ('pending', 'waiting');

create table public.segments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  definition jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.setup_tenant_table('public.segments', 'comms.send', 'comms.send', 'grow');

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  channel text not null check (channel in ('email', 'sms')),
  segment jsonb not null default '{}'::jsonb,
  subject text,
  body text not null,
  scheduled_at timestamptz,
  sent_at timestamptz,
  stats jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.setup_tenant_table('public.campaigns', 'comms.send', 'comms.send', 'grow');

alter table public.communications
  add constraint communications_campaign_fk foreign key (tenant_id, campaign_id) references public.campaigns (tenant_id, id) on delete set null (campaign_id),
  add constraint communications_automation_run_fk foreign key (tenant_id, automation_run_id) references public.automation_runs (tenant_id, id) on delete set null (automation_run_id);

-- ---------------------------------------------------------------------------------------------
-- Emitting events
-- ---------------------------------------------------------------------------------------------
create or replace function app.automation_emit(p_tenant uuid, p_event text, p_person uuid, p_context jsonb, p_dedupe text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  insert into public.automation_runs (tenant_id, automation_id, person_id, context, dedupe_key)
  select a.tenant_id, a.id, p_person, p_context || jsonb_build_object('event', p_event), p_dedupe
  from public.automations a
  where a.tenant_id = p_tenant and a.active and a.trigger ->> 'kind' = p_event
    and (a.trigger -> 'params' ->> 'stage' is null or a.trigger -> 'params' ->> 'stage' = p_context ->> 'stage')
  on conflict (automation_id, dedupe_key) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function app.emit_membership_created() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform app.automation_emit(new.tenant_id, 'membership.created', new.person_id, jsonb_build_object('membership_id', new.id), 'membership:' || new.id);
  return null;
end; $$;
create trigger emit_membership_created after insert on public.memberships for each row execute function app.emit_membership_created();

create or replace function app.emit_lead_stage() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  k text;
begin
  if new.stage_id is distinct from old.stage_id then
    select key into k from public.pipeline_stages where id = new.stage_id;
    perform app.automation_emit(new.tenant_id, 'lead.stage_changed', new.person_id, jsonb_build_object('lead_id', new.id, 'stage', k), 'lead:' || new.id || ':' || coalesce(k, new.stage_id::text));
  end if;
  return null;
end; $$;
create trigger emit_lead_stage after update of stage_id on public.leads for each row execute function app.emit_lead_stage();

create or replace function app.emit_testing_invited() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'invited' then
    perform app.automation_emit(new.tenant_id, 'testing.invited', new.person_id, jsonb_build_object('registration_id', new.id, 'testing_event_id', new.testing_event_id), 'testing:' || new.id);
  end if;
  return null;
end; $$;
create trigger emit_testing_invited after insert on public.testing_registrations for each row execute function app.emit_testing_invited();

create or replace function app.emit_payment_failed() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.dunning_state ? 'failed_on' and not coalesce(old.dunning_state ? 'failed_on', false) then
    perform app.automation_emit(new.tenant_id, 'payment.failed', coalesce(new.person_id, (select primary_payer_person_id from public.households where id = new.household_id)),
      jsonb_build_object('invoice_id', new.id, 'invoice_number', new.number), 'invoice:' || new.id);
  end if;
  return null;
end; $$;
create trigger emit_payment_failed after update of dunning_state on public.invoices for each row execute function app.emit_payment_failed();

create or replace function app.emit_promotion() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  pid uuid;
begin
  select person_id into pid from public.enrollments where id = new.enrollment_id;
  perform app.automation_emit(new.tenant_id, 'promotion.created', pid, jsonb_build_object('promotion_id', new.id), 'promotion:' || new.id);
  return null;
end; $$;
create trigger emit_promotion after insert on public.promotions for each row execute function app.emit_promotion();

-- ---------------------------------------------------------------------------------------------
-- Queueing messages (automations: service role; broadcasts: send_broadcast below)
-- ---------------------------------------------------------------------------------------------
create or replace function public.automation_notify(p_tenant_id uuid, p_template_key text, p_person_ids uuid[], p_data jsonb, p_run_id uuid, p_channels text[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  n int := 0;
begin
  for r in select * from app.recipients_for(p_tenant_id, p_person_ids) loop
    insert into public.communications (tenant_id, channel, person_id, household_id, to_address, template_key, status, data, related_type, related_id, automation_run_id)
    select p_tenant_id, c.channel, r.recipient_person_id, r.household_id, c.addr, p_template_key, 'queued',
           p_data || jsonb_build_object('first_name', r.first_name, 'about_person_id', r.person_id), 'automation_run', p_run_id, p_run_id
    from (values ('email', r.email), ('sms', r.phone)) as c(channel, addr)
    where c.channel = any (p_channels) and c.addr is not null;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.automation_notify(uuid, text, uuid[], jsonb, uuid, text[]) from public, anon, authenticated;
grant execute on function public.automation_notify(uuid, text, uuid[], jsonb, uuid, text[]) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Segments: { program_ids[], statuses[], tags[], age_min, age_max }
-- ---------------------------------------------------------------------------------------------
create or replace function app.segment_people(p_tenant uuid, d jsonb)
returns table (person_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.people p
  where p.tenant_id = p_tenant and p.archived_at is null and 'student' = any (p.type_flags)
    and (coalesce(jsonb_array_length(d -> 'statuses'), 0) = 0 or p.status = any (array(select jsonb_array_elements_text(d -> 'statuses'))))
    and (coalesce(jsonb_array_length(d -> 'program_ids'), 0) = 0 or exists (
          select 1 from public.enrollments e where e.person_id = p.id and e.status = 'active'
            and e.program_id = any (array(select jsonb_array_elements_text(d -> 'program_ids'))::uuid[])))
    and (coalesce(jsonb_array_length(d -> 'tags'), 0) = 0 or p.tags && array(select jsonb_array_elements_text(d -> 'tags')))
    and (nullif(d ->> 'age_min', '') is null or (p.dob is not null and extract(year from age(p.dob)) >= (d ->> 'age_min')::int))
    and (nullif(d ->> 'age_max', '') is null or (p.dob is not null and extract(year from age(p.dob)) <= (d ->> 'age_max')::int));
$$;

-- Recipients for a channel: guardians (or the adult themself), deduplicated, with consent and an address.
create or replace function app.segment_recipients(p_tenant uuid, d jsonb, p_channel text)
returns table (recipient_person_id uuid, household_id uuid, first_name text, address text, consent boolean, about_person_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (r.recipient_person_id) r.recipient_person_id, r.household_id, r.first_name,
         case when p_channel = 'email' then r.email else r.phone end,
         case when p_channel = 'email' then r.email_consent else r.sms_consent end,
         r.person_id
  from app.recipients_for(p_tenant, array(select person_id from app.segment_people(p_tenant, d))) r
  order by r.recipient_person_id, r.person_id;
$$;

create or replace function public.segment_preview(p_definition jsonb, p_channel text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
begin
  if tid is null or not app.has_module('grow') or not app.has_permission('comms.send') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'people', (select count(*) from app.segment_people(tid, p_definition)),
    'recipients', (select count(*) from app.segment_recipients(tid, p_definition, p_channel) where consent and address is not null),
    'no_consent', (select count(*) from app.segment_recipients(tid, p_definition, p_channel) where not consent and address is not null),
    'no_address', (select count(*) from app.segment_recipients(tid, p_definition, p_channel) where address is null));
end;
$$;

-- Send a saved campaign now: one message per consented recipient (merge field {{first_name}}).
create or replace function public.send_broadcast(p_campaign_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
  c public.campaigns;
  n int;
begin
  if tid is null or not app.has_module('grow') or not app.has_permission('comms.send') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into c from public.campaigns where id = p_campaign_id and tenant_id = tid for update;
  if not found then
    raise exception 'broadcast not found' using errcode = 'P0002';
  end if;
  if c.sent_at is not null then
    raise exception 'this broadcast was already sent' using errcode = '22023';
  end if;
  insert into public.communications (tenant_id, channel, person_id, household_id, to_address, status, subject, body_text, data, related_type, related_id, campaign_id, created_by)
  select tid, c.channel, r.recipient_person_id, r.household_id, r.address, 'queued',
         replace(coalesce(c.subject, ''), '{{first_name}}', r.first_name), replace(c.body, '{{first_name}}', r.first_name),
         jsonb_build_object('about_person_id', r.about_person_id, 'first_name', r.first_name), 'campaign', c.id, c.id, auth.uid()
  from app.segment_recipients(tid, c.segment, c.channel) r
  where r.consent and r.address is not null;
  get diagnostics n = row_count;
  update public.campaigns set sent_at = now(), stats = jsonb_build_object('queued', n,
    'no_consent', (select count(*) from app.segment_recipients(tid, c.segment, c.channel) where not consent and address is not null)) where id = c.id;
  return n;
end;
$$;
revoke execute on function public.segment_preview(jsonb, text), public.send_broadcast(uuid) from public, anon;
grant execute on function public.segment_preview(jsonb, text), public.send_broadcast(uuid) to authenticated;
revoke execute on function app.segment_people(uuid, jsonb), app.segment_recipients(uuid, jsonb, text), app.automation_emit(uuid, text, uuid, jsonb, text) from public;

-- ---------------------------------------------------------------------------------------------
-- Seeded automations (inactive until a school turns them on)
-- ---------------------------------------------------------------------------------------------
create or replace function app.ensure_automations(p_tenant uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.automations (tenant_id, template_key, name, description, trigger, conditions, actions)
  select p_tenant, k, n, d, t::jsonb, c::jsonb, a::jsonb from (values
    ('welcome', 'Welcome sequence', 'New member: welcome now, check in after a week, and a call task for staff.',
      '{"kind":"membership.created"}', '[]',
      '[{"type":"send","template_key":"welcome","channels":["email"]},{"type":"create_task","title":"Welcome call: {{student_name}}","due_days":2},{"type":"wait","days":7},{"type":"send","template_key":"welcome_checkin","channels":["email"]}]'),
    ('absent_7', 'Absent 7 days', 'A friendly "we miss you" after a week away.',
      '{"kind":"absence","params":{"days":7}}', '[{"field":"status","op":"in","value":["active"]}]',
      '[{"type":"send","template_key":"absent_7","channels":["email"]}]'),
    ('absent_14', 'Absent 14 days', 'Two weeks away: message the family and ask an instructor to call.',
      '{"kind":"absence","params":{"days":14}}', '[{"field":"status","op":"in","value":["active"]}]',
      '[{"type":"send","template_key":"absent_14","channels":["email","sms"]},{"type":"notify_staff","title":"Call {{student_name}} — absent 2 weeks"}]'),
    ('absent_30', 'Absent 30 days', 'A month away: tag as at risk and alert staff.',
      '{"kind":"absence","params":{"days":30}}', '[{"field":"status","op":"in","value":["active"]}]',
      '[{"type":"send","template_key":"absent_30","channels":["email"]},{"type":"add_tag","tag":"at-risk"},{"type":"notify_staff","title":"{{student_name}} has been away a month"}]'),
    ('failed_payment', 'Failed payment follow-up', 'Dunning emails go out automatically; this asks staff to follow up personally.',
      '{"kind":"payment.failed"}', '[]',
      '[{"type":"notify_staff","title":"Failed payment: {{student_name}} (invoice #{{invoice_number}})"}]'),
    ('trial_followup', 'Trial follow-up', 'The day after a trial class: a thank-you with next steps and a call task.',
      '{"kind":"lead.stage_changed","params":{"stage":"trial_attended"}}', '[]',
      '[{"type":"wait","days":1},{"type":"send","template_key":"trial_followup","channels":["email","sms"]},{"type":"create_task","title":"Follow up with {{student_name}} after their trial","due_days":1}]'),
    ('test_reminder', 'Test invitation reminder', 'Three days after a belt-test invitation, remind families who haven''t registered.',
      '{"kind":"testing.invited"}', '[]',
      '[{"type":"wait","days":3},{"type":"send","template_key":"test_invitation_reminder","channels":["email"],"only_if":"registration_pending"}]'),
    ('birthday', 'Birthday', 'Happy birthday on the day.',
      '{"kind":"birthday"}', '[{"field":"status","op":"in","value":["active","trial"]}]',
      '[{"type":"send","template_key":"birthday","channels":["email"]}]'),
    ('membership_expiring', 'Membership expiring', 'Two weeks before a paid-in-full, pack or trial membership ends.',
      '{"kind":"membership_expiring","params":{"days":14}}', '[]',
      '[{"type":"send","template_key":"membership_expiring","channels":["email"]},{"type":"create_task","title":"Renewal conversation: {{student_name}}","due_days":3}]'),
    ('review_request', 'Review request', 'Two days after a promotion, ask happy families for a review.',
      '{"kind":"promotion.created"}', '[]',
      '[{"type":"wait","days":2},{"type":"send","template_key":"review_request","channels":["email"]}]')
  ) as s(k, n, d, t, c, a)
  on conflict (tenant_id, template_key) do nothing;
$$;
select app.ensure_automations(id) from public.tenants;
create or replace function app.tenant_automations() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform app.ensure_automations(new.id);
  return null;
end; $$;
create trigger tenant_automations after insert on public.tenants for each row execute function app.tenant_automations();

insert into public.jobs (name, schedule, description) values
  ('automations', '*/5 * * * *', 'Evaluate scheduled automation triggers and run due automation steps')
on conflict (name) do update set schedule = excluded.schedule, description = excluded.description;

select app.index_foreign_keys();
