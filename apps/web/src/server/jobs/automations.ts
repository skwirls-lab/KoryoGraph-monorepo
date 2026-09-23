import type { Json } from "@koryo/db/types";
import { rpc } from "@koryo/db";
import { actionSchema, conditionSchema, renderTitle, type AutomationAction, type Condition } from "@/lib/automations";
import { todayIn } from "@/lib/people";
import type { Job, JobStats } from "./types";

interface LogEntry { at: string; step: number; action: string; result: string }

/**
 * Automations (F10.5): per tenant with Grow, (1) evaluate scheduled triggers (absence, birthday, expiring
 * memberships, contract ends) into runs — deduplicated so each fires once per streak/date — then (2) run
 * every due run: check conditions against the person, execute actions in order, pause on `wait`, log each
 * step. Event-triggered runs are created by database triggers (membership, lead stage, test invite,
 * failed payment, promotion). Messages go through the Outbox (consent and quiet hours apply there).
 */
export const automations: Job = async ({ db, now, tenantId, log }) => {
  const nowIso = now.toISOString();
  let tq = db.from("tenant_entitlements").select("tenant_id, tenants(id, timezone, name)").eq("module_key", "grow").lte("starts_at", nowIso).or(`ends_at.is.null,ends_at.gt.${nowIso}`);
  if (tenantId) tq = tq.eq("tenant_id", tenantId);
  const { data: ents, error } = await tq;
  if (error) throw new Error(`entitlements: ${error.message}`);
  const stats: JobStats = { evaluated: 0, runs: 0, done: 0, skipped: 0, waiting: 0, failed: 0, messages: 0, tasks: 0 };
  const bump = (k: string, n = 1) => (stats[k] = Number(stats[k] ?? 0) + n);

  for (const e of ents ?? []) {
    const t = e.tenants;
    if (!t) continue;
    bump("evaluated", (await rpc(db, "automation_evaluate", { p_tenant_id: t.id, p_today: todayIn(t.timezone, now) })) as number);

    const { data: due } = await db.from("automation_runs")
      .select("id, automation_id, person_id, context, step, status, log, automations(id, name, conditions, actions, active)")
      .eq("tenant_id", t.id).or(`status.eq.pending,and(status.eq.waiting,resume_at.lte.${nowIso})`).order("created_at").limit(500);
    for (const run of due ?? []) {
      bump("runs");
      const a = run.automations;
      const entries = [...((run.log ?? []) as unknown as LogEntry[])];
      const finish = async (status: "done" | "skipped" | "failed", patch: Record<string, unknown> = {}) => {
        await db.from("automation_runs").update({ status, log: entries as unknown as Json, ...patch }).eq("id", run.id);
        bump(status);
        if (status === "done" && a) {
          const { data: cur } = await db.from("automations").select("runs").eq("id", a.id).single();
          await db.from("automations").update({ runs: (cur?.runs ?? 0) + 1, last_run_at: nowIso }).eq("id", a.id);
        }
      };
      if (!a || !a.active) {
        entries.push({ at: nowIso, step: run.step, action: "—", result: "automation turned off" });
        await finish("skipped");
        continue;
      }
      const person = run.person_id
        ? (await db.from("people").select("id, first_name, last_name, preferred_name, status, tags, email_consent, phone_sms_consent, enrollments(program_id, status)").eq("id", run.person_id).maybeSingle()).data
        : null;
      if (!person) {
        entries.push({ at: nowIso, step: run.step, action: "—", result: "no person" });
        await finish("skipped");
        continue;
      }
      if (run.step === 0) {
        const failed = ((a.conditions ?? []) as unknown[]).map((c) => conditionSchema.safeParse(c)).filter((c) => c.success).map((c) => c.data as Condition)
          .find((c) => !conditionHolds(c, person));
        if (failed) {
          entries.push({ at: nowIso, step: 0, action: "conditions", result: `not met: ${failed.field}` });
          await finish("skipped");
          continue;
        }
      }
      const ctxData = (run.context ?? {}) as Record<string, string | number | null>;
      const data = { ...ctxData, student_name: `${person.preferred_name || person.first_name} ${person.last_name}`.trim(), school_name: t.name };
      const actions = ((a.actions ?? []) as unknown[]).map((x) => actionSchema.safeParse(x)).filter((x) => x.success).map((x) => x.data as AutomationAction);
      let step = run.step;
      let paused = false;
      try {
        for (; step < actions.length; step++) {
          const act = actions[step] as AutomationAction;
          if (act.type === "wait") {
            entries.push({ at: nowIso, step, action: "wait", result: `${act.days} day${act.days === 1 ? "" : "s"}` });
            await db.from("automation_runs").update({ status: "waiting", step: step + 1, resume_at: new Date(now.getTime() + act.days * 86_400_000).toISOString(), log: entries as unknown as Json }).eq("id", run.id);
            bump("waiting");
            paused = true;
            break;
          }
          if (act.type === "send") {
            if (act.only_if === "registration_pending") {
              const { data: reg } = await db.from("testing_registrations").select("status").eq("id", String(ctxData.registration_id ?? "")).maybeSingle();
              if (reg?.status !== "invited") {
                entries.push({ at: nowIso, step, action: `send ${act.template_key}`, result: "skipped: already registered" });
                continue;
              }
            }
            const n = (await rpc(db, "automation_notify", { p_tenant_id: t.id, p_template_key: act.template_key, p_person_ids: [person.id], p_data: data as unknown as Json, p_run_id: run.id, p_channels: act.channels })) as number;
            bump("messages", n);
            entries.push({ at: nowIso, step, action: `send ${act.template_key}`, result: `${n} recipient${n === 1 ? "" : "s"} queued (${act.channels.join("/")})` });
          } else if (act.type === "create_task" || act.type === "notify_staff") {
            const title = renderTitle(act.title, data);
            const dueDays = act.type === "create_task" ? act.due_days : 0;
            await db.from("tasks").insert({ tenant_id: t.id, person_id: person.id, lead_id: typeof ctxData.lead_id === "string" ? ctxData.lead_id : null, title, source: "automation", related_type: "automation_run", related_id: run.id, due_at: new Date(now.getTime() + dueDays * 86_400_000).toISOString() });
            bump("tasks");
            entries.push({ at: nowIso, step, action: act.type, result: title });
          } else if (act.type === "add_tag") {
            if (!person.tags.includes(act.tag)) await db.from("people").update({ tags: [...person.tags, act.tag] }).eq("id", person.id);
            entries.push({ at: nowIso, step, action: "add_tag", result: act.tag });
          }
        }
        if (!paused) await finish("done", { step });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        entries.push({ at: nowIso, step, action: "error", result: message });
        log.error({ tenant_id: t.id, run: run.id, err: message }, "automation step failed");
        await finish("failed", { step });
      }
    }
  }
  return stats;
};

function conditionHolds(c: Condition, p: { status: string; tags: string[]; email_consent: boolean; phone_sms_consent: boolean; enrollments: { program_id: string; status: string }[] }): boolean {
  switch (c.field) {
    case "status":
      return c.value.includes(p.status);
    case "program":
      return p.enrollments.some((e) => e.status === "active" && c.value.includes(e.program_id));
    case "tag":
      return c.op === "has" ? p.tags.includes(c.value) : !p.tags.includes(c.value);
    case "consent":
      return c.value === "email" ? p.email_consent : p.phone_sms_consent;
  }
}
