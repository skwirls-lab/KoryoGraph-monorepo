import { redirect } from "next/navigation";

// The AR dashboard arrives with invoices (M2.05); until then Billing opens on plans.
export default function BillingIndex() {
  redirect("/desk/billing/plans");
}
