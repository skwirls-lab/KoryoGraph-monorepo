import Link from "next/link";

const TABS = [
  { href: "/desk/pos", label: "Point of sale" },
  { href: "/desk/retail/products", label: "Products" },
  { href: "/desk/retail/inventory", label: "Inventory" },
  { href: "/desk/retail/receive", label: "Receive" },
  { href: "/desk/retail/suppliers", label: "Suppliers" },
  { href: "/desk/retail/fulfilment", label: "Fulfilment" },
];

export function RetailTabs({ current }: { current: string }) {
  return (
    <nav aria-label="Retail" className="mb-4 flex flex-wrap gap-1">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.href === current ? "page" : undefined}
          className={`rounded-full px-3 py-1 text-sm no-underline ${t.href === current ? "bg-primary text-primary-foreground" : "bg-elevated text-fg-secondary"}`}>{t.label}</Link>
      ))}
    </nav>
  );
}
