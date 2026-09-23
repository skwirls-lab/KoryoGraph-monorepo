import { AlertTriangle, HeartPulse, Home, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { DateText } from "@koryo/ui/components/app/date-text";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { PersonBilling } from "@/components/billing/person-billing";
import { UrlTabs } from "@/components/common/url-tabs";
import { PersonDocuments } from "@/components/documents/person-documents";
import { PersonAttendance, PersonMessages } from "@/components/people/person-activity";
import { PersonEditSheet } from "@/components/people/person-edit-sheet";
import { ConsentToggles, MedicalNotes, NoteForm, StatusControl, TagList } from "@/components/people/person-controls";
import { StatusBadge } from "@/components/people/status-badge";
import { ProgressPanel } from "@/components/progress/progress-panel";
import { ageOn, displayName, isMinor, todayIn, type ConsentKind } from "@/lib/people";
import { requireSurfacePage } from "@/server/context";
import { getPerson } from "@/server/queries/people";
import { getPersonProgress, programsForEnrollment } from "@/server/queries/progress";
import { RiskInsight } from "@/components/risk/risk-list";

export const metadata = { title: "Person" };

function Section({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-default bg-surface p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">{icon}{title}</h2>
      {children}
    </section>
  );
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("people.read")) forbidden();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [data, progress, programs] = await Promise.all([getPerson(ctx, id), getPersonProgress(ctx, id), programsForEnrollment(ctx)]);
  if (!data) notFound();
  const { person: p, households, consents, notes, medical, audit } = data;
  const today = todayIn(ctx.tz);
  const canWrite = ctx.permissions.has("people.write");
  const minor = isMinor(p.dob, today);
  const consentMap = Object.fromEntries(consents.map((c) => [c.kind, c.granted])) as Partial<Record<ConsentKind, boolean>>;

  const overview = (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Section title="Contact">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-2"><Mail aria-hidden className="size-4 text-fg-muted" /><dt className="sr-only">Email</dt><dd>{p.email ?? <span className="text-fg-muted">No email</span>}</dd></div>
            <div className="flex items-center gap-2"><Phone aria-hidden className="size-4 text-fg-muted" /><dt className="sr-only">Phone</dt><dd>{p.phone ?? <span className="text-fg-muted">No phone</span>}</dd></div>
            <div><dt className="text-fg-muted">Date of birth</dt><dd>{p.dob ? <>{p.dob} ({ageOn(p.dob, today)})</> : "—"}</dd></div>
            <div><dt className="text-fg-muted">Messaging</dt><dd>{[p.email_consent && "email", p.phone_sms_consent && "SMS"].filter(Boolean).join(", ") || "No consent"}</dd></div>
            <div><dt className="text-fg-muted">Uniform / belt size</dt><dd>{p.uniform_size ?? "—"} / {p.belt_size ?? "—"}</dd></div>
            <div><dt className="text-fg-muted">Status since</dt><dd><DateText value={p.status_changed_at} timeZone={ctx.tz} />{p.status_reason ? ` — ${p.status_reason}` : ""}</dd></div>
          </dl>
          {canWrite ? <StatusControl personId={p.id} status={p.status} /> : null}
        </Section>
        <Section title="Safety" icon={<AlertTriangle aria-hidden className="size-4 text-warning" />}>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-fg-muted">Allergies</dt><dd>{p.allergies.length ? p.allergies.join(", ") : "None recorded"}</dd></div>
            <div><dt className="text-fg-muted">Injury flags</dt><dd>{p.injury_flags.length ? p.injury_flags.join(", ") : "None"}</dd></div>
          </dl>
        </Section>
        {medical !== null ? (
          <Section title="Medical notes" icon={<HeartPulse aria-hidden className="size-4 text-danger" />}>
            <MedicalNotes personId={p.id} initial={medical} canWrite={canWrite} />
          </Section>
        ) : null}
      </div>
      <div className="space-y-4">
        {minor || p.type_flags.includes("student") ? (
          <Section title="Guardian consents">
            <ConsentToggles personId={p.id} current={consentMap} canWrite={canWrite} />
          </Section>
        ) : null}
        <Section title="Tags">
          <TagList personId={p.id} tags={p.tags} canWrite={canWrite} />
        </Section>
        <Section title="Insights">
          <p className="text-sm text-fg-secondary">AI insights (churn risk, progress summaries) arrive with the Intelligence module in M4.</p>
        </Section>
      </div>
    </div>
  );

  const householdTab = households.length === 0 ? (
    <EmptyState title="Not in a household" description="Add this person to a household from the household page." />
  ) : (
    <div className="grid gap-4 md:grid-cols-2">
      {households.map((h) => (
        <Section key={h.id} title={h.name} icon={<Home aria-hidden className="size-4 text-fg-muted" />}>
          <ul className="space-y-2 text-sm">
            {h.household_members.map((m) => m.people ? (
              <li key={m.person_id} className="flex items-center justify-between gap-2">
                <Link href={`/desk/people/${m.person_id}`}>{displayName(m.people)}</Link>
                <span className="text-fg-muted capitalize">{m.relationship}{h.primary_payer_person_id === m.person_id ? " · payer" : ""}</span>
              </li>
            ) : null)}
          </ul>
          <Link href={`/desk/households/${h.id}`} className="text-sm">Open household</Link>
        </Section>
      ))}
    </div>
  );

  const notesTab = (
    <div className="space-y-4">
      <NoteForm personId={p.id} />
      {notes.length === 0 ? (
        <EmptyState title="No notes yet" />
      ) : (
        <ol className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-xl border border-default bg-surface p-4">
              <div className="mb-1 flex items-center gap-2 text-xs text-fg-muted">
                <span className="capitalize">{n.kind.replace("_", " ")}</span>·<DateText value={n.created_at} timeZone={ctx.tz} style="datetime" />
                {n.source !== "manual" ? <>· {n.source.replace("_", " ")}</> : null}
              </div>
              <p className="whitespace-pre-wrap text-sm">{n.body}</p>
            </li>
          ))}
        </ol>
      )}
      {audit ? (
        <Section title="Change history">
          {audit.length === 0 ? <p className="text-sm text-fg-muted">No changes recorded.</p> : (
            <ol className="space-y-1 text-sm">
              {audit.map((a) => (
                <li key={a.id} className="flex flex-wrap gap-x-2">
                  <DateText value={a.created_at} timeZone={ctx.tz} style="datetime" className="text-fg-muted" />
                  <span className="capitalize">{a.action}</span>
                  <span className="text-fg-secondary">{a.action === "update" && a.after && typeof a.after === "object" ? Object.keys(a.after).join(", ") : a.note ?? ""}</span>
                </li>
              ))}
            </ol>
          )}
        </Section>
      ) : null}
    </div>
  );

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/desk/people">People</Link>}
        title={displayName(p)}
        description={<span className="inline-flex items-center gap-2"><StatusBadge status={p.status} /> {p.type_flags.join(" · ")}</span>}
        actions={canWrite ? (
          <PersonEditSheet
            initial={{
              id: p.id, firstName: p.first_name, lastName: p.last_name, preferredName: p.preferred_name ?? "", dob: p.dob ?? "",
              email: p.email ?? "", phone: p.phone ?? "", emailConsent: p.email_consent, smsConsent: p.phone_sms_consent,
              allergies: p.allergies.join(", "), injuryFlags: p.injury_flags.join(", "), uniformSize: p.uniform_size ?? "", beltSize: p.belt_size ?? "",
            }}
          />
        ) : null}
      />
      <div className="mb-4 empty:hidden"><RiskInsight ctx={ctx} personId={p.id} /></div>
      <UrlTabs
        defaultValue="overview"
        tabs={[
          { value: "overview", label: "Overview", content: overview },
          { value: "household", label: "Household", content: householdTab },
          { value: "attendance", label: "Attendance", content: <PersonAttendance ctx={ctx} personId={p.id} /> },
          { value: "progress", label: "Progress", content: (
            <ProgressPanel personId={p.id} progress={progress} timeZone={ctx.tz} programs={programs}
              canPromote={ctx.permissions.has("ranks.promote")} canEnroll={canWrite} />
          ) },
          { value: "billing", label: "Billing", content: <PersonBilling ctx={ctx} personId={p.id} /> },
          { value: "documents", label: "Documents", content: <PersonDocuments ctx={ctx} personId={p.id} /> },
          { value: "messages", label: "Messages", content: <PersonMessages ctx={ctx} personId={p.id} /> },
          { value: "notes", label: "Notes", content: notesTab },
        ]}
      />
    </>
  );
}
