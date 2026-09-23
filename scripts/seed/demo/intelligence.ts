// Demo seed, intelligence pass (M4.12). Everything here goes through the product's own code paths — the
// scheduled jobs, the intake drafter, the approval executor — as the service role (jobs) or as the signed-in
// demo users (uploads and approvals, under RLS), with the AI layer pinned to the recorded fixtures so the demo is
// deterministic and never makes a paid call. The results are labelled "dev fixture" wherever they appear.
//
// Runs in a child process with the react-server condition (the jobs are server-only modules), spawned by
// seedDemo: npx tsx --conditions=react-server scripts/seed/demo/intelligence.ts
// Idempotent: each step checks whether its data already exists.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pino from "pino";
import type { Database } from "@koryo/db/types";
import { decideOne } from "@/server/approvals/decide";
import { draftIntake } from "@/server/intake";
import { aiForJob } from "@/server/jobs/ai";
import { JOBS } from "@/server/jobs/registry";
import { DEMO_CLASS } from "../../../tests/fixtures/demo-class";
import { loadEnv, repoRoot, requireEnv } from "../../lib/env";
import { sid } from "../../lib/ids";
import { DEMO_PASSWORD } from "../context";

loadEnv();
process.env.AI_TRANSPORT = "fixture";

type Db = SupabaseClient<Database>;
const T = sid("tenant:ridgeline");
const MAYA = sid("person:ridgeline:maya-cooper");
const LEO = sid("person:ridgeline:leo-cooper");
const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const db: Db = createClient<Database>(url, requireEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
const log = pino({ level: "warn" });
const say = (m: string) => console.log(`[seed] ${m}`);
const fixture = (...p: string[]) => readFileSync(join(repoRoot, "tests/fixtures", ...p));

async function signedIn(email: string): Promise<{ client: Db; userId: string }> {
  const client = createClient<Database>(url, requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error || !data.user) throw new Error(`sign in ${email}: ${error?.message}`);
  return { client, userId: data.user.id };
}

/** The first skill a student still needs for their next rank (what they'd ask for feedback on). */
async function nextSkill(personId: string): Promise<string | null> {
  const [e] = await must(db.from("v_enrollment_progress").select("enrollment_id, next_rank_id").eq("person_id", personId).eq("status", "active").not("next_rank_id", "is", null).limit(1), "progress");
  if (!e?.next_rank_id) return null;
  const req = await must(db.from("rank_skills").select("skill_id, skills(sort, name)").eq("rank_id", e.next_rank_id), "rank skills");
  const signed = new Set((await must(db.from("skill_signoffs").select("skill_id").eq("enrollment_id", e.enrollment_id ?? ""), "signoffs")).map((x) => x.skill_id));
  const open = req.filter((r) => !signed.has(r.skill_id)).sort((a, b) => (a.skills?.sort ?? 0) - (b.skills?.sort ?? 0) || (a.skills?.name ?? "").localeCompare(b.skills?.name ?? ""));
  return (open[0] ?? req[0])?.skill_id ?? null;
}

async function job(name: string): Promise<void> {
  const run = JOBS[name];
  if (!run) throw new Error(`no job ${name}`);
  const stats = await run({ db, now: new Date(), tenantId: T, log, params: {} });
  say(`${name}: ${JSON.stringify(stats)}`);
}

/** Await a Supabase call; throw on error (the seed must not half-succeed). Writes without a select resolve to null. */
async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data as T;
}

// Budget: the school's monthly AI budget (usage is whatever the runs below actually cost — $0 for fixtures).
await must(db.from("tenant_ai_budgets").upsert({ tenant_id: T, monthly_limit_cents: 5000 }, { onConflict: "tenant_id" }), "budget");

// Nightly / weekly agents over the seeded school.
for (const name of ["kb_schedule_digest", "drift_score", "lead_scoring", "schedule_suggestions", "parent_narratives"]) await job(name);

