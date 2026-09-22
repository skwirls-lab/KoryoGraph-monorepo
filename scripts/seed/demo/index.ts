import { sid } from "../../lib/ids";
import type { SeedContext } from "../context";
import { seedCurriculum } from "./curriculum";
import { seedExtras, seedStaff } from "./extras";
import { seedPeople } from "./people";
import { Rng } from "./rng";
import { seedTraining } from "./training";

/**
 * `demo` profile (Appendix C, M1 scope): Ridgeline Taekwondo as a real, busy school. Deterministic for a
 * given day (ids from keys, seeded PRNG + faker). Bulk-loaded with user triggers disabled — seed data is
 * not user activity (no audit rows) — then derived columns are recomputed explicitly.
 */
export async function seedDemo(ctx: SeedContext): Promise<void> {
  const rng = new Rng("koryograph");
  const now = new Date();
  const { sql } = ctx;
  const tables = (await sql<{ tablename: string }[]>`select tablename from pg_tables where schemaname = 'public'`).map((t) => t.tablename);
  await seedStaff(ctx);
  for (const t of tables) await sql`alter table ${sql(t)} disable trigger user`;
  try {
    const programs = await seedCurriculum(ctx, rng);
    ctx.log(`curriculum: ${programs.length} programs, ${programs.reduce((n, p) => n + p.ranks.length, 0)} ranks`);
    const people = await seedPeople(ctx, rng, now);
    ctx.log(`people: ${people.students.length} students, ${people.householdIds.length} households, ${people.guardianIds.length} guardians`);
    const training = await seedTraining(ctx, rng, now, programs, people.students);
    ctx.log(`schedule: ${training.sessions} sessions, ${training.attendance} check-ins, ${training.promotions} promotions`);
    await seedExtras(ctx, rng, now, people);
    ctx.log("documents, PINs, conversations, outbox, certifications");
  } finally {
    for (const t of tables) await sql`alter table ${sql(t)} enable trigger user`;
  }
  // Derived state the disabled triggers would have maintained.
  await sql`
    update public.enrollments e set classes_since_promotion = (
      select count(*) from public.attendance a join public.class_sessions s on s.id = a.session_id
      where a.person_id = e.person_id and e.program_id = any (s.program_ids) and s.starts_at >= coalesce(e.last_promoted_at, e.started_at::timestamptz))
    where e.tenant_id = ${sid("tenant:ridgeline")}`;
  await sql`update public.tenants set onboarding = jsonb_set(onboarding, '{steps}', '{"location": true, "programs": true, "schedule": true, "students": true, "payments": false, "staff": true, "branding": true}'::jsonb) where slug = 'ridgeline'`;
}
