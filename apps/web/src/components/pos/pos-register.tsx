"use client";

import { Minus, Plus, ScanBarcode, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { selectClass } from "@/components/forms/select-field";
import { parseMoney } from "@/lib/curriculum";
import {
  addTender, cancelSale, openSale, posHouseholdInfo, quoteCart, searchPosHouseholds, searchPosItems, tenderCardOnFile, tenderTerminal,
  type PosHousehold, type PosItem, type PosQuote, type TenderResult,
} from "@/server/actions/pos";

interface CartLine {
  variantId: string;
  label: string;
  priceCents: number;
  qty: number;
  discount: string; // "10%" or "5.00"
}

interface OpenSaleState {
  saleId: string;
  totalCents: number;
  balanceCents: number;
  tenders: { method: string; amountCents: number; changeCents: number }[];
  receiptNumber: number | null;
}

type Tender = "cash" | "check" | "external" | "card" | "terminal" | "credit";

function discountCents(line: CartLine): number {
  const d = line.discount.trim();
  if (!d) return 0;
  const gross = line.priceCents * line.qty;
  if (d.endsWith("%")) {
    const pct = Number(d.slice(0, -1));
    return Number.isFinite(pct) ? Math.round((gross * Math.min(100, Math.max(0, pct))) / 100) : 0;
  }
  return Math.min(gross, parseMoney(d) ?? 0);
}

export function PosRegister(props: {
  locationId: string;
  currency: string;
  drawerOpen: boolean;
  readers: { id: string; label: string }[];
  stripeReady: boolean;
}) {
  const { locationId, currency } = props;
  const money = (c: number) => formatMoney(c, currency);
  const router = useRouter();
  const scanRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PosItem[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [quote, setQuote] = useState<PosQuote | null>(null);
  const [hhQuery, setHhQuery] = useState("");
  const [hhResults, setHhResults] = useState<{ id: string; name: string }[]>([]);
  const [household, setHousehold] = useState<PosHousehold | null>(null);
  const [sale, setSale] = useState<OpenSaleState | null>(null);
  const [tender, setTender] = useState<Tender>("cash");
  const [amount, setAmount] = useState("");
  const [cardId, setCardId] = useState("");
  const [readerId, setReaderId] = useState(props.readers[0]?.id ?? "");
  const [attemptKey, setAttemptKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const add = (item: PosItem) => {
    setCart((c) => {
      const i = c.findIndex((l) => l.variantId === item.variantId);
      if (i >= 0) return c.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { variantId: item.variantId, label: `${item.name}${item.size ? ` (${item.size})` : ""}`, priceCents: item.priceCents, qty: 1, discount: "" }];
    });
  };

  useEffect(() => {
    if (!cart.length) return;
    const lines = cart.map((l) => ({ variantId: l.variantId, qty: l.qty, discountCents: discountCents(l) }));
    let live = true;
    quoteCart({ locationId, lines }).then((r) => {
      if (!live) return;
      if (r.ok) setQuote(r.data);
      else setError(r.error);
    });
    return () => { live = false; };
  }, [cart, locationId]);

  const search = (value: string, scan = false) => {
    setQ(value);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    start(async () => {
      const r = await searchPosItems({ q: value, locationId });
      if (!r.ok) return;
      const hit = r.data[0];
      // A scanner sends the code then Enter: an exact barcode/SKU match goes straight into the cart.
      if (scan && hit && (hit.barcode === value.trim() || hit.sku.toLowerCase() === value.trim().toLowerCase())) {
        add(hit);
        setQ("");
        setResults([]);
        return;
      }
      setResults(r.data);
    });
  };

  const attach = (id: string) => start(async () => {
    const r = await posHouseholdInfo(id);
    if (r.ok) {
      setHousehold(r.data);
      setCardId(r.data.cards.find((c) => c.is_default)?.id ?? r.data.cards[0]?.id ?? "");
      setHhResults([]);
      setHhQuery("");
    } else toast.error(r.error);
  });

  const checkout = () => start(async () => {
    setError(null);
    const r = await openSale({ locationId, householdId: household?.id ?? null, lines: cart.map((l) => ({ variantId: l.variantId, qty: l.qty, discountCents: discountCents(l) })) });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setSale({ saleId: r.data.saleId, totalCents: r.data.totalCents, balanceCents: r.data.totalCents, tenders: [], receiptNumber: null });
    setAmount((r.data.totalCents / 100).toFixed(2));
    setTender(props.drawerOpen ? "cash" : "check");
  });

  const applyResult = (method: string, res: TenderResult, tenderedCents: number) => {
    setSale((s) => s && {
      ...s,
      balanceCents: res.balanceCents,
      receiptNumber: res.receiptNumber,
      tenders: [...s.tenders, { method, amountCents: tenderedCents, changeCents: res.changeCents }],
    });
    setAmount((res.balanceCents / 100).toFixed(2));
    setAttemptKey(crypto.randomUUID());
    if (res.completed) {
      toast.success(res.changeCents ? `Sale complete — change ${money(res.changeCents)}` : "Sale complete");
      router.refresh();
    }
  };

  const takeTender = () => {
    if (!sale) return;
    const cents = parseMoney(amount);
    if (!cents) {
      setError("Enter an amount");
      return;
    }
    setError(null);
    start(async () => {
      const r = tender === "card"
        ? await tenderCardOnFile({ saleId: sale.saleId, paymentMethodId: cardId, amountCents: Math.min(cents, sale.balanceCents), attemptKey })
        : tender === "terminal"
          ? await tenderTerminal({ saleId: sale.saleId, readerId, amountCents: Math.min(cents, sale.balanceCents), attemptKey })
          : await addTender({ saleId: sale.saleId, method: tender, amountCents: tender === "cash" ? Math.min(cents, sale.balanceCents) : cents, tenderedCents: tender === "cash" ? cents : undefined });
      if (!r.ok) {
        setError(r.error);
        setAttemptKey(crypto.randomUUID());
        return;
      }
      applyResult(tender, r.data, cents);
    });
  };

  const reset = () => {
    setCart([]);
    setQuote(null);
    setHousehold(null);
    setSale(null);
    setError(null);
    setAmount("");
    scanRef.current?.focus();
  };

  const completed = sale && sale.balanceCents === 0;
  const change = sale?.tenders.reduce((s, t) => s + t.changeCents, 0) ?? 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
      <section className="space-y-3 rounded-xl border border-default bg-surface p-4" aria-labelledby="items-h">
        <h2 id="items-h" className="sr-only">Items</h2>
        <form onSubmit={(e) => { e.preventDefault(); search(q, true); }} className="flex gap-2">
          <div className="relative flex-1">
            <ScanBarcode aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-fg-muted" />
            <Label htmlFor="pos-scan" className="sr-only">Scan or search items</Label>
            <Input id="pos-scan" ref={scanRef} autoFocus value={q} disabled={Boolean(sale)} onChange={(e) => search(e.target.value)} placeholder="Scan a barcode or search by name / SKU" className="h-12 pl-11 text-base" autoComplete="off" />
          </div>
        </form>
        {results.length ? (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Search results">
            {results.map((i) => (
              <li key={i.variantId}>
                <button type="button" onClick={() => add(i)} disabled={Boolean(sale)} title={i.sku} className="flex w-full flex-col gap-1 rounded-lg border border-default p-3 text-left hover:border-strong disabled:opacity-50">
                  <span className="font-medium leading-tight">{i.name}{i.size ? <span className="text-fg-secondary"> · {i.size}</span> : null}</span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="whitespace-nowrap text-xs text-fg-muted">{i.onHand} in stock</span>
                    <span className="tabular font-semibold">{money(i.priceCents)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : q && !pending ? <p className="text-sm text-fg-muted">No matches.</p> : null}
      </section>

      <aside className="space-y-3 rounded-xl border border-default bg-surface p-4" aria-labelledby="cart-h">
        <div className="flex items-center gap-2">
          <h2 id="cart-h" className="flex-1 text-base font-semibold">Sale</h2>
          {!sale && cart.length ? <Button size="sm" variant="ghost" onClick={reset}>Clear</Button> : null}
        </div>

        {household ? (
          <div className="flex items-center gap-2 rounded-lg bg-elevated px-3 py-2 text-sm">
            <span className="flex-1">Customer: <strong>{household.name}</strong>{household.creditCents ? ` · ${money(household.creditCents)} credit` : ""}</span>
            {!sale ? <Button size="sm" variant="ghost" aria-label="Remove customer" onClick={() => setHousehold(null)}><X className="size-4" /></Button> : null}
          </div>
        ) : null}
        {household && household.sizes.some((s) => s.uniformSize) && !sale ? (
          <ul className="space-y-1 text-sm" aria-label="Sizes on file">
            {household.sizes.filter((s) => s.uniformSize).map((s) => (
              <li key={s.name} className="flex items-center gap-2">
                <span className="flex-1">{s.name}: uniform {s.uniformSize}{s.beltSize ? `, belt ${s.beltSize}` : ""}</span>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => {
                  const r = await searchPosItems({ q: `DOBOK-${s.uniformSize}`, locationId });
                  const hit = r.ok ? r.data.find((i) => i.sku?.toUpperCase() === `DOBOK-${s.uniformSize}`.toUpperCase()) : undefined;
                  if (hit) add(hit); else toast.error(`No dobok in size ${s.uniformSize} in stock here.`);
                })}>Add dobok ({s.uniformSize}) for {s.name}</Button>
              </li>
            ))}
          </ul>
        ) : null}
        {!household && !sale ? (
          <div className="relative">
            <Label htmlFor="pos-household" className="sr-only">Attach a household</Label>
            <Input id="pos-household" value={hhQuery} placeholder="Attach a household (optional)"
              onChange={(e) => { const v = e.target.value; setHhQuery(v); start(async () => { const r = await searchPosHouseholds(v); setHhResults(r.ok ? r.data : []); }); }} />
            {hhResults.length ? (
              <ul className="absolute z-10 mt-1 w-full rounded-md border border-default bg-surface shadow-kg-sm" aria-label="Households">
                {hhResults.map((h) => <li key={h.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-elevated" onClick={() => attach(h.id)}>{h.name}</button></li>)}
              </ul>
            ) : null}
          </div>
        ) : null}

        {!cart.length ? <p className="py-6 text-center text-sm text-fg-muted">Scan or pick items to start a sale.</p> : (
          <ul className="divide-y divide-default" aria-label="Cart">
            {cart.map((l, i) => {
              const priced = quote?.lines[i];
              return (
                <li key={l.variantId} aria-label={l.label} className="space-y-1 py-2">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{l.label}</span>
                    <span className="tabular text-sm">{money(priced?.totalCents ?? l.priceCents * l.qty)}</span>
                  </div>
                  {!sale ? (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" className="size-8 p-0" aria-label={`One fewer ${l.label}`} onClick={() => setCart((c) => c.map((x, j) => (j === i ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))}><Minus className="size-4" /></Button>
                      <span className="w-8 text-center tabular" aria-label={`Quantity of ${l.label}`}>{l.qty}</span>
                      <Button size="sm" variant="outline" className="size-8 p-0" aria-label={`One more ${l.label}`} onClick={() => setCart((c) => c.map((x, j) => (j === i ? { ...x, qty: x.qty + 1 } : x)))}><Plus className="size-4" /></Button>
                      <Input aria-label={`Discount for ${l.label}`} value={l.discount} placeholder="Discount" className="ml-2 h-8 w-28 text-xs"
                        onChange={(e) => { const v = e.target.value; setCart((c) => c.map((x, j) => (j === i ? { ...x, discount: v } : x))); }} />
                      <Button size="sm" variant="ghost" className="ml-auto size-8 p-0 text-danger" aria-label={`Remove ${l.label}`} onClick={() => setCart((c) => c.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
                    </div>
                  ) : <span className="text-xs text-fg-muted">× {l.qty}{priced?.discountCents ? ` · −${money(priced.discountCents)}` : ""}</span>}
                </li>
              );
            })}
          </ul>
        )}

        {quote && cart.length ? (
          <dl className="space-y-1 border-t border-default pt-2 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular">{money(quote.subtotalCents)}</dd></div>
            {quote.discountCents ? <div className="flex justify-between"><dt>Discounts</dt><dd className="tabular">−{money(quote.discountCents)}</dd></div> : null}
            <div className="flex justify-between"><dt>Tax</dt><dd className="tabular">{money(quote.taxCents)}</dd></div>
            <div className="flex justify-between text-lg font-semibold"><dt>Total</dt><dd className="tabular">{money(quote.totalCents)}</dd></div>
          </dl>
        ) : null}

        {!sale ? (
          <Button className="h-12 w-full text-base" disabled={!cart.length || pending || !quote} onClick={checkout}>Charge {quote ? money(quote.totalCents) : ""}</Button>
        ) : completed ? (
          <div className="space-y-2 rounded-lg bg-elevated p-3" role="status">
            <p className="font-semibold">Sale complete · receipt {sale.receiptNumber}</p>
            {change ? <p className="text-2xl font-bold tabular">Change {money(change)}</p> : null}
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm"><Link href={`/desk/pos/sales/${sale.saleId}`}>Receipt</Link></Button>
              <Button size="sm" onClick={reset}>New sale</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border border-default p-3">
            <p className="flex justify-between text-sm"><span>Balance due</span><strong className="tabular text-lg" aria-label="Balance due">{money(sale.balanceCents)}</strong></p>
            <fieldset className="grid grid-cols-3 gap-1 text-sm">
              <legend className="sr-only">Tender</legend>
              {([["cash", "Cash", props.drawerOpen], ["check", "Check", true], ["external", "Other", true],
                ["card", "Card on file", props.stripeReady && Boolean(household?.cards.length)], ["terminal", "Card reader", props.stripeReady && props.readers.length > 0],
                ["credit", "Credit", Boolean(household?.creditCents)]] as const).map(([m, label, enabled]) => (
                <label key={m} className={`flex cursor-pointer items-center justify-center rounded-md border px-2 py-2 text-center ${tender === m ? "border-primary bg-primary/10" : "border-default"} ${enabled ? "" : "cursor-not-allowed opacity-40"}`}>
                  <input type="radio" name="tender" value={m} className="sr-only" checked={tender === m} disabled={!enabled} onChange={() => setTender(m)} />
                  {label}
                </label>
              ))}
            </fieldset>
            {!props.drawerOpen ? <p className="text-xs text-fg-muted">Open the cash drawer to take cash.</p> : null}
            {tender === "card" && household ? (
              <select aria-label="Card" className={selectClass} value={cardId} onChange={(e) => setCardId(e.target.value)}>
                {household.cards.map((c) => <option key={c.id} value={c.id} className="bg-surface">{(c.brand ?? "Card")} ending {c.last4}</option>)}
              </select>
            ) : null}
            {tender === "terminal" ? (
              <select aria-label="Card reader" className={selectClass} value={readerId} onChange={(e) => setReaderId(e.target.value)}>
                {props.readers.map((r) => <option key={r.id} value={r.id} className="bg-surface">{r.label}</option>)}
              </select>
            ) : null}
            <div className="space-y-1">
              <Label htmlFor="pos-amount">{tender === "cash" ? "Cash received" : "Amount"}</Label>
              <Input id="pos-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 text-lg" />
              {tender === "cash" ? (
                <div className="flex flex-wrap gap-1">
                  {[...new Set([sale.balanceCents, Math.ceil(sale.balanceCents / 500) * 500, Math.ceil(sale.balanceCents / 2000) * 2000, Math.ceil(sale.balanceCents / 5000) * 5000])].map((c) => (
                    <Button key={c} type="button" size="sm" variant="outline" onClick={() => setAmount((c / 100).toFixed(2))}>{money(c)}</Button>
                  ))}
                </div>
              ) : null}
              {tender === "cash" && (parseMoney(amount) ?? 0) > sale.balanceCents ? <p className="text-sm">Change: <strong className="tabular">{money((parseMoney(amount) ?? 0) - sale.balanceCents)}</strong></p> : null}
            </div>
            <Button className="h-11 w-full" disabled={pending} onClick={takeTender}>{pending ? "Working…" : tender === "terminal" ? "Send to reader" : "Take payment"}</Button>
            {sale.tenders.length ? (
              <ul className="text-xs text-fg-secondary" aria-label="Tenders">
                {sale.tenders.map((t, i) => <li key={i} className="capitalize">{t.method}: {money(t.amountCents)}{t.changeCents ? ` (change ${money(t.changeCents)})` : ""}</li>)}
              </ul>
            ) : (
              <Button variant="ghost" size="sm" className="w-full text-danger" disabled={pending} onClick={() => start(async () => { const r = await cancelSale(sale.saleId); if (r.ok) { setSale(null); toast.success("Sale cancelled"); } else setError(r.error); })}>Cancel sale</Button>
            )}
          </div>
        )}
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      </aside>
    </div>
  );
}
