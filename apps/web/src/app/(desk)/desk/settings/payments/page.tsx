import Link from "next/link";
import { forbidden } from "next/navigation";
import { listReaders, type Stripe } from "@koryo/payments";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { ConnectButtons, RegisterReaderForm } from "@/components/payments/connect-panel";
import { requireSurfacePage } from "@/server/context";
import { publishableKey, stripeClient, tenantStripe } from "@/server/payments/stripe";

export const metadata = { title: "Payments" };

const card = "rounded-xl border border-default bg-surface p-4 sm:p-5";

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-2 text-sm">
      <span aria-hidden className={ok ? "text-success" : "text-fg-muted"}>{ok ? "✓" : "○"}</span>
      <span className={ok ? "" : "text-fg-secondary"}>{children}<span className="sr-only">{ok ? " (done)" : " (not done)"}</span></span>
    </li>
  );
}

export default async function PaymentsSettings({ searchParams }: { searchParams: Promise<{ stripe?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("settings.manage")) forbidden();
  const { stripe: returned } = await searchParams;
  const header = <PageHeader eyebrow={<Link href="/desk/settings">Settings</Link>} title="Payments" description="Card payments through your school's own Stripe account." />;
  if (!ctx.modules.has("billing")) {
    return (
      <>
        {header}
        <p className={`${card} text-sm`}>Card payments are part of the Billing module, which isn&apos;t on your plan. <Link href="/desk/upgrade">See plans</Link>.</p>
      </>
    );
  }

  const stripe = stripeClient();
  const t = await tenantStripe(ctx);
  const webhookReady = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  let readers: Stripe.Terminal.Reader[] = [];
  let readerError: string | null = null;
  if (stripe && t.accountId && t.onboardingComplete) {
    try {
      readers = await listReaders(stripe, t.accountId, t.terminalLocationId ?? undefined);
    } catch {
      readerError = "Couldn't load card readers from Stripe.";
    }
  }

  return (
    <>
      {header}
      {returned === "incomplete" ? <p role="status" className="mb-4 rounded-md bg-elevated p-3 text-sm">Stripe still needs a few details before you can take payments. Continue onboarding when you&apos;re ready.</p> : null}
      {returned === "connected" ? <p role="status" className="mb-4 rounded-md bg-elevated p-3 text-sm">Your Stripe account is connected.</p> : null}
      {returned === "error" ? <p role="alert" className="mb-4 rounded-md bg-elevated p-3 text-sm text-danger">We couldn&apos;t reach Stripe. Try again.</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card} aria-labelledby="stripe-h">
          <h2 id="stripe-h" className="mb-3 text-base font-semibold">Stripe account</h2>
          {!stripe ? (
            <div className="space-y-2 text-sm">
              <p><strong>Stripe isn&apos;t configured on this server.</strong> Card payments, saved cards and card readers are unavailable until it is. Cash, check and external payments still work.</p>
              <p className="text-fg-secondary">Whoever runs this KoryoGraph installation needs to set <code>STRIPE_SECRET_KEY</code>, <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> and <code>STRIPE_WEBHOOK_SECRET</code>.</p>
            </div>
          ) : (
            <>
              <ul className="mb-4 space-y-1">
                <Check ok={Boolean(t.accountId)}>Stripe account created{t.accountId ? <span className="text-fg-muted"> ({t.accountId})</span> : null}</Check>
                <Check ok={t.onboardingComplete}>Onboarding complete: charges enabled</Check>
                <Check ok={webhookReady}>Webhook signing secret configured</Check>
                <Check ok={Boolean(publishableKey())}>Card entry (publishable key) configured</Check>
              </ul>
              <ConnectButtons connected={Boolean(t.accountId)} complete={t.onboardingComplete} />
              <p className="mt-3 text-xs text-fg-muted">Payments go directly to your school&apos;s Stripe account. {Number(process.env.STRIPE_PLATFORM_FEE_BPS ?? 0) > 0 ? `A platform fee of ${(Number(process.env.STRIPE_PLATFORM_FEE_BPS) / 100).toFixed(2)}% applies.` : "No platform fee is charged."}</p>
            </>
          )}
        </section>
        <section className={card} aria-labelledby="readers-h">
          <h2 id="readers-h" className="mb-3 text-base font-semibold">Card readers</h2>
          {!stripe || !t.onboardingComplete ? (
            <p className="text-sm text-fg-secondary">Connect Stripe first to register a card reader.</p>
          ) : (
            <>
              {readerError ? <p role="alert" className="mb-2 text-sm text-danger">{readerError}</p> : null}
              {readers.length ? (
                <ul className="mb-4 divide-y divide-default text-sm" aria-label="Registered readers">
                  {readers.map((r) => (
                    <li key={r.id} className="flex justify-between py-2"><span>{r.label ?? r.id}</span><span className="text-fg-muted">{r.device_type} · {r.status ?? "unknown"}</span></li>
                  ))}
                </ul>
              ) : <p className="mb-4 text-sm text-fg-muted">No readers registered.</p>}
              <RegisterReaderForm />
            </>
          )}
        </section>
      </div>
    </>
  );
}
