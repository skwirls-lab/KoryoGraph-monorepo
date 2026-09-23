-- 0063 Public API v1 + webhooks (M5.04). API keys are stored as SHA-256 hashes; each request is answered by a
-- security-definer function that resolves the key to its school and returns only that school's rows, through
-- explicit column lists (never whole rows). Rate limit: 120 requests per key per minute, counted here.

alter table public.api_keys add column request_count bigint not null default 0;

-- Per-key request counters, internal to the API functions (schema app is not exposed over the API).
create table app.api_rate (
  key_id uuid not null references public.api_keys (id) on delete cascade,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key_id, window_start)
);

-- Resolve a presented key → (tenant, scopes); counts the request against the rate limit.
create or replace function app.api_key_context(p_key text, p_scope text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  k public.api_keys;
  w timestamptz := date_trunc('minute', now());
  n int;
begin
  if p_key is null or p_key !~ '^kg_live_[A-Za-z0-9]{8}_[A-Za-z0-9]{32}$' then
    raise exception 'invalid api key' using errcode = '28000';
  end if;
  select * into k from public.api_keys where key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex') and revoked_at is null;
  if not found then
    raise exception 'invalid api key' using errcode = '28000';
  end if;
  if not (p_scope = any (k.scopes)) then
    raise exception 'this key lacks the % scope', p_scope using errcode = '42501';
  end if;
  insert into app.api_rate (key_id, window_start, count) values (k.id, w, 1)
  on conflict (key_id, window_start) do update set count = app.api_rate.count + 1
  returning count into n;
  if n > 120 then
    raise exception 'rate limit exceeded' using errcode = '54000';
  end if;
  update public.api_keys set last_used_at = now(), request_count = request_count + 1 where id = k.id;
  delete from app.api_rate where key_id = k.id and window_start < w - interval '5 minutes';
  return k.tenant_id;
end;
$$;

-- GET /api/v1/{resource}: keyset pagination on (created_at, id); p_cursor = '<created_at>|<id>'.
create or replace function public.api_list(p_key text, p_resource text, p_cursor text default null, p_limit int default 50, p_filters jsonb default '{}')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid;
  lim int := least(greatest(coalesce(p_limit, 50), 1), 200);
  c_at timestamptz;
  c_id uuid;
  rows jsonb;
  f jsonb := coalesce(p_filters, '{}');
begin
  if p_resource not in ('people', 'attendance', 'invoices', 'memberships') then
    raise exception 'unknown resource' using errcode = '22023';
  end if;
  tid := app.api_key_context(p_key, p_resource || ':read');
  if p_cursor is not null and p_cursor <> '' then
    begin
      c_at := split_part(p_cursor, '|', 1)::timestamptz;
      c_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then
      raise exception 'invalid cursor' using errcode = '22023';
    end;
  end if;

  if p_resource = 'people' then
    select coalesce(jsonb_agg(x order by x.created_at, x.id), '[]') into rows from (
      select p.id, p.first_name, p.last_name, p.preferred_name, p.email, p.phone, p.dob, p.status, p.type_flags, p.external_id, p.created_at, p.updated_at
      from public.people p
      where p.tenant_id = tid and p.archived_at is null
        and (f ->> 'status' is null or p.status = f ->> 'status')
        and (f ->> 'type' is null or (f ->> 'type') = any (p.type_flags))
        and (f ->> 'updated_since' is null or p.updated_at >= (f ->> 'updated_since')::timestamptz)
        and (c_at is null or (p.created_at, p.id) > (c_at, c_id))
      order by p.created_at, p.id limit lim) x;
  elsif p_resource = 'attendance' then
    select coalesce(jsonb_agg(x order by x.created_at, x.id), '[]') into rows from (
      select a.id, a.person_id, a.session_id, s.name as class_name, s.starts_at, a.checked_in_at, a.source, a.created_at
      from public.attendance a join public.class_sessions s on s.id = a.session_id
      where a.tenant_id = tid
        and (f ->> 'person_id' is null or a.person_id = (f ->> 'person_id')::uuid)
        and (f ->> 'since' is null or a.checked_in_at >= (f ->> 'since')::timestamptz)
        and (f ->> 'until' is null or a.checked_in_at < (f ->> 'until')::timestamptz)
        and (c_at is null or (a.created_at, a.id) > (c_at, c_id))
      order by a.created_at, a.id limit lim) x;
  elsif p_resource = 'invoices' then
    select coalesce(jsonb_agg(x order by x.created_at, x.id), '[]') into rows from (
      select i.id, i.number, i.household_id, i.person_id, i.status, i.total_cents, i.paid_cents, i.balance_cents, i.currency, i.due_at, i.issued_at, i.created_at
      from public.invoices i
      where i.tenant_id = tid
        and (f ->> 'status' is null or i.status = f ->> 'status')
        and (f ->> 'since' is null or i.created_at >= (f ->> 'since')::timestamptz)
        and (c_at is null or (i.created_at, i.id) > (c_at, c_id))
      order by i.created_at, i.id limit lim) x;
  else
    select coalesce(jsonb_agg(x order by x.created_at, x.id), '[]') into rows from (
      select m.id, m.person_id, m.household_id, m.plan_id, mp.name as plan_name, m.status, m.starts_at, m.ends_at, m.next_bill_at, m.created_at
      from public.memberships m join public.membership_plans mp on mp.id = m.plan_id
      where m.tenant_id = tid
        and (f ->> 'status' is null or m.status = f ->> 'status')
        and (f ->> 'person_id' is null or m.person_id = (f ->> 'person_id')::uuid)
        and (c_at is null or (m.created_at, m.id) > (c_at, c_id))
      order by m.created_at, m.id limit lim) x;
  end if;

  return jsonb_build_object(
    'data', rows,
    'next_cursor', case when jsonb_array_length(rows) = lim then (rows -> -1 ->> 'created_at') || '|' || (rows -> -1 ->> 'id') end);
end;
$$;
revoke execute on function public.api_list(text, text, text, int, jsonb) from public;
grant execute on function public.api_list(text, text, text, int, jsonb) to anon, authenticated;

-- Webhooks: events queued by triggers, delivered by the webhook_dispatch job (HMAC-signed, retried).
create or replace function app.enqueue_webhook(p_tenant uuid, p_event text, p_data jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.webhook_deliveries (tenant_id, endpoint_id, event, payload, next_attempt_at)
  select p_tenant, e.id, p_event,
         jsonb_build_object('id', gen_random_uuid(), 'type', p_event, 'created_at', now(), 'tenant_id', p_tenant, 'data', p_data), now()
  from public.webhook_endpoints e
  where e.tenant_id = p_tenant and e.active and p_event = any (e.events);
$$;

create or replace function app.webhook_people()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if 'student' = any (new.type_flags) and (tg_op = 'INSERT' or not ('student' = any (old.type_flags))) then
    perform app.enqueue_webhook(new.tenant_id, 'member.created',
      jsonb_build_object('id', new.id, 'first_name', new.first_name, 'last_name', new.last_name, 'email', new.email, 'status', new.status, 'external_id', new.external_id));
  end if;
  return new;
end;
$$;
create trigger webhook_people after insert or update of type_flags on public.people for each row execute function app.webhook_people();

create or replace function app.webhook_attendance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.enqueue_webhook(new.tenant_id, 'attendance.created',
    jsonb_build_object('id', new.id, 'person_id', new.person_id, 'session_id', new.session_id, 'checked_in_at', new.checked_in_at, 'source', new.source));
  return new;
end;
$$;
create trigger webhook_attendance after insert on public.attendance for each row execute function app.webhook_attendance();

create or replace function app.webhook_invoices()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    perform app.enqueue_webhook(new.tenant_id, 'invoice.paid',
      jsonb_build_object('id', new.id, 'number', new.number, 'household_id', new.household_id, 'total_cents', new.total_cents, 'currency', new.currency));
  end if;
  return new;
end;
$$;
create trigger webhook_invoices after update of status on public.invoices for each row execute function app.webhook_invoices();

create index webhook_deliveries_due on public.webhook_deliveries (next_attempt_at) where status = 'pending';

insert into public.jobs (name, schedule, description) values
  ('webhook_dispatch', '* * * * *', 'Deliver queued webhooks (HMAC-signed) with retries')
on conflict (name) do update set schedule = excluded.schedule, description = excluded.description;
