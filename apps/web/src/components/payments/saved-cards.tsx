"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { removeCard, setDefaultCard } from "@/server/actions/payments";
import { removeMyCard } from "@/server/actions/wallet";
import { cardLabel } from "@/lib/payments";
import type { SavedCard } from "@/server/queries/payments";

export function SavedCards({ cards, canManage, canRemove, as = "staff" }: { cards: SavedCard[]; canManage: boolean; canRemove: boolean; as?: "staff" | "home" }) {
  const [pending, start] = useTransition();
  if (!cards.length) return <p className="text-sm text-fg-muted">No saved cards.</p>;
  return (
    <ul className="divide-y divide-default" aria-label="Saved cards">
      {cards.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-2 py-2">
          <span className="min-w-0 flex-1 text-sm">
            {cardLabel(c)}
            {c.exp_month && c.exp_year ? <span className="text-fg-muted"> · expires {String(c.exp_month).padStart(2, "0")}/{String(c.exp_year).slice(-2)}</span> : null}
          </span>
          {c.is_default ? <Badge variant="secondary">Default</Badge> : canManage ? (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await setDefaultCard(c.id); if (r.ok) toast.success("Default card changed"); else toast.error(r.error); })}>
              Make default
            </Button>
          ) : null}
          {canRemove ? (
            <Button size="sm" variant="ghost" className="text-danger" disabled={pending} aria-label={`Remove ${cardLabel(c)}`} onClick={() => start(async () => { const r = await (as === "home" ? removeMyCard : removeCard)(c.id); if (r.ok) toast.success("Card removed"); else toast.error(r.error); })}>
              Remove
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
