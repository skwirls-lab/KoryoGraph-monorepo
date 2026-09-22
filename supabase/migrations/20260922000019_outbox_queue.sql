-- 0019 System messages queued in the database (cross-household events such as a waitlist promotion
-- triggered by another family's cancellation). Rows are inserted with status 'queued' and merge `data`;
-- the outbox_dispatch job (service role) renders them with the code templates, applies consent and quiet
-- hours, and sends or marks them 'unsent_no_provider'.

alter table public.communications add column data jsonb not null default '{}'::jsonb;
create index communications_queued on public.communications (created_at) where status = 'queued';

-- Guardians (or the adult themself) of the given people, without a permission gate (internal).
create or replace function app.recipients_for(p_tenant_id uuid, p_person_ids uuid[])
returns table (person_id uuid, recipient_person_id uuid, household_id uuid, first_name text, last_name text, email text, phone text, email_consent boolean, sms_consent boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with targets as (select unnest(p_person_ids) as person_id),
  via_household as (
    select t.person_id, g.id as recipient_person_id, hm.household_id
    from targets t
    join public.household_members hm on hm.person_id = t.person_id
    join public.household_members gm on gm.household_id = hm.household_id and gm.relationship = 'guardian'
    join public.people g on g.id = gm.person_id
    where g.tenant_id = p_tenant_id
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
  where p.tenant_id = p_tenant_id;
$$;
revoke execute on function app.recipients_for(uuid, uuid[]) from public, anon, authenticated;

create or replace function public.message_recipients(p_person_ids uuid[])
returns table (person_id uuid, recipient_person_id uuid, household_id uuid, first_name text, last_name text, email text, phone text, email_consent boolean, sms_consent boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select * from app.recipients_for(app.tenant_id(), p_person_ids)
  where app.has_permission('attendance.write') or app.has_permission('comms.send');
$$;

-- Queue a system message for the guardians of `p_person_ids` on every channel they have an address for
-- (plus in-app). Rendering, consent and quiet hours happen in outbox_dispatch.
create or replace function app.enqueue_system_message(p_tenant_id uuid, p_template_key text, p_person_ids uuid[], p_data jsonb, p_related_type text, p_related_id uuid)
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
    insert into public.communications (tenant_id, channel, person_id, household_id, to_address, template_key, status, data, related_type, related_id, created_by)
    select p_tenant_id, c.channel, r.recipient_person_id, r.household_id, c.addr, p_template_key, 'queued',
           p_data || jsonb_build_object('first_name', r.first_name, 'about_person_id', r.person_id), p_related_type, p_related_id, auth.uid()
    from (values ('email', r.email), ('sms', r.phone), ('inapp', null::text)) as c(channel, addr)
    where c.channel = 'inapp' or c.addr is not null;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function app.enqueue_system_message(uuid, text, uuid[], jsonb, text, uuid) from public, anon, authenticated;

-- cancel_booking now queues the waitlist-promotion notice for the promoted student's family.
create or replace function public.cancel_booking(p_booking_id uuid)
returns table (credit_id uuid, promoted_person_id uuid, promoted_booking_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
  b public.bookings;
  s public.class_sessions;
  staff boolean := app.has_permission('attendance.write');
  rules jsonb;
  credit uuid;
  nxt public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id and tenant_id = tid;
  if not found or not app.can_book_for(b.person_id) then
    raise exception 'booking not found' using errcode = '42501';
  end if;
  select * into s from public.class_sessions where id = b.session_id for update;
  if b.status not in ('booked', 'waitlisted') then
    raise exception 'this booking is already %', b.status using errcode = '22023';
  end if;
  if not staff and s.starts_at - make_interval(mins => s.cancellation_window_min) < now() then
    raise exception 'too late to cancel online — please contact the school' using errcode = '22023';
  end if;

  update public.bookings set status = 'cancelled', cancelled_at = now(), waitlist_position = null where id = b.id;

  select coalesce(settings -> 'makeups', '{}'::jsonb) into rules from public.tenants where id = tid;
  if b.status = 'booked' and coalesce((rules ->> 'enabled')::boolean, true)
     and s.starts_at - make_interval(mins => s.cancellation_window_min) >= now() then
    insert into public.makeup_credits (tenant_id, person_id, earned_from_session_id, reason, expires_at)
    values (tid, b.person_id, s.id, 'cancelled in time', now() + make_interval(days => coalesce((rules ->> 'expires_days')::int, 60)))
    returning id into credit;
  end if;
  if b.credit_id is not null then
    update public.makeup_credits set used_booking_id = null where id = b.credit_id;
  end if;

  if b.status = 'booked' then
    select * into nxt from public.bookings where session_id = s.id and status = 'waitlisted' order by waitlist_position limit 1 for update;
    if found then
      update public.bookings set status = 'booked', waitlist_position = null where id = nxt.id;
      update public.bookings set waitlist_position = waitlist_position - 1 where session_id = s.id and status = 'waitlisted';
      perform app.enqueue_system_message(tid, 'waitlist_promoted', array[nxt.person_id],
        jsonb_build_object('class_name', s.name, 'class_starts_at', s.starts_at,
          'student_name', (select coalesce(p.preferred_name, p.first_name) from public.people p where p.id = nxt.person_id)),
        'class_session', s.id);
    end if;
  elsif b.status = 'waitlisted' then
    update public.bookings set waitlist_position = waitlist_position - 1
    where session_id = s.id and status = 'waitlisted' and waitlist_position > b.waitlist_position;
  end if;

  return query select credit, nxt.person_id, nxt.id;
end;
$$;
