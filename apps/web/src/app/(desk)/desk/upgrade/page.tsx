import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { MoneyText } from "@koryo/ui/components/app/money-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Upgrade" };

/** Locked modules render this prompt (not hidden): what the module does and which plans include it. */
export default async function UpgradePage({ searchParams }: { searchParams: Promise<{ module?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  const { module: key } = await searchParams;
  const [{ data: mod }, { data: plans }] = await Promise.all([
    ctx.supabase.from("modules").select("key, name, description").eq("key", key ?? "").maybeSingle(),
    ctx.supabase.from("plan_modules").select("plans(key, name, monthly_cents, public)").eq("module_key", key ?? ""),
  ]);
  if (!mod) {
    return <EmptyState title="Unknown module" description="That module doesn't exist." />;
  }
  const available = (plans ?? []).flatMap((p) => (p.plans && p.plans.public ? [p.plans] : []));
  return (
    <>
      <PageHeader eyebrow="Not in your plan" title={mod.name} description={mod.description} />
      <section className="space-y-3 rounded-xl border border-default bg-surface p-6">
        <h2 className="text-lg font-semibold">Plans that include {mod.name}</h2>
        {available.length === 0 ? (
          <p className="text-sm text-fg-secondary">Available as an add-on. Contact KoryoGraph to enable it.</p>
        ) : (
          <ul className="space-y-2">
            {available.map((p) => (
              <li key={p.key} className="flex items-center justify-between rounded-lg border border-default px-4 py-3">
                <span className="font-medium">{p.name}</span>
                <span className="text-sm text-fg-secondary">
                  <MoneyText cents={p.monthly_cents} currency={ctx.currency} /> / month
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-fg-muted">Plan changes are handled by the school owner in Settings → Subscription (built in M5).</p>
      </section>
    </>
  );
}
