import { z } from "zod";
import { createAnonClient } from "@koryo/db/anon";
import { AuthCard } from "@/components/auth/auth-card";
import { DocumentBody } from "@/components/documents/document-body";
import { GuestWaiverForm } from "@/components/events/guest-waiver-form";
import { mergeDoc } from "@/lib/documents";

export const metadata = { title: "Party waiver", robots: { index: false } };

const infoSchema = z.object({
  event: z.string(), starts_at: z.string(), school: z.string(), timezone: z.string(),
  waiver: z.object({ id: z.string(), name: z.string(), body: z.string() }).nullable(),
});

export default async function GuestWaiverPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data } = /^[0-9a-f]{48}$/.test(token) ? await createAnonClient().rpc("guest_waiver_info", { p_token: token }) : { data: null };
  const info = infoSchema.safeParse(data);
  if (!info.success) {
    return <AuthCard title="Link not valid" description="This party waiver link is invalid or has expired. Please ask the party host for a new one."><span /></AuthCard>;
  }
  const r = info.data;
  const body = r.waiver ? mergeDoc(r.waiver.body, { student_name: "the guest named below", guardian_name: "the parent or guardian signing below", school_name: r.school, date: new Date().toISOString().slice(0, 10) }) : null;
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <header>
        <p className="font-display font-bold">{r.school}</p>
        <h1 className="text-2xl font-bold">{r.event}</h1>
        <p className="text-sm text-fg-secondary">{new Date(r.starts_at).toLocaleString("en-US", { timeZone: r.timezone, dateStyle: "full", timeStyle: "short" })} · guest waiver</p>
      </header>
      {body ? <article className="rounded-xl border border-default bg-surface p-4" aria-label="Waiver"><DocumentBody body={body} /></article>
        : <p className="rounded-xl border border-default bg-surface p-4 text-sm">The school hasn&apos;t published a waiver; by signing you agree to the party&apos;s activity rules and give permission for the guest to take part.</p>}
      <GuestWaiverForm token={token} documentName={r.waiver?.name ?? "the party rules"} />
    </main>
  );
}
