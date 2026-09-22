-- 0012 Curriculum defaults for new tenants (M1.04) and ladder reordering.

-- Reorder a program's ladder: positions follow the array order (deferrable unique makes swaps legal).
create or replace function public.reorder_ranks(p_program_id uuid, p_rank_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n int;
begin
  select count(*) into n from public.ranks where program_id = p_program_id;
  if n <> coalesce(array_length(p_rank_ids, 1), 0)
     or exists (select 1 from unnest(p_rank_ids) r where r not in (select id from public.ranks where program_id = p_program_id)) then
    raise exception 'rank list does not match the program ladder' using errcode = '22023';
  end if;
  update public.ranks r set position = o.pos
  from unnest(p_rank_ids) with ordinality as o(id, pos)
  where r.id = o.id and r.program_id = p_program_id;
end;
$$;
revoke execute on function public.reorder_ranks(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_ranks(uuid, uuid[]) to authenticated;

-- Standard Taekwondo ladder (10 gup → 1st dan) with 8 sample skills, applied to every new tenant.
create or replace function app.seed_default_curriculum(tid uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  prog uuid;
  r record;
  rank_ids uuid[] := '{}';
  rid uuid;
  sk record;
  skill_ids jsonb := '{}'::jsonb;
  s_id uuid;
begin
  if exists (select 1 from public.programs where tenant_id = tid) then
    return null;
  end if;
  insert into public.programs (tenant_id, name, slug, description, age_min, color, sort)
  values (tid, 'Taekwondo', 'taekwondo', 'Traditional Taekwondo: kicks, forms (poomsae), one-steps, self-defense and sparring.', 7, '#e11d48', 10)
  returning id into prog;

  for r in
    select * from (values
      (1, 'White belt (10th gup)', '#f5f5f5', 0, 0, false),
      (2, 'Yellow belt (9th gup)', '#facc15', 16, 60, false),
      (3, 'Orange belt (8th gup)', '#f97316', 18, 60, false),
      (4, 'Green belt (7th gup)', '#16a34a', 20, 75, false),
      (5, 'Purple belt (6th gup)', '#7c3aed', 22, 75, false),
      (6, 'Blue belt (5th gup)', '#2563eb', 24, 90, false),
      (7, 'Brown belt (4th gup)', '#92400e', 28, 90, false),
      (8, 'Red belt (3rd gup)', '#dc2626', 30, 105, false),
      (9, 'Red belt, black stripe (2nd gup)', '#b91c1c', 34, 105, false),
      (10, 'Black tip (1st gup)', '#450a0a', 40, 120, true),
      (11, 'Black belt (1st dan)', '#111111', 60, 180, true)
    ) as v(pos, name, color, min_classes, min_days, approval)
  loop
    insert into public.ranks (tenant_id, program_id, name, belt_color, position, stripes_max, testing_fee_cents)
    values (tid, prog, r.name, r.color, r.pos, case when r.pos < 11 then 3 else 0 end, case when r.pos = 1 then 0 when r.pos = 11 then 15000 else 4500 end)
    returning id into rid;
    rank_ids := rank_ids || rid;
    if r.pos > 1 then
      insert into public.rank_requirements (tenant_id, rank_id, min_classes, min_days, requires_instructor_approval)
      values (tid, rid, r.min_classes, r.min_days, r.approval);
    end if;
  end loop;

  for sk in
    select * from (values
      ('front-kick', 'kick', 'Front kick (ap chagi)', 'Chamber, snap from the knee, strike with the ball of the foot, re-chamber.', 10),
      ('roundhouse', 'kick', 'Roundhouse kick (dollyo chagi)', 'Pivot the support foot, turn the hip over, strike with the instep.', 20),
      ('side-kick', 'kick', 'Side kick (yop chagi)', 'Chamber sideways, drive the heel out in a straight line.', 30),
      ('taegeuk-1', 'form', 'Taegeuk Il Jang', 'First poomsae: walking stance, low block, middle punch.', 40),
      ('taegeuk-2', 'form', 'Taegeuk Ee Jang', 'Second poomsae: front stance, high block, front kicks.', 50),
      ('one-step-1', 'one_step', 'One-step sparring #1', 'Step back into back stance, block, counter with reverse punch.', 60),
      ('wrist-escape', 'self_defense', 'Same-side wrist grab escape', 'Rotate toward the thumb and pull out, then create distance.', 70),
      ('counting', 'terminology', 'Counting 1–10 in Korean', 'Hana, dul, set, net, daseot, yeoseot, ilgop, yeodeol, ahop, yeol.', 80)
    ) as v(key, category, name, description, sort)
  loop
    insert into public.skills (tenant_id, program_id, category, name, description, sort, rubric)
    values (tid, prog, sk.category, sk.name, sk.description, sk.sort,
      '[{"criterion": "Technique", "weight": 0.5}, {"criterion": "Power & focus", "weight": 0.3}, {"criterion": "Balance", "weight": 0.2}]'::jsonb)
    returning id into s_id;
    skill_ids := skill_ids || jsonb_build_object(sk.key, s_id);
  end loop;

  -- Yellow: front kick, Taegeuk 1, counting. Orange: roundhouse, Taegeuk 2, one-step 1. Green: side kick, wrist escape.
  insert into public.rank_skills (tenant_id, rank_id, skill_id)
  select tid, rank_ids[m.pos], (skill_ids ->> m.key)::uuid
  from (values (2, 'front-kick'), (2, 'taegeuk-1'), (2, 'counting'), (3, 'roundhouse'), (3, 'taegeuk-2'), (3, 'one-step-1'),
               (4, 'side-kick'), (4, 'wrist-escape')) as m(pos, key);
  return prog;
end;
$$;

create or replace function app.seed_tenant_defaults(tid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.seed_default_curriculum(tid);
end;
$$;
