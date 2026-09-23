import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { HomeRegisterButton } from "@/components/testing/registration-controls";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Belt test" };

const LABEL: Record<string, string> = { invited: "Invited", registered: "Registered — fee due", paid: "Registered and paid", confirmed: "Confirmed", withdrawn: "Withdrawn", passed: "Passed", conditional: "Passed (conditional)", failed: "Not this time" };

export default async function HomeTesting({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSurfacePage("home");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: ev } = await ctx.supabase.from("testing_events").select("id, name, starts_at, fee_cents, registration_deadline, status").eq("id", id).maybeSingle();
  if (!ev) notFound();
  const { data: regs } = await ctx.supabase.from("testing_registrations")
    .select("id, status, invoice_id, people(first_name, preferred_name), ranks!testing_registrations_tenant_id_to_rank_id_fkey(name), invoices(status, balance_cents)")
    .eq("testing_event_id", id);
  return (
    <>
      <PageHeader title={ev.name} description={`${new Date(ev.starts_at).toLocaleString("en-US", { timeZone: ctx.tz, dateStyle: "full", timeStyle: "short" })}${ev.fee_cents ? ` · testing fee ${formatMoney(ev.fee_cents, ctx.currency)}` : ""}${ev.registration_deadline ? ` · register by ${ev.registration_deadline}` : ""}`} />
      <ul className="space-y-3" aria-label="Your students">
        {(regs ?? []).map((r) => {
          const name = r.people ? r.people.preferred_name || r.people.first_name : "Student";
          return (
            <li key={r.id} className="space-y-2 rounded-xl border border-default bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{name}</span>
                <span className="text-sm text-fg-secondary">testing for {r.ranks?.name}</span>
                <Badge variant={["paid", "confirmed", "passed"].includes(r.status) ? "secondary" : "outline"}>{LABEL[r.status] ?? r.status}</Badge>
              </div>
              {r.status === "invited" && ev.status === "open" ? <HomeRegisterButton registrationId={r.id} name={name} /> : null}
              {r.status === "registered" && r.invoice_id && (r.invoices?.balance_cents ?? 0) > 0 ? (
                <p className="text-sm">Pay the {formatMoney(r.invoices?.balance_cents ?? 0, ctx.currency)} testing fee on <Link href={`/home/billing?invoice=${r.invoice_id}`}>Billing</Link> (or at the front desk).</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
