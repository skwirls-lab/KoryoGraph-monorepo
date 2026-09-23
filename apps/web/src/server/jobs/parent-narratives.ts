import { addDaysStr } from "@koryo/billing";
import { AiError, parentNarrative } from "@koryo/ai";
import { todayIn } from "@/lib/people";
import { aiForJob } from "./ai";
import type { Job, JobStats } from "./types";

/** Fill the narrative's placeholders with the week's real facts. */
export function fillNarrative(body: string, f: { student: string; classes: number; skills: string[]; promotion: string | null }): string {
  const skills = f.skills.length > 2 ? `${f.skills.slice(0, -1).join(", ")} and ${f.skills.at(-1)}` : f.skills.join(" and ");
  return body.replaceAll("{{student}}", f.student).replaceAll("{{classes}}", String(f.classes)).replaceAll("{{skills}}", skills || "their current skills").replaceAll("{{promotion}}", f.promotion ?? "");
}

/**
 * Weekly (A9): for each minor who trained, got a sign-off or was promoted in the last 7 days, draft a short
 * update for their family. Drafts wait in Approvals (batch approve); nothing reaches Home until approved.
 */
export const parentNarratives: Job = async ({ db, now, tenantId, log }) => {
  const nowIso = now.toISOString();
  let tq = db.from("tenant_entitlements").select("tenant_id, tenants(name, timezone)").eq("module_key", "intelligence").lte("starts_at", nowIso).or(`ends_at.is.null,ends_at.gt.${nowIso}`);
  if (tenantId) tq = tq.eq("tenant_id", tenantId);
  const { data: ents, error } = await tq;
  if (error) throw new Error(`entitlements: ${error.message}`);
  const ai = aiForJob(db);
  const stats: JobStats = { tenants: 0, drafted: 0, skipped_existing: 0, unavailable: 0 };
  for (const e of ents ?? []) {
    const t = e.tenants;
    if (!t) continue;
    stats.tenants = Number(stats.tenants) + 1;
    const today = todayIn(t.timezone, now);
    const weekOf = addDaysStr(today, -6);
    const since = new Date(now.getTime() - 7 * 86_400_000).toISOString();
    const [{ data: att }, { data: signoffs }, { data: promos }, { data: notes }] = await Promise.all([
      db.from("attendance").select("person_id").eq("tenant_id", e.tenant_id).gte("checked_in_at", since).limit(10000),
      db.from("skill_signoffs").select("enrollments(person_id), skills(name)").eq("tenant_id", e.tenant_id).gte("signed_off_at", since).limit(2000),
      db.from("promotions").select("enrollments(person_id), ranks!promotions_tenant_id_to_rank_id_fkey(name)").eq("tenant_id", e.tenant_id).gte("promoted_at", since).limit(500),
      db.from("notes").select("person_id, body").eq("tenant_id", e.tenant_id).eq("kind", "progress").gte("created_at", since).limit(2000),
    ]);
    const facts = new Map<string, { classes: number; skills: string[]; promotion: string | null; notes: string[] }>();
    const f = (id: string) => facts.get(id) ?? facts.set(id, { classes: 0, skills: [], promotion: null, notes: [] }).get(id)!;
    for (const a of att ?? []) f(a.person_id).classes += 1;
    for (const s of (signoffs ?? []) as { enrollments: { person_id: string } | null; skills: { name: string } | null }[]) if (s.enrollments && s.skills) f(s.enrollments.person_id).skills.push(s.skills.name);
    for (const p of (promos ?? []) as { enrollments: { person_id: string } | null; ranks: { name: string } | null }[]) if (p.enrollments) f(p.enrollments.person_id).promotion = p.ranks?.name ?? "a new rank";
    for (const n of notes ?? []) if (facts.has(n.person_id)) f(n.person_id).notes.push(n.body.slice(0, 300));
    if (!facts.size) continue;
    const ids = [...facts.keys()];
    const [{ data: people }, { data: existing }] = await Promise.all([
      db.from("people").select("id, first_name, preferred_name, dob, status").in("id", ids).eq("status", "active"),
      db.from("approval_items").select("person_id").eq("tenant_id", e.tenant_id).eq("kind", "parent_narrative").gte("created_at", since),
    ]);
    const done = new Set((existing ?? []).map((x) => x.person_id));
    for (const p of people ?? []) {
      if (!p.dob || Date.parse(p.dob) < Date.parse(today) - 18 * 365.25 * 86_400_000) continue; // families of minors
      if (done.has(p.id)) { stats.skipped_existing = Number(stats.skipped_existing) + 1; continue; }
      const x = facts.get(p.id);
      if (!x) continue;
      const student = p.preferred_name || p.first_name;
      try {
        const r = await ai.runTask(parentNarrative, { school: t.name, student, classes: x.classes, skills: x.skills.slice(0, 12), promotion: x.promotion, instructorNotes: x.notes.slice(0, 5) }, { tenantId: e.tenant_id });
        const body = fillNarrative(r.output.body, { student, classes: x.classes, skills: x.skills, promotion: x.promotion });
        await db.from("approval_items").insert({
          tenant_id: e.tenant_id, kind: "parent_narrative", title: `This week for ${student}`, person_id: p.id, ai_run_id: r.runId,
          preview: `${x.classes} class${x.classes === 1 ? "" : "es"}${x.skills.length ? ` · ${x.skills.length} skill${x.skills.length === 1 ? "" : "s"}` : ""}${x.promotion ? ` · promoted to ${x.promotion}` : ""}${r.fixture ? " · dev fixture" : ""}`,
          payload: { person_id: p.id, week_of: weekOf, body }, expires_at: new Date(now.getTime() + 10 * 86_400_000).toISOString(),
        });
        stats.drafted = Number(stats.drafted) + 1;
      } catch (err) {
        if (!(err instanceof AiError)) throw err;
        stats.unavailable = Number(stats.unavailable) + 1;
      }
    }
    log.info({ tenant: e.tenant_id, drafted: stats.drafted }, "parent narratives");
  }
  return stats;
};
