import "server-only";
import { DEFAULT_QUIET_HOURS, SYSTEM_TEMPLATES, decide, render, textToHtml, type Channel, type QuietHours } from "@koryo/comms";
import { providersFromEnv } from "@koryo/comms/providers";
import type { Ctx } from "./context";
import { logger } from "./log";

export interface NotifyInput {
  /** People the message is about (students); guardians (or the adults themselves) receive it. */
  personIds: string[];
  templateKey: string;
  channels?: Channel[];
  /** Merge data shared by all recipients; first_name / student_name are filled per recipient. */
  data: Record<string, string | number | null | undefined>;
  related?: { type: string; id: string };
}

export interface NotifySummary {
  recipients: number;
  byStatus: Record<string, number>;
}

/**
 * Render and deliver a system message to the guardians of the given people, recording every attempt in
 * `communications` via record_communication (RLS/tenant checked in the database). No provider key →
 * 'unsent_no_provider' (Outbox, shown plainly in Desk). SMS during quiet hours → 'deferred'.
 */
export async function notify(ctx: Ctx, input: NotifyInput): Promise<NotifySummary> {
  const tmpl = SYSTEM_TEMPLATES[input.templateKey];
  if (!tmpl) throw new Error(`Unknown template ${input.templateKey}`);
  const log = logger(ctx);
  const summary: NotifySummary = { recipients: 0, byStatus: {} };
  if (input.personIds.length === 0) return summary;

  const [{ data: recipients, error }, { data: tenant }, { data: overrides }] = await Promise.all([
    ctx.supabase.rpc("message_recipients", { p_person_ids: input.personIds }),
    ctx.supabase.from("tenants").select("name, settings").eq("id", ctx.tenantId ?? "").maybeSingle(),
    ctx.supabase.from("message_templates").select("channel, subject, body").eq("key", input.templateKey).eq("active", true),
  ]);
  if (error) throw new Error(`message_recipients: ${error.message}`);
  const settings = (tenant?.settings ?? {}) as { quiet_hours?: QuietHours };
  const quiet = settings.quiet_hours ?? DEFAULT_QUIET_HOURS;
  const providers = providersFromEnv(process.env);
  const channels = input.channels ?? (["email", "sms"] as Channel[]).filter((c) => tmpl.channels[c]);
  const seen = new Set<string>();
  const now = new Date();

  const students = new Map<string, string>();
  if (input.personIds.length) {
    const { data: ppl } = await ctx.supabase.from("people").select("id, first_name, preferred_name").in("id", input.personIds);
    for (const p of ppl ?? []) students.set(p.id, p.preferred_name || p.first_name);
  }

  const bump = (s: string) => (summary.byStatus[s] = (summary.byStatus[s] ?? 0) + 1);

  for (const r of recipients ?? []) {
    for (const channel of channels) {
      const key = `${r.recipient_person_id}:${channel}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const base = tmpl.channels[channel];
      if (!base) continue;
      const override = (overrides ?? []).find((o) => o.channel === channel);
      const data = {
        school_name: tenant?.name ?? "Your school",
        ...input.data,
        first_name: r.first_name,
        student_name: students.get(r.person_id) ?? r.first_name,
        reason_suffix: input.data.reason ? ` (${input.data.reason})` : "",
      };
      const subject = render(override?.subject ?? base.subject ?? "", data).text;
      const body = render(override?.body ?? base.body, data).text;
      const address = channel === "email" ? r.email : channel === "sms" ? r.phone : null;
      const decision = decide({ channel, address, consent: { email: r.email_consent, sms: r.sms_consent }, now, timeZone: ctx.tz, quietHours: quiet });

      let status: string;
      let provider: string | null = null;
      let providerMessageId: string | null = null;
      let errorText: string | null = null;
      let scheduledFor: string | null = null;
      if (decision.action === "opted_out" || decision.action === "no_address") {
        status = decision.action;
      } else if (decision.action === "defer") {
        status = "deferred";
        scheduledFor = decision.until.toISOString();
      } else if (channel === "inapp") {
        status = "sent";
        provider = "inapp";
      } else {
        const p = channel === "email" ? providers.email : channel === "sms" ? providers.sms : null;
        if (!p) {
          status = "unsent_no_provider";
        } else {
          provider = p.name;
          try {
            const res = channel === "email"
              ? await providers.email!.send({ to: address as string, subject, text: body, html: textToHtml(body) })
              : await providers.sms!.send({ to: address as string, body });
            status = "sent";
            providerMessageId = res.providerMessageId;
          } catch (err) {
            status = "failed";
            errorText = err instanceof Error ? err.message : String(err);
            log.warn({ channel, err: errorText }, "provider send failed");
          }
        }
      }

      const { error: recErr } = await ctx.supabase.rpc("record_communication", {
        p: {
          channel, person_id: r.recipient_person_id, household_id: r.household_id, to_address: address, template_key: input.templateKey,
          subject: channel === "email" ? subject : null, body_text: body, body_html: channel === "email" ? textToHtml(body) : null,
          status, provider, provider_message_id: providerMessageId, error: errorText, scheduled_for: scheduledFor,
          related_type: input.related?.type ?? null, related_id: input.related?.id ?? null,
        },
      });
      if (recErr) {
        log.error({ err: recErr.message }, "record_communication failed");
        bump("record_failed");
        continue;
      }
      bump(status);
    }
  }
  summary.recipients = new Set((recipients ?? []).map((r) => r.recipient_person_id)).size;
  log.info({ template: input.templateKey, ...summary.byStatus }, "notify");
  return summary;
}