// A recorded class (§6 step 13): the most recent Youth Taekwondo — Advanced session. The families of the minors
// on its roster who hadn't given AI-processing consent handed in paper forms.
{
  const [session] = await must(db.from("class_sessions").select("id").eq("tenant_id", T).eq("name", DEMO_CLASS.className).neq("status", "cancelled")
    .lt("starts_at", new Date().toISOString()).order("starts_at", { ascending: false }).limit(1), "demo session");
  if (!session) throw new Error("no demo class session");
  const existing = await must(db.from("class_recordings").select("id").eq("session_id", session.id).limit(1), "recordings");
  if (!existing.length) {
    const owner = sid("user:owner@ridgelinetkd.demo");
    const roster = await must(db.from("v_class_roster").select("person_id, dob").eq("session_id", session.id), "roster");
    const minors = roster.filter((r) => r.person_id && r.dob && Date.parse(r.dob) > Date.now() - 18 * 365.25 * 86_400_000).map((r) => r.person_id as string);
    const consents = await must(db.from("consents").select("person_id, granted, granted_at").eq("kind", "ai_processing").in("person_id", minors).order("granted_at", { ascending: false }), "consents");
    const latest = new Map<string, boolean>();
    for (const c of consents) if (!latest.has(c.person_id)) latest.set(c.person_id, c.granted);
    const gaps = minors.filter((m) => !latest.get(m));
    for (const person of gaps) {
      await must(db.from("consents").upsert({ id: sid(`consent:paper-ai:${person}`), tenant_id: T, person_id: person, kind: "ai_processing", granted: true, method: "paper", recorded_by: owner }, { onConflict: "id" }), "paper consent");
    }
    const { client, userId } = await signedIn("instructor@ridgelinetkd.demo");
    const wav = fixture("audio", "demo-class.wav");
    const path = `${T}/recordings/${session.id}/demo-class.wav`;
    await client.storage.from("tenant-media").remove([path]);
    await must(client.storage.from("tenant-media").upload(path, wav, { contentType: "audio/wav" }), "upload recording");
    await must(client.from("class_recordings").insert({ tenant_id: T, session_id: session.id, source: "audio", storage_path: path, mime: "audio/wav", size_bytes: wav.length, created_by: userId }), "recording");
    say(`recording: ${gaps.length} paper consents on file, uploaded as the instructor`);
    await job("transcribe");
  }
}

// A packing slip, uploaded by the owner and read into a receiving draft (doc intake).
{
  const existing = await must(db.from("approval_items").select("id").eq("tenant_id", T).eq("kind", "doc_intake").limit(1), "intake");
  if (!existing.length) {
    const { client, userId } = await signedIn("owner@ridgelinetkd.demo");
    const r = await draftIntake(client, aiForJob(db), { tenantId: T, userId, bytes: fixture("docs", "century-packing-slip.png"), mime: "image/png", fileName: "century-packing-slip.png" });
    if ("error" in r) throw new Error(`intake: ${r.error}`);
    say("doc intake: packing slip read into a draft");
  }
}

// Technique feedback: practice clips from the Cooper family; the instructor has released Maya's, Leo's waits.
{
  const existing = await must(db.from("technique_submissions").select("id").in("person_id", [MAYA, LEO]).limit(1), "technique");
  if (!existing.length) {
    const { client } = await signedIn("parent@ridgelinetkd.demo");
    const clip = fixture("video", "clip-6s.mp4");
    for (const [person, key] of [[MAYA, "maya"], [LEO, "leo"]] as const) {
      // A skill the student is working toward (their next rank's first requirement).
      const skillId = await nextSkill(person);
      if (!skillId) throw new Error(`no next skill for ${key}`);
      const path = `${T}/technique/${person}/demo-${key}.mp4`;
      await client.storage.from("tenant-media").remove([path]);
      await must(client.storage.from("tenant-media").upload(path, clip, { contentType: "video/mp4" }), "upload clip");
      await must(client.rpc("submit_technique", { p_person_id: person, p_skill_id: skillId, p_video_path: path, p_duration_ms: 6000, p_note: key === "maya" ? "Is my chamber high enough?" : undefined }), "submit");
    }
    await job("technique_feedback");
    const [item] = await must(db.from("approval_items").select("id").eq("tenant_id", T).eq("kind", "vision_feedback").eq("person_id", MAYA).eq("status", "pending").limit(1), "vision item");
    const instructor = await signedIn("instructor@ridgelinetkd.demo");
    const r = await decideOne({ supabase: instructor.client, tenantId: T }, { id: item?.id ?? "", decision: "approved" });
    if (!r.ok || !r.data.result?.ok) throw new Error(`release: ${r.ok ? JSON.stringify(r.data.result) : r.error}`);
    say("technique: Maya's feedback released by the instructor, Leo's waiting for review");
  }
}

// This week's family updates: the owner approved the Cooper kids' (they show on Home); the rest wait.
{
  const drafts = await must(db.from("approval_items").select("id").eq("tenant_id", T).eq("kind", "parent_narrative").eq("status", "pending").in("person_id", [MAYA, LEO]), "narratives");
  if (drafts.length) {
    const { client } = await signedIn("owner@ridgelinetkd.demo");
    for (const d of drafts) {
      const r = await decideOne({ supabase: client, tenantId: T }, { id: d.id, decision: "approved" });
      if (!r.ok || !r.data.result?.ok) throw new Error(`narrative: ${r.ok ? JSON.stringify(r.data.result) : r.error}`);
    }
    say(`narratives: ${drafts.length} approved and published to the Cooper family's Home`);
  }
}
