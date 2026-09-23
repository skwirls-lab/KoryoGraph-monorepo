/** "Visa ending 4242" — shared by server pages and client components. */
export function cardLabel(c: { brand: string | null; last4: string | null; kind: string }): string {
  const brand = c.brand ? c.brand.charAt(0).toUpperCase() + c.brand.slice(1) : c.kind === "us_bank_account" ? "Bank account" : "Card";
  return `${brand} ending ${c.last4 ?? "????"}`;
}
