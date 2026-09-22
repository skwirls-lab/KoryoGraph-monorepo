import Link from "next/link";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { SendLinkButton } from "@/components/documents/send-link-button";
import { isMinor, todayIn } from "@/lib/people";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Compliance" };

export default async function CompliancePage() {
  const ctx = await requireSurfacePage("desk");
  const today = todayIn(ctx.tz);
  const [{ data: unsigned }, { data: students }, { data: consents }, { data: certs }] = await Promise.all([
    ctx.supabase.from("v_required_documents").select("*").is("signature_id", null).order("person_name"),
    ctx.supabase.from("people").select("id, first_name, last_name, preferred_name, dob").contains("type_flags", ["student"]).in("status", ["active", "trial"]).is("archived_at", null),
    ctx.supabase.from("v_current_consents").select("person_id, kind, granted"),
    ctx.supabase.from("staff_certifications").select("id, kind, expires_at, user_id").lt("expires_at", today),
  ]);
  const minorsMissingMedia = (students ?? []).filter((s) => isMinor(s.dob, today) && !(consents ?? []).some((c) => c.person_id === s.id && c.kind === "media_release"));
  const canWrite = ctx.permissions.has("people.write");
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/documents">Documents</Link>} title="Compliance" description="What's missing, so nothing slips." />
      <div className="space-y-8">
        <section aria-labelledby="unsigned-h" className="space-y-3">
          <h2 id="unsigned-h" className="text-lg font-semibold">Unsigned required documents <span className="text-fg-muted tabular">({unsigned?.length ?? 0})</span></h2>
          {!unsigned?.length ? <EmptyState title="Everyone has signed" /> : (
            <ul className="divide-y divide-default rounded-xl border border-default bg-surface" aria-label="Unsigned required documents">
              {unsigned.map((u) => (
                <li key={`${u.template_id}-${u.person_id}`} className="flex flex-wrap items-center gap-3 px-4 py-3" aria-label={`${u.person_name}: ${u.template_name}`}>
                  <Link href={`/desk/people/${u.person_id}?tab=documents`} className="font-medium">{u.person_name}</Link>
                  <span className="text-sm text-fg-secondary">{u.template_name} v{u.version}</span>
                  {u.signed_older_version ? <Badge variant="outline" className="border-warning/50 text-warning">new version — re-sign</Badge> : null}
                  <span className="ml-auto">{canWrite ? <SendLinkButton templateId={u.template_id as string} personId={u.person_id as string} label={`${u.person_name}, ${u.template_name}`} /> : null}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="consent-h" className="space-y-3">
          <h2 id="consent-h" className="text-lg font-semibold">Minors without a media release decision <span className="text-fg-muted tabular">({minorsMissingMedia.length})</span></h2>
          {minorsMissingMedia.length === 0 ? <p className="text-sm text-fg-muted">None.</p> : (
            <ul className="flex flex-wrap gap-2">{minorsMissingMedia.map((s) => <li key={s.id}><Link href={`/desk/people/${s.id}`}>{s.preferred_name || s.first_name} {s.last_name}</Link></li>)}</ul>
          )}
        </section>
        <section aria-labelledby="certs-h" className="space-y-3">
          <h2 id="certs-h" className="text-lg font-semibold">Expired staff certifications <span className="text-fg-muted tabular">({certs?.length ?? 0})</span></h2>
          {!certs?.length ? <p className="text-sm text-fg-muted">None. (Staff certifications are managed with staff profiles in M3.)</p> : (
            <ul className="text-sm">{certs.map((c) => <li key={c.id}>{c.kind} expired {c.expires_at}</li>)}</ul>
          )}
        </section>
      </div>
    </>
  );
}
