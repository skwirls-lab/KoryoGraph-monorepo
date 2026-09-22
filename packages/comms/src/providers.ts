/**
 * Provider abstraction (F10.1). A provider exists only when its key is configured; otherwise callers
 * record the message as 'unsent_no_provider' (the Outbox). SDKs load lazily so they never reach a
 * client bundle and cost nothing when unused.
 */
export interface SendResult {
  providerMessageId: string;
}

export interface EmailProvider {
  name: "resend";
  send(msg: { to: string; subject: string; text: string; html: string; from?: string }): Promise<SendResult>;
}

export interface SmsProvider {
  name: "twilio";
  send(msg: { to: string; body: string }): Promise<SendResult>;
}

export interface Providers {
  email: EmailProvider | null;
  sms: SmsProvider | null;
}

export function providersFromEnv(env: Record<string, string | undefined>): Providers {
  const email: EmailProvider | null = env.RESEND_API_KEY
    ? {
        name: "resend",
        async send(msg) {
          const { Resend } = await import("resend");
          const client = new Resend(env.RESEND_API_KEY);
          const { data, error } = await client.emails.send({
            from: msg.from ?? env.RESEND_FROM ?? "KoryoGraph <no-reply@koryograph.ai>",
            to: msg.to,
            subject: msg.subject,
            text: msg.text,
            html: msg.html,
          });
          if (error || !data) throw new Error(error?.message ?? "Resend returned no id");
          return { providerMessageId: data.id };
        },
      }
    : null;
  const sms: SmsProvider | null =
    env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER
      ? {
          name: "twilio",
          async send(msg) {
            const twilio = (await import("twilio")).default;
            const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
            const m = await client.messages.create({ to: msg.to, from: env.TWILIO_FROM_NUMBER, body: msg.body });
            return { providerMessageId: m.sid };
          },
        }
      : null;
  return { email, sms };
}
