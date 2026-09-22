const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

interface MailSummary {
  ID: string;
  Created: string;
}

/** Poll the local Supabase mail catcher for the newest message to `to` and return the first link matching `pattern`. */
export async function waitForLink(to: string, pattern: RegExp, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    if (res.ok) {
      const body = (await res.json()) as { messages?: MailSummary[] };
      const latest = body.messages?.[0];
      if (latest) {
        const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${latest.ID}`)).json()) as { HTML?: string; Text?: string };
        const text = `${msg.HTML ?? ""}\n${msg.Text ?? ""}`.replace(/&amp;/g, "&");
        const m = text.match(pattern);
        if (m) return m[0];
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email to ${to} matching ${pattern} within ${timeoutMs}ms`);
}
