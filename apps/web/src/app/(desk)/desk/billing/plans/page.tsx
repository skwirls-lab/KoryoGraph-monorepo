import Link from "next/link";
import { forbidden } from "next/navigation";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { PlanDialog, type PlanFormOptions } from "@/components/billing/plan-form";
import { PlanActiveToggle } from "@/components/billing/plan-active-toggle";
import { PLAN_KIND_LABELS, type PlanInput, type PlanKind } from "@/lib/validation/billing";
import { requireSurfacePage } from "@/server/context";
import { ModuleLocked } from "@/components/billing/module-locked";

export const metadata = { title: "Membership plans" };

const dollars = (cents: number | null) => (cents === null || cents === undefined ? "" : (cents / 100).toFixed(2));
const blankNum = (n: number | null) => (n === null ? "" : n);

export default async function PlansPage() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("billing.read")) forbidden();
  if (!ctx.modules.has("billing")) return <ModuleLocked title="Membership plans" />;
  const canEdit = ctx.permissions.has("billing.charge");
  const [{ data: plans }, { data: programs }, { data: products }, { data: rates }] = await Promise.all([
    ctx.supabase.from("membership_plans").select("*").order("active", { ascending: false }).order("sort").order("name"),
    ctx.supabase.from("programs").select("id, name").eq("active", true).order("sort"),
    ctx.modules.has("retail") ? ctx.supabase.from("products").select("id, name").eq("active", true).order("sort") : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ctx.supabase.from("tax_rates").select("name, rate, applies_to"),
  ]);
  const classes = new Map<string, string>([["exempt", "No tax"]]);
  for (const r of rates ?? []) for (const c of r.applies_to) classes.set(c, `${c} (${r.name}, ${(Number(r.rate) * 100).toFixed(2)}%)`);
  const options: PlanFormOptions = {
    programs: (programs ?? []).map((p) => ({ value: p.id, label: p.name })),
    products: (products ?? []).map((p) => ({ value: p.id, label: p.name })),
    taxClasses: [...classes].map(([value, label]) => ({ value, label })),
    retail: ctx.modules.has("retail"),
  };
  const programName = new Map((programs ?? []).map((p) => [p.id, p.name]));

  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/billing">Billing</Link>} title="Membership plans" description="What families can sign up for, and how it bills." actions={canEdit ? <PlanDialog options={options} /> : null} />
      {!plans?.length ? <EmptyState title="No plans yet" description="Create your first membership plan to start enrolling students." /> : (
        <ul className="divide-y divide-default rounded-xl border border-default bg-surface" aria-label="Plans">
          {plans.map((p) => {
            const fam = p.family_discount as { second_pct?: number; third_plus_pct?: number };
            const rule = p.attendance_rule as { unlimited?: boolean; classes_per_week?: number };
            const every = p.interval ? `/${p.interval_count > 1 ? `${p.interval_count} ${p.interval}s` : p.interval}` : "";
            const initial: PlanInput = {
              id: p.id, name: p.name, description: p.description, kind: p.kind as PlanKind, interval: (p.interval ?? "") as PlanInput["interval"],
              intervalCount: p.interval_count, price: dollars(p.price_cents), enrollmentFee: p.enrollment_fee_cents ? dollars(p.enrollment_fee_cents) : "",
              contractMonths: blankNum(p.contract_months), earlyTerminationFee: dollars(p.early_termination_fee_cents), autoRenew: p.auto_renew,
              termMonths: blankNum(p.term_months), classPackSize: blankNum(p.class_pack_size), trialDays: blankNum(p.trial_days), programIds: p.program_ids,
              unlimited: rule.unlimited !== false, classesPerWeek: rule.classes_per_week ?? "", secondPct: fam.second_pct ?? 0, thirdPlusPct: fam.third_plus_pct ?? 0,
              taxClass: p.tax_class, gearProductIds: p.gear_package_product_ids, isPublic: p.public, active: p.active,
            };
            return (
              <li key={p.id} aria-label={p.name} className={`flex flex-wrap items-start gap-3 px-4 py-3 ${p.active ? "" : "opacity-60"}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.name}</span>
                    <Badge variant="outline">{PLAN_KIND_LABELS[p.kind as PlanKind]}</Badge>
                    {p.public ? <Badge variant="secondary">Public</Badge> : null}
                    {!p.active ? <Badge variant="outline">Archived</Badge> : null}
                  </div>
                  <div className="text-sm text-fg-secondary">
                    <span className="tabular">{formatMoney(p.price_cents, ctx.currency)}{every}</span>
                    {p.enrollment_fee_cents ? ` · ${formatMoney(p.enrollment_fee_cents, ctx.currency)} enrollment fee` : ""}
                    {p.contract_months ? ` · ${p.contract_months}-month contract` : ""}
                    {p.term_months ? ` · covers ${p.term_months} months` : ""}
                    {p.class_pack_size ? ` · ${p.class_pack_size} classes` : ""}
                    {p.trial_days ? ` · ${p.trial_days} days` : ""}
                    {rule.unlimited === false && rule.classes_per_week ? ` · ${rule.classes_per_week}×/week` : " · unlimited"}
                  </div>
                  <div className="text-xs text-fg-muted">
                    {p.program_ids.map((id) => programName.get(id)).filter(Boolean).join(", ") || "No program access"}
                    {fam.second_pct || fam.third_plus_pct ? ` · family: 2nd −${fam.second_pct ?? 0}%, 3rd+ −${fam.third_plus_pct ?? 0}%` : ""}
                    {p.gear_package_product_ids.length ? ` · kit: ${p.gear_package_product_ids.length} item${p.gear_package_product_ids.length === 1 ? "" : "s"}` : ""}
                  </div>
                </div>
                {canEdit ? <div className="flex gap-2"><PlanDialog initial={initial} options={options} /><PlanActiveToggle id={p.id} active={p.active} name={p.name} /></div> : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
