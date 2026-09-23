import { redirect } from "next/navigation";

// Card-update link in payment-failed notices (/home/wallet?invoice=…) — the wallet lives on Billing.
export default async function Wallet({ searchParams }: { searchParams: Promise<{ invoice?: string }> }) {
  const { invoice } = await searchParams;
  redirect(invoice && /^[0-9a-f-]{36}$/i.test(invoice) ? `/home/billing?invoice=${invoice}` : "/home/billing");
}
