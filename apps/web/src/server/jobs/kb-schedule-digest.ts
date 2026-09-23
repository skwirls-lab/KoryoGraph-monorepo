import { aiForJob } from "./ai";
import { indexDocument } from "../kb";
import type { Job, JobStats } from "./types";

const DAYS: Record<string, string> = { MO: "Monday", TU: "Tuesday", WE: "Wednesday", TH: "Thursday", FR: "Friday", SA: "Saturday", SU: "Sunday" };

/** Nightly: rewrite each Intelligence school's schedule digest (weekly classes by day) in the knowledge base. */
export const kbScheduleDigest: Job = async ({ db, now, tenantId, log }) => {
  const nowIso = now.toISOString();
  let tq = db.from("tenant_entitlements").select("tenant_id, tenants(name)").eq("module_key", "intelligence").lte("starts_at", nowIso).or(`ends_at.is.null,ends_at.gt.${nowIso}`);
  if (tenantId) tq = tq.eq("tenant_id", tenantId);
  const { data: ents, error } = await tq;
  if (error) throw new Error(`entitlements: ${error.message}`);
  const ai = aiForJob(db);
  const stats: JobStats = { tenants: 0, chunks: 0, not_embedded: 0 };
  const today = nowIso.slice(0, 10);
  for (const e of ents ?? []) {
    const [{ data: templates }, { data: programs }] = await Promise.all([
      db.from("class_templates").select("name, rrule, start_time, duration_min, room, program_ids, rank_min_position, rank_max_position, age_min, age_max, bookable")
        .eq("tenant_id", e.tenant_id).eq("active", true).or(`until_date.is.null,until_date.gte.${today}`).order("start_time"),
      db.from("programs").select("id, name").eq("tenant_id", e.tenant_id),
    ]);
    const progName = new Map((programs ?? []).map((p) => [p.id, p.name]));
    const byDay = new Map<string, string[]>();
    for (const t of templates ?? []) {
      const days = /BYDAY=([A-Z,]+)/.exec(t.rrule)?.[1]?.split(",") ?? [];
      const who = [t.program_ids.map((p) => progName.get(p)).filter(Boolean).join(", "), t.age_min || t.age_max ? `ages ${t.age_min ?? "any"}–${t.age_max ?? "adult"}` : ""].filter(Boolean).join("; ");
      for (const d of days) byDay.set(d, [...(byDay.get(d) ?? []), `${t.start_time.slice(0, 5)} ${t.name} (${t.duration_min} min${t.room ? `, ${t.room}` : ""}${who ? `; ${who}` : ""}${t.bookable ? "; book in the app" : ""})`]);
    }
    const body = [`Weekly class schedule for ${e.tenants?.name ?? "the school"}, generated ${today} from the live timetable. Holidays and one-off changes are in the app's schedule.`,
      ...Object.keys(DAYS).filter((d) => byDay.has(d)).map((d) => `${DAYS[d]}:\n${(byDay.get(d) ?? []).map((l) => `- ${l}`).join("\n")}`)].join("\n\n");
    const { data: existing } = await db.from("kb_documents").select("id").eq("tenant_id", e.tenant_id).eq("kind", "schedule_digest").eq("source", "auto").maybeSingle();
    const { data: doc, error: docErr } = existing
      ? await db.from("kb_documents").update({ body, title: "Class schedule" }).eq("id", existing.id).select("id, tenant_id, title, body").single()
      : await db.from("kb_documents").insert({ tenant_id: e.tenant_id, kind: "schedule_digest", source: "auto", title: "Class schedule", body, audience: "everyone" }).select("id, tenant_id, title, body").single();
    if (docErr || !doc) throw new Error(`kb_documents: ${docErr?.message}`);
    const r = await indexDocument(db, ai, doc, null);
    stats.tenants = Number(stats.tenants) + 1;
    stats.chunks = Number(stats.chunks) + r.chunks;
    if (!r.embedded) stats.not_embedded = Number(stats.not_embedded) + 1;
    log.info({ tenant: e.tenant_id, chunks: r.chunks, embedded: r.embedded }, "schedule digest");
  }
  return stats;
};
