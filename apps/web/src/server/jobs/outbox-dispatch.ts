import { DEFAULT_QUIET_HOURS, SYSTEM_TEMPLATES, decide, render, textToHtml, type Channel, type QuietHours } from "@koryo/comms";
import { providersFromEnv } from "@koryo/comms/providers";
import type { TablesUpdate } from "@koryo/db/types";
import type { Job } from "./types";

function formatWhen(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

/**
 * Delivers queued system messages and deferred (quiet-hours) messages whose time has come: renders the
 * template (tenant override first), applies consent + quiet hours, sends via the configured provider or
 * records 'unsent_no_provider'. Runs every few minutes.
 */
export const outboxDispatch: Job = async ({ db, now, tenantId, log }) => {
  let q = db.from("communications").select("*").or(`status.eq.queued,and(status.eq.deferred,scheduled_for.lte.${now.toISOString()})`).order("created_at").limit(200);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data: rows, error } = await q;
  if (error) throw new Error(`outbox: ${error.message}`);
  const stats: Record<string, number> = { processed: 0 };
  let processed = 0;
  if (!rows?.length) return stats;

  const tenantIds = [...new Set(rows.map((r) => r.tenant_id))];
  const personIds = [...new Set(rows.map((r) => r.person_id).filter((x): x is string => Boolean(x)))];
  const [{ data: tenants }, { data: people }, { data: overrides }] = await Promise.all([
    db.from("tenants").select("id, name, timezone, settings").in("id", tenantIds),
    personIds.length ? db.from("people").select("id, email_consent, phone_sms_consent").in("id", personIds) : Promise.resolve({ data: [] }),
    db.from("message_templates").select("tenant_id, key, channel, subject, body").in("tenant_id", tenantIds).eq("active", true),
  ]);
  const tenantById = new Map((tenants ?? []).map((t) => [t.id, t]));
  const personById = new Map((people ?? []).map((p) => [p.id, p]));
  const providers = providersFromEnv(process.env);

  for (const row of rows) {
    const tenant = tenantById.get(row.tenant_id);
    const tz = tenant?.timezone ?? "UTC";
    const channel = row.channel as Channel;
    const tmpl = row.template_key ? SYSTEM_TEMPLATES[row.template_key] : undefined;
    const base = tmpl?.channels[channel];
    let subject = row.subject ?? "";
    let body = row.body_text;
    if (row.status === "queued") {
      if (!base) {
        await db.from("communications").update({ status: "failed", error: `No ${channel} template for ${row.template_key}` }).eq("id", row.id);
        stats.failed = (stats.failed ?? 0) + 1;
        continue;
      }
      const override = (overrides ?? []).find((o) => o.tenant_id === row.tenant_id && o.key === row.template_key && o.channel === channel);
      const data = (row.data ?? {}) as Record<string, string | number | null>;
      const merged = {
        school_name: tenant?.name ?? "Your school",
        ...data,
        class_time: typeof data.class_starts_at === "string" ? formatWhen(data.class_starts_at, tz) : (data.class_time ?? null),
        reason_suffix: data.reason ? ` (${data.reason})` : "",
      };
      subject = render(override?.subject ?? base.subject ?? "", merged).text;
      body = render(override?.body ?? base.body, merged).text;
    }
    const person = row.person_id ? personById.get(row.person_id) : undefined;
    const settings = (tenant?.settings ?? {}) as { quiet_hours?: QuietHours };
    const decision = decide({
      channel, address: row.to_address, consent: { email: person?.email_consent ?? false, sms: person?.phone_sms_consent ?? false },
      now, timeZone: tz, quietHours: settings.quiet_hours ?? DEFAULT_QUIET_HOURS,
    });
    const update: TablesUpdate<"communications"> = { subject: channel === "email" ? subject : null, body_text: body, body_html: channel === "email" ? textToHtml(body) : null };
    if (decision.action === "opted_out" || decision.action === "no_address") update.status = decision.action;
    else if (decision.action === "defer") Object.assign(update, { status: "deferred", scheduled_for: decision.until.toISOString() });
    else if (channel === "inapp") Object.assign(update, { status: "sent", provider: "inapp", sent_at: now.toISOString() });
    else {
      const p = channel === "email" ? providers.email : channel === "sms" ? providers.sms : null;
      if (!p) update.status = "unsent_no_provider";
      else {
        try {
          const res = channel === "email"
            ? await providers.email!.send({ to: row.to_address as string, subject, text: body, html: textToHtml(body) })
            : await providers.sms!.send({ to: row.to_address as string, body });
          Object.assign(update, { status: "sent", provider: p.name, provider_message_id: res.providerMessageId, sent_at: new Date().toISOString() });
        } catch (err) {
          Object.assign(update, { status: "failed", provider: p.name, error: err instanceof Error ? err.message : String(err) });
        }
      }
    }
    await db.from("communications").update(update).eq("id", row.id);
    processed++;
    stats.processed = processed;
    const s = String(update.status);
    stats[s] = (stats[s] ?? 0) + 1;
  }
  log.info(stats, "outbox_dispatch");
  return stats;
};
