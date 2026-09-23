"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { selectClass } from "@/components/forms/select-field";
import { AddCardButton } from "@/components/payments/card-setup";
import { cardLabel } from "@/lib/payments";
import { PLAN_KIND_LABELS, type PlanKind } from "@/lib/validation/billing";
import { enrollMembership, previewEnrollment } from "@/server/actions/billing";
import type { EnrollmentQuote } from "@/server/billing/enrollment";
import type { SavedCard } from "@/server/queries/payments";

export interface WizardPlan {
  id: string;
  name: string;
  kind: PlanKind;
  description: string;
  priceCents: number;
  every: string;
  enrollmentFeeCents: number;
}

export interface WizardHousehold {
  id: string;
  name: string;
  cards: SavedCard[];
}

type PayMethod = "card" | "cash" | "check" | "later";
const STEPS = ["Plan", "Details", "Review & pay"] as const;

function sizeFor(productName: string, sizes: { uniform: string | null; belt: string | null }): string | null {
  if (/belt/i.test(productName)) return sizes.belt;
  if (/uniform|dobok|\bgi\b/i.test(productName)) return sizes.uniform;
  return null;
}

export function EnrollWizard(props: {
  personId: string;
  personName: string;
  households: WizardHousehold[];
  plans: WizardPlan[];
  today: string;
  currency: string;
  sizes: { uniform: string | null; belt: string | null };
  cardBlocker: string | null;
}) {
  const { personId, households, plans, currency } = props;
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [householdId, setHouseholdId] = useState(households[0]?.id ?? "");
  const [planId, setPlanId] = useState("");
  const [startsAt, setStartsAt] = useState(props.today);
  const [billingDay, setBillingDay] = useState(Math.min(28, Number(props.today.slice(8, 10))));
  const [codeDraft, setCodeDraft] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [gear, setGear] = useState<Record<string, string>>({});
  const [quote, setQuote] = useState<EnrollmentQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [pay, setPay] = useState<PayMethod>("cash");
  const [autopay, setAutopay] = useState(true);
  const [signature, setSignature] = useState("");
  const [checkRef, setCheckRef] = useState("");
  const [attemptKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [loading, startQuote] = useTransition();
  const [submitting, startSubmit] = useTransition();

  const household = households.find((h) => h.id === householdId);
  const cards = household?.cards ?? [];
  const plan = plans.find((p) => p.id === planId);

  useEffect(() => {
    if (!planId || !householdId) return;
    startQuote(async () => {
      const r = await previewEnrollment({ personId, householdId, planId, startsAt, billingDay, couponCode, gear });
      if (!r.ok) {
        setQuote(null);
        setQuoteError(r.error);
        return;
      }
      setQuoteError(null);
      setQuote(r.data);
      // Pre-fill sizes from the student's record the first time a kit shows up.
      const fill: Record<string, string> = {};
      for (const g of r.data.gear) {
        if (g.chosenVariantId || gear[g.productId]) continue;
        const want = sizeFor(g.productName, props.sizes);
        const match = want ? g.variants.find((v) => v.size.toLowerCase() === want.toLowerCase()) : undefined;
        if (match) fill[g.productId] = match.id;
      }
      if (Object.keys(fill).length) setGear((prev) => ({ ...fill, ...prev }));
    });
    // gear/sizes updates re-trigger through `gear`; props.sizes is stable per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, householdId, startsAt, billingDay, couponCode, gear, personId]);

  const [cardChoice, setCardId] = useState("");
  const cardId = cards.some((c) => c.id === cardChoice) ? cardChoice : (cards.find((c) => c.is_default)?.id ?? cards[0]?.id ?? "");

  const total = quote?.invoice.totalCents ?? 0;
  const missingGear = quote?.gear.filter((g) => !g.chosenVariantId) ?? [];
  const needsSignature = Boolean(quote?.contract && !quote.contract.alreadySigned);
  const recurring = plan?.kind === "recurring" || plan?.kind === "contract";

  function submit() {
    setError(null);
    startSubmit(async () => {
      const payment = pay === "card" ? { method: "card" as const, paymentMethodId: cardId, attemptKey }
        : pay === "check" ? { method: "check" as const, reference: checkRef }
        : pay === "cash" ? { method: "cash" as const } : { method: "later" as const };
      const r = await enrollMembership({
        personId, householdId, planId, startsAt, billingDay, couponCode, gear, payment,
        autopay: pay === "card" && autopay && recurring, contractSignature: signature, notes: "",
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (r.data.paymentStatus === "failed") toast.warning(r.data.message);
      else toast.success(r.data.message);
      router.push(`/desk/people/${personId}?tab=billing`);
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-4">
        <ol className="flex flex-wrap gap-2 text-sm" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? "step" : undefined} className={`rounded-full px-3 py-1 ${i === step ? "bg-primary text-primary-foreground" : "bg-elevated text-fg-secondary"}`}>
              {i + 1}. {s}
            </li>
          ))}
        </ol>

        {step === 0 ? (
          <section className="space-y-4 rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby="plan-h">
            <h2 id="plan-h" className="text-base font-semibold">Choose a plan</h2>
            {households.length > 1 ? (
              <div className="space-y-1">
                <Label htmlFor="enroll-household">Billed to household</Label>
                <select id="enroll-household" className={selectClass} value={householdId} onChange={(e) => setHouseholdId(e.target.value)}>
                  {households.map((h) => <option key={h.id} value={h.id} className="bg-surface">{h.name}</option>)}
                </select>
              </div>
            ) : null}
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="sr-only">Plan</legend>
              {plans.map((p) => (
                <label key={p.id} className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 ${planId === p.id ? "border-primary bg-primary/5" : "border-default"}`}>
                  <span className="flex items-center gap-2">
                    <input type="radio" name="plan" value={p.id} checked={planId === p.id} onChange={() => setPlanId(p.id)} className="accent-[var(--color-primary)]" />
                    <span className="font-medium">{p.name}</span>
                  </span>
                  <span className="text-sm text-fg-secondary"><span className="tabular">{formatMoney(p.priceCents, currency)}{p.every}</span> · {PLAN_KIND_LABELS[p.kind]}</span>
                  {p.description ? <span className="text-xs text-fg-muted">{p.description}</span> : null}
                </label>
              ))}
            </fieldset>
            <Button disabled={!planId} onClick={() => setStep(1)}>Next</Button>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="space-y-4 rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby="details-h">
            <h2 id="details-h" className="text-base font-semibold">Details</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="enroll-start">Start date</Label>
                <Input id="enroll-start" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </div>
              {recurring ? (
                <div className="space-y-1">
                  <Label htmlFor="enroll-billing-day">Billing day of the month</Label>
                  <select id="enroll-billing-day" className={selectClass} value={billingDay} onChange={(e) => setBillingDay(Number(e.target.value))}>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d} className="bg-surface">{d}</option>)}
                  </select>
                </div>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="enroll-code">Discount code</Label>
              <div className="flex gap-2">
                <Input id="enroll-code" value={codeDraft} onChange={(e) => setCodeDraft(e.target.value.toUpperCase())} placeholder="Optional" className="max-w-48" />
                <Button type="button" variant="outline" onClick={() => setCouponCode(codeDraft.trim())}>Apply</Button>
                {couponCode ? <Button type="button" variant="ghost" onClick={() => { setCouponCode(""); setCodeDraft(""); }}>Remove</Button> : null}
              </div>
              {quote?.couponError ? <p role="alert" className="text-sm text-danger">{quote.couponError}</p> : null}
              {quote?.coupon ? <p className="text-sm text-fg-secondary">Applied: {quote.coupon.name}</p> : null}
            </div>
            {quote?.gear.length ? (
              <fieldset className="space-y-2 rounded-lg border border-default p-3">
                <legend className="px-1 text-sm font-medium">Enrollment kit sizes</legend>
                {quote.gear.map((g) => (
                  <div key={g.productId} className="grid items-center gap-2 sm:grid-cols-[1fr_10rem]">
                    <Label htmlFor={`gear-${g.productId}`}>{g.productName}</Label>
                    <select id={`gear-${g.productId}`} className={selectClass} value={g.chosenVariantId ?? ""} onChange={(e) => setGear((prev) => ({ ...prev, [g.productId]: e.target.value }))}>
                      <option value="">Choose size</option>
                      {g.variants.map((v) => <option key={v.id} value={v.id} className="bg-surface">{v.size}</option>)}
                    </select>
                  </div>
                ))}
              </fieldset>
            ) : null}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
              <Button disabled={!quote || missingGear.length > 0 || Boolean(quote.couponError)} onClick={() => setStep(2)}>Next</Button>
            </div>
          </section>
        ) : null}

        {step === 2 && quote ? (
          <section className="space-y-4 rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby="pay-h">
            <h2 id="pay-h" className="text-base font-semibold">Review &amp; pay</h2>
            {quote.contract ? (
              <div className="space-y-2 rounded-lg border border-default p-3">
                <h3 className="text-sm font-semibold">{quote.contract.name}</h3>
                {quote.contract.alreadySigned ? <p className="text-sm text-fg-secondary">Already signed for {props.personName}.</p> : (
                  <>
                    <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded bg-elevated p-2 text-xs">{quote.contract.body}</div>
                    <Label htmlFor="enroll-signature">Signed by (guardian&apos;s full name)</Label>
                    <Input id="enroll-signature" value={signature} onChange={(e) => setSignature(e.target.value)} autoComplete="off" />
                  </>
                )}
              </div>
            ) : null}
            {total > 0 ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Payment</legend>
                {props.cardBlocker ? null : (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="pay" checked={pay === "card"} disabled={!cards.length} onChange={() => setPay("card")} className="accent-[var(--color-primary)]" />
                    Card on file
                  </label>
                )}
                {pay === "card" && !props.cardBlocker ? (
                  <div className="ml-6 space-y-2">
                    {cards.length ? (
                      <select aria-label="Card" className={selectClass} value={cardId} onChange={(e) => setCardId(e.target.value)}>
                        {cards.map((c) => <option key={c.id} value={c.id} className="bg-surface">{cardLabel(c)}</option>)}
                      </select>
                    ) : null}
                    {recurring ? (
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={autopay} onChange={(e) => setAutopay(e.target.checked)} className="accent-[var(--color-primary)]" /> Use this card for autopay
                      </label>
                    ) : null}
                  </div>
                ) : null}
                {!props.cardBlocker && householdId ? <div className="ml-6"><AddCardButton householdId={householdId} /></div> : null}
                <label className="flex items-center gap-2 text-sm"><input type="radio" name="pay" checked={pay === "cash"} onChange={() => setPay("cash")} className="accent-[var(--color-primary)]" /> Cash</label>
                <label className="flex items-center gap-2 text-sm"><input type="radio" name="pay" checked={pay === "check"} onChange={() => setPay("check")} className="accent-[var(--color-primary)]" /> Check</label>
                {pay === "check" ? <Input aria-label="Check number" placeholder="Check number" value={checkRef} onChange={(e) => setCheckRef(e.target.value)} className="ml-6 max-w-48" /> : null}
                <label className="flex items-center gap-2 text-sm"><input type="radio" name="pay" checked={pay === "later"} onChange={() => setPay("later")} className="accent-[var(--color-primary)]" /> Pay later (leave the invoice open)</label>
                {props.cardBlocker ? <p className="text-xs text-fg-muted">{props.cardBlocker}</p> : null}
              </fieldset>
            ) : <p className="text-sm text-fg-secondary">Nothing is due today.</p>}
            {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button disabled={submitting || loading || (pay === "card" && !cardId) || (needsSignature && signature.trim().length < 2)} onClick={submit}>
                {submitting ? "Enrolling…" : total > 0 && pay !== "later" ? `Enroll and take ${formatMoney(total, currency)}` : "Enroll"}
              </Button>
            </div>
          </section>
        ) : null}
      </div>

      <aside className="h-fit rounded-xl border border-default bg-surface p-4 sm:p-5" aria-labelledby="preview-h" aria-busy={loading}>
        <h2 id="preview-h" className="mb-3 text-base font-semibold">Invoice preview</h2>
        {!planId ? <p className="text-sm text-fg-muted">Choose a plan to see the first invoice.</p> : null}
        {quoteError ? <p role="alert" className="text-sm text-danger">{quoteError}</p> : null}
        {quote ? (
          <>
            <ul className="space-y-2 text-sm" aria-label="Invoice lines">
              {quote.invoice.lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="min-w-0">{l.description}{l.discountCents ? <span className="block text-xs text-success">−{formatMoney(l.discountCents, currency)} discount</span> : null}</span>
                  <span className="tabular shrink-0">{formatMoney(l.totalCents, currency)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-default pt-3 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular">{formatMoney(quote.invoice.subtotalCents, currency)}</dd></div>
              {quote.invoice.discountCents ? <div className="flex justify-between"><dt>Discounts</dt><dd className="tabular">−{formatMoney(quote.invoice.discountCents, currency)}</dd></div> : null}
              {quote.invoice.taxCents ? <div className="flex justify-between"><dt>Tax</dt><dd className="tabular">{formatMoney(quote.invoice.taxCents, currency)}</dd></div> : null}
              <div className="flex justify-between font-semibold"><dt>Due today</dt><dd className="tabular">{formatMoney(total, currency)}</dd></div>
            </dl>
            {quote.familyPct ? <p className="mt-2"><Badge variant="secondary">Family discount {quote.familyPct}%</Badge></p> : null}
            <p className="mt-2 text-xs text-fg-muted">
              {quote.nextBillAt ? `Next bill ${quote.nextBillAt} (${formatMoney(plan?.priceCents ?? 0, currency)}${plan?.every ?? ""}).` : ""}
              {quote.endsAt ? ` Ends ${quote.endsAt}.` : ""}
              {quote.contractEndsAt ? ` Contract through ${quote.contractEndsAt}.` : ""}
            </p>
          </>
        ) : null}
      </aside>
    </div>
  );
}
