import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { linkDemoPlanPrograms } from "../billing";
import { recomputeMoney, seedMoney } from "./money";
import { repoRoot } from "../../lib/env";
import { sid } from "../../lib/ids";
import type { SeedContext } from "../context";
import { seedCurriculum } from "./curriculum";
import { seedGrow } from "./grow";
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
  let people: Awaited<ReturnType<typeof seedPeople>> | undefined;
  for (const t of tables) await sql`alter table ${sql(t)} disable trigger user`;
  try {
    const programs = await seedCurriculum(ctx, rng);
    ctx.log(`curriculum: ${programs.length} programs, ${programs.reduce((n, p) => n + p.ranks.length, 0)} ranks`);
    people = await seedPeople(ctx, rng, now);
    ctx.log(`people: ${people.students.length} students, ${people.householdIds.length} households, ${people.guardianIds.length} guardians`);
    const training = await seedTraining(ctx, rng, now, programs, people.students);
    ctx.log(`schedule: ${training.sessions} sessions, ${training.attendance} check-ins, ${training.promotions} promotions`);
    // The Drift Detector story (§6 step 12): Riley hurt a knee sparring about four weeks ago and hasn't been
    // back since — after two months of already coming less often (the "decaying" profile).
    const riley = sid("person:ridgeline:riley-adams");
    await sql`delete from public.attendance where person_id = ${riley} and checked_in_at > ${new Date(now.getTime() - 26 * 86_400_000)}`;
    await sql`insert into public.notes (id, tenant_id, person_id, kind, body, source, by_user_id, created_at)
      values (${sid("note:riley-adams:knee")}, ${sid("tenant:ridgeline")}, ${riley}, 'injury', 'Sore left knee after sparring; sat out the last drills. Check in with the family before the next class.', 'manual',
              ${sid("user:instructor@ridgelinetkd.demo")}, ${new Date(now.getTime() - 27 * 86_400_000)}) on conflict (id) do nothing`;
    await seedExtras(ctx, rng, now, people);
    ctx.log("documents, PINs, conversations, outbox, certifications");
    const money = await seedMoney(ctx, rng, now, people);
    ctx.log(`money: ${money.memberships} memberships, ${money.invoices} invoices, ${money.payments} payments (${money.failed} failed, ${money.inDunning} in dunning), ${money.posSales} POS sales, ${money.skus} SKUs`);
  } finally {
    for (const t of tables) await sql`alter table ${sql(t)} enable trigger user`;
  }
  // Derived state the disabled triggers would have maintained.
  await sql`
    update public.enrollments e set classes_since_promotion = (
      select count(*) from public.attendance a join public.class_sessions s on s.id = a.session_id
      where a.person_id = e.person_id and e.program_id = any (s.program_ids) and s.starts_at >= coalesce(e.last_promoted_at, e.started_at::timestamptz))
    where e.tenant_id = ${sid("tenant:ridgeline")}`;
  await linkDemoPlanPrograms(ctx);
  // M3 data (pipeline, testing, events, after-school, staff ops, automations, broadcasts) reads the derived
  // training state above, so it loads in a second trigger-free pass.
  for (const t of tables) await sql`alter table ${sql(t)} disable trigger user`;
  try {
    const grow = await seedGrow(ctx, rng, now, people);
    ctx.log(`grow: ${grow.leads} leads, ${grow.events} events (${grow.eventRegistrations} registrations), after-school ${grow.afterschoolKids} kids / ${grow.afterschoolDays} days, ${grow.automationRuns} automation runs, ${grow.broadcastMessages} broadcast messages`);
  } finally {
    for (const t of tables) await sql`alter table ${sql(t)} enable trigger user`;
  }
  await recomputeMoney(ctx);
  await sql`update public.tenants set onboarding = jsonb_set(onboarding, '{steps}', '{"location": true, "programs": true, "schedule": true, "students": true, "payments": false, "staff": true, "branding": true}'::jsonb) where slug = 'ridgeline'`;
  // M4 data (risk scores, approvals of each kind, a recorded class, technique feedback, family updates) comes
  // from the product's own jobs and actions, run as the demo users — in a child process, since those are
  // server-only modules (react-server condition).
  const r = spawnSync("npx", ["tsx", "--conditions=react-server", join(repoRoot, "scripts/seed/demo/intelligence.ts")], { cwd: repoRoot, stdio: "inherit", env: process.env });
  if (r.status !== 0) throw new Error(`demo seed intelligence pass failed (exit ${r.status})`);
}
