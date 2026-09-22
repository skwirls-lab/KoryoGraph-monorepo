-- 0021 Two-way messaging (F10.3): households write to the school from Home; staff with comms.send reply.
-- Counters/last_message_at are maintained by trigger; read state via mark_thread_read().

-- Home users open threads for their own household and post as themselves.
create policy message_threads_household_insert on public.message_threads for insert to authenticated
  with check (tenant_id = (select app.tenant_id()) and household_id = any ((select app.household_ids())::uuid[]));

create policy thread_messages_household_insert on public.thread_messages for insert to authenticated
  with check (
    tenant_id = (select app.tenant_id())
    and from_staff = false
    and sender_user_id = (select auth.uid())
    and (sender_person_id is null or sender_person_id = (select app.person_id()))
    and thread_id in (select id from public.message_threads where household_id = any ((select app.household_ids())::uuid[]))
  );

-- Staff messages must be marked as staff and attributed to the sender.
drop policy thread_messages_tenant_insert on public.thread_messages;
create policy thread_messages_tenant_insert on public.thread_messages for insert to authenticated
  with check (tenant_id = (select app.tenant_id()) and (select app.has_permission('comms.send')) and from_staff = true and sender_user_id = (select auth.uid()));

create or replace function app.thread_message_posted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.message_threads
     set last_message_at = new.created_at,
         unread_staff = case when new.from_staff then unread_staff else unread_staff + 1 end,
         unread_household = case when new.from_staff then unread_household + 1 else unread_household end,
         status = 'open'
   where id = new.thread_id;
  return null;
end;
$$;
create trigger thread_message_posted after insert on public.thread_messages
  for each row execute function app.thread_message_posted();

-- Clear the caller's side of the unread counter (staff vs household decided by who is asking).
create or replace function public.mark_thread_read(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.message_threads;
begin
  select * into t from public.message_threads where id = p_thread_id and tenant_id = app.tenant_id();
  if not found then
    raise exception 'thread not found' using errcode = '42501';
  end if;
  if app.has_permission('comms.send') then
    update public.message_threads set unread_staff = 0 where id = t.id;
  elsif t.household_id = any (app.household_ids()) then
    update public.message_threads set unread_household = 0 where id = t.id;
  else
    raise exception 'thread not found' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.mark_thread_read(uuid) from public, anon;
grant execute on function public.mark_thread_read(uuid) to authenticated;

-- Map inbound SMS to a tenant: settings.sms_number (E.164) identifies the school's Twilio number.
create index tenants_sms_number on public.tenants ((settings ->> 'sms_number'));
