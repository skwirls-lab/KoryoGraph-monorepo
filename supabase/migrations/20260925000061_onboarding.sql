-- 0061 Onboarding (M5.02): staff invitations, "Go live" (trial → chosen plan) and school branding files.

-- Invitations are tenant_users rows with status 'invited' (created by the server with the service role, which
-- also creates or finds the auth user and sends the invite email). The invitee accepts after signing in.
create or replace function public.my_invitations()
returns table (tenant_user_id uuid, tenant_id uuid, tenant_name text, role_name text, invited_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select tu.id, t.id, t.name, r.name, tu.created_at
  from public.tenant_users tu join public.tenants t on t.id = tu.tenant_id join public.roles r on r.id = tu.role_id
  where tu.user_id = auth.uid() and tu.status = 'invited' and t.status <> 'suspended'
  order by tu.created_at;
$$;
grant execute on function public.my_invitations() to authenticated;

create or replace function public.accept_invitation(p_tenant_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid;
begin
  update public.tenant_users set status = 'active', accepted_at = now()
   where id = p_tenant_user_id and user_id = auth.uid() and status = 'invited'
  returning tenant_id into tid;
  if tid is null then
    raise exception 'that invitation is no longer open' using errcode = 'P0002';
  end if;
  update public.profiles set active_tenant_id = tid where id = auth.uid();
  return tid;
end;
$$;
revoke execute on function public.accept_invitation(uuid) from public, anon;
grant execute on function public.accept_invitation(uuid) to authenticated;

-- "Go live": the trial ends and the chosen plan's modules (or a custom set; core is always included) become
-- the school's entitlements. Platform billing for the subscription itself is not connected in this build.
create or replace function public.go_live(p_plan text, p_modules text[] default null, p_cycle text default 'monthly')
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid := app.tenant_id();
  mods text[];
begin
  if tid is null or not app.has_permission('settings.manage') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_cycle not in ('monthly', 'annual') then
    raise exception 'choose monthly or annual' using errcode = '22023';
  end if;
  if p_plan is not null then
    if not exists (select 1 from public.plans where key = p_plan and public) then
      raise exception 'unknown plan' using errcode = '22023';
    end if;
    select array_agg(module_key order by module_key) into mods from public.plan_modules where plan_key = p_plan;
  else
    select array_agg(key order by key) into mods from public.modules where required or key = any (coalesce(p_modules, '{}'));
  end if;
  insert into public.tenant_entitlements (tenant_id, module_key, source, starts_at, ends_at)
  select tid, m, case when p_plan is null then 'addon' else 'plan' end, now(), null from unnest(mods) as m
  on conflict (tenant_id, module_key) do update set source = excluded.source, starts_at = least(public.tenant_entitlements.starts_at, now()), ends_at = null;
  update public.tenant_entitlements set ends_at = now()
   where tenant_id = tid and not (module_key = any (mods)) and (ends_at is null or ends_at > now());
  update public.tenants set status = 'active', trial_ends_at = null,
         onboarding = jsonb_set(coalesce(onboarding, '{}'), '{live}', to_jsonb(now()))
   where id = tid;
  update public.tenant_subscriptions set plan_key = p_plan, status = 'active',
         current_period_end = now() + case when p_cycle = 'annual' then interval '1 year' else interval '1 month' end
   where tenant_id = tid;
  insert into public.audit_events (tenant_id, actor_user_id, action, entity_type, entity_id, after, note)
  values (tid, auth.uid(), 'custom', 'tenant', tid, jsonb_build_object('plan', p_plan, 'modules', to_jsonb(mods), 'cycle', p_cycle), 'go_live');
  return mods;
end;
$$;
revoke execute on function public.go_live(text, text[], text) from public, anon;
grant execute on function public.go_live(text, text[], text) to authenticated;

-- Logos: "<tenant>/branding/<file>", written by settings managers, readable by anyone in the school.
create policy tenant_media_branding_write on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-media' and (storage.foldername(name))[1] = (select app.tenant_id())::text
              and (storage.foldername(name))[2] = 'branding' and (select app.has_permission('settings.manage')));
create policy tenant_media_branding_read on storage.objects for select to authenticated
  using (bucket_id = 'tenant-media' and (storage.foldername(name))[1] = (select app.tenant_id())::text and (storage.foldername(name))[2] = 'branding');
