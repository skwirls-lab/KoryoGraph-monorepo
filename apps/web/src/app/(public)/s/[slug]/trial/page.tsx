import { notFound } from "next/navigation";
import { createAnonClient } from "@koryo/db/anon";
import { TrialForm } from "@/components/crm/trial-form";

export const metadata = { title: "Book a trial class" };

interface Info { school: { name: string; timezone: string }; programs: { id: string; name: string }[]; sessions: { id: string; name: string; starts_at: string; program_ids: string[]; spots_left: number | null }[] }

const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

/** Public trial request page (also what the embeddable widget frames). */
export default async function TrialPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { slug } = await params;
  const sp = await searchParams;
  if (!/^[a-z0-9-]{1,50}$/.test(slug)) notFound();
  const { data } = await createAnonClient().rpc("public_trial_info", { p_slug: slug });
  const info = data as Info | null;
  if (!info) notFound();
  const utm = Object.fromEntries(UTM.flatMap((k) => (sp[k] ? [[k, String(sp[k]).slice(0, 200)]] : [])));
  if (sp.ref) utm.referrer = String(sp.ref).slice(0, 200);
  return (
    <main id="main" className={`mx-auto max-w-xl px-4 ${sp.embed ? "py-4" : "py-10"}`}>
      {!sp.embed ? <p className="mb-1 text-sm font-semibold text-fg-secondary">{info.school.name}</p> : null}
      <h1 className="mb-2 text-2xl font-bold">Try a class — it&apos;s free</h1>
      <p className="mb-6 text-fg-secondary">Tell us a little about you and pick a class, or we&apos;ll call to find a time.</p>
      <TrialForm slug={slug} school={info.school.name} timezone={info.school.timezone} programs={info.programs} sessions={info.sessions} utm={utm} />
    </main>
  );
}
