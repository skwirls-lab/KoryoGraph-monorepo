import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate } from "@koryo/ui/components/app/date-text";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { FeedbackView } from "@/components/technique/feedback-view";
import { ConsentForm, SubmitClip } from "@/components/technique/submit-clip";
import { displayName } from "@/lib/people";
import { techniqueFeedbackSchema } from "@/lib/technique";
import { requireSurfacePage } from "@/server/context";
import { householdStudents } from "@/server/queries/home";

export const metadata = { title: "Technique feedback" };

const STATUS: Record<string, string> = {
  uploaded: "Waiting to be analysed", processing: "Analysing", review: "With your instructor", released: "Feedback ready", returned: "Sent back", failed: "Couldn't analyse",
};

export default async function SubmitTechniquePage({ params, searchParams }: { params: Promise<{ skill: string }>; searchParams: Promise<{ student?: string }> }) {
  const ctx = await requireSurfacePage("home");
  const [{ skill: skillId }, { student }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(skillId)) notFound();
  if (!ctx.modules.has("vision")) {
    return (<><PageHeader title="Technique feedback" /><EmptyState title="Not available" description="Your school hasn't turned on technique feedback." /></>);
  }
  const [{ data: skill }, students] = await Promise.all([
    ctx.supabase.from("skills").select("id, name, description, category").eq("id", skillId).is("archived_at", null).maybeSingle(),
    householdStudents(ctx),
  ]);
  if (!skill) notFound();
  const s = students.find((x) => x.id === student) ?? (students.length === 1 ? students[0] : undefined);
  if (!s) {
    return (
      <>
        <PageHeader eyebrow={<Link href="/home/progress">Progress</Link>} title={`Feedback on ${skill.name}`} />
        <ul className="space-y-2" aria-label="Choose a student">
          {students.map((x) => <li key={x.id}><Link href={`/home/progress/${skillId}/submit?student=${x.id}`}>{displayName(x)}</Link></li>)}
        </ul>
      </>
    );
  }
  const minor = Boolean(s.dob && Date.parse(s.dob) > new Date().getTime() - 18 * 365.25 * 86_400_000);
  const [{ data: consent }, { data: subs }] = await Promise.all([
    ctx.supabase.from("consents").select("granted").eq("person_id", s.id).eq("kind", "ai_processing").order("granted_at", { ascending: false }).limit(1).maybeSingle(),
    ctx.supabase.from("technique_submissions").select("id, status, feedback, return_reason, error, created_at, released_at, duration_ms").eq("person_id", s.id).eq("skill_id", skillId).order("created_at", { ascending: false }).limit(10),
  ]);
  const needsConsent = minor && !consent?.granted;
  const name = s.preferred_name || s.first_name;
  return (
    <>
      <PageHeader eyebrow={<Link href="/home/progress">Progress</Link>} title={`Feedback on ${skill.name}`} description={`${displayName(s)} · an instructor reviews every piece of AI feedback before you see it.`} />
      <div className="space-y-6">
        <section aria-labelledby="new-h" className="space-y-3 rounded-xl border border-default bg-surface p-4">
          <h2 id="new-h" className="text-base font-semibold">Send a practice clip</h2>
          {needsConsent ? <ConsentForm personId={s.id} skillId={skillId} name={name} /> : <SubmitClip tenantId={ctx.tenantId as string} personId={s.id} skillId={skillId} />}
        </section>
        <section aria-labelledby="clips-h" className="space-y-3">
          <h2 id="clips-h" className="text-base font-semibold">Your clips</h2>
          {!subs?.length ? <p className="text-sm text-fg-muted">No clips yet.</p> : (
            <ul className="space-y-3" aria-label="Your clips">
              {subs.map((x) => {
                const fb = x.status === "released" ? techniqueFeedbackSchema.safeParse(x.feedback) : null;
                return (
                  <li key={x.id} aria-label={`Clip from ${formatDate(x.created_at, ctx.tz, "date")}`} className="space-y-2 rounded-xl border border-default bg-surface p-4">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant={x.status === "released" ? "secondary" : "outline"}>{STATUS[x.status] ?? x.status}</Badge>
                      <span className="text-fg-muted">{formatDate(x.created_at, ctx.tz, "datetime")}{x.duration_ms ? ` · ${Math.round(x.duration_ms / 1000)} s` : ""}</span>
                    </div>
                    {fb?.success ? <FeedbackView feedback={fb.data} /> : null}
                    {x.status === "returned" ? <p className="text-sm">Your instructor asked for a new clip{x.return_reason ? `: “${x.return_reason}”` : "."}</p> : null}
                    {x.status === "failed" ? <p className="text-sm text-danger">{x.error ?? "Something went wrong analysing this clip."}</p> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
