import Link from "next/link";
import { forbidden } from "next/navigation";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { TestDialog } from "@/components/testing/test-form";
import { requireSurfacePage } from "@/server/context";
import { staffOptions } from "@/server/queries/schedule";

export const metadata = { title: "Belt testing" };

export default async function TestingPage() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("testing.manage")) forbidden();
  const [{ data: events }, { data: programs }, staff] = await Promise.all([
    ctx.supabase.from("testing_events").select("id, name, starts_at, status, fee_cents, capacity, testing_registrations(status)").order("starts_at", { ascending: false }).limit(100),
    ctx.supabase.from("programs").select("id, name").eq("active", true).order("sort"),
    staffOptions(ctx),
  ]);
  return (
    <>
      <PageHeader title="Belt testing" description="Tests, rosters from the eligibility engine, scoresheets and promotions."
        actions={<TestDialog programs={(programs ?? []).map((p) => ({ value: p.id, label: p.name }))} staff={staff.map((s) => ({ value: s.id, label: s.name }))} />} />
      {!events?.length ? <EmptyState title="No tests yet" description="Create a test; eligible students are found for you." /> : (
        <ul className="divide-y divide-default rounded-xl border border-default bg-surface" aria-label="Tests">
          {events.map((e) => {
            const regs = e.testing_registrations;
            const count = (s: string[]) => regs.filter((r) => s.includes(r.status)).length;
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Link href={`/desk/testing/${e.id}`} className="font-medium">{e.name}</Link>
                <span className="text-sm text-fg-secondary">{new Date(e.starts_at).toLocaleString("en-US", { timeZone: ctx.tz, dateStyle: "medium", timeStyle: "short" })}</span>
                <Badge variant={e.status === "open" ? "secondary" : "outline"}>{e.status}</Badge>
                <span className="ml-auto text-xs text-fg-muted">{count(["invited"])} invited · {count(["registered", "paid", "confirmed"])} registered · {count(["passed", "conditional"])} passed</span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
