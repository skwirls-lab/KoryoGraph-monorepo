-- 0060 Public site (M5.01): module prices for the pricing page (the spec's suggested prices — placeholders
-- for the business to set; the page reads them from here) and the platform contact inbox.

alter table public.modules
  add column monthly_cents int not null default 0 check (monthly_cents >= 0),
  add column annual_cents int not null default 0 check (annual_cents >= 0),
  add column price_note text not null default '';
update public.modules m set monthly_cents = v.m, annual_cents = v.m * 10, price_note = v.note
from (values
  ('core', 7900, ''), ('billing', 4000, ''), ('retail', 3000, ''), ('grow', 4000, ''), ('programs_plus', 3000, ''), ('home', 3000, ''),
  ('intelligence', 4900, 'plus metered AI usage'), ('vision', 2900, 'plus metered AI usage'), ('multi_location', 4900, 'per additional location')
) as v(key, m, note)
where m.key = v.key;

-- Messages from /contact, read by platform admins.
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  school text check (school is null or length(school) <= 160),
  topic text not null default 'general' check (topic in ('general', 'demo', 'pricing', 'support', 'privacy')),
  message text not null check (length(trim(message)) between 10 and 5000),
  status text not null default 'new' check (status in ('new', 'replied', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
create trigger set_updated_at before update on public.contact_messages for each row execute function app.set_updated_at();
create policy contact_messages_admin_select on public.contact_messages for select to authenticated using ((select app.is_platform_admin()));
create policy contact_messages_admin_update on public.contact_messages for update to authenticated using ((select app.is_platform_admin())) with check ((select app.is_platform_admin()));

-- p = { name, email, school, topic, message, website (honeypot) }. Anyone may write; at most 5 an hour per email.
create or replace function public.submit_contact(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  em text := lower(nullif(trim(p ->> 'email'), ''));
begin
  if coalesce(p ->> 'website', '') <> '' then
    return jsonb_build_object('ok', true); -- honeypot: bots get a quiet success
  end if;
  if length(trim(coalesce(p ->> 'name', ''))) < 1 then
    raise exception 'tell us your name' using errcode = '22023';
  end if;
  if em is null or em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'that email address doesn''t look right' using errcode = '22023';
  end if;
  if length(trim(coalesce(p ->> 'message', ''))) < 10 then
    raise exception 'write a little more so we can help' using errcode = '22023';
  end if;
  if (select count(*) from public.contact_messages where email = em and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'we''ve had several messages from you in the last hour — we''ll be in touch' using errcode = '22023';
  end if;
  insert into public.contact_messages (name, email, school, topic, message)
  values (left(trim(p ->> 'name'), 120), em, nullif(left(trim(coalesce(p ->> 'school', '')), 160), ''),
          case when p ->> 'topic' in ('general', 'demo', 'pricing', 'support', 'privacy') then p ->> 'topic' else 'general' end,
          left(trim(p ->> 'message'), 5000));
  return jsonb_build_object('ok', true);
end;
$$;
revoke execute on function public.submit_contact(jsonb) from public;
grant execute on function public.submit_contact(jsonb) to anon, authenticated;
