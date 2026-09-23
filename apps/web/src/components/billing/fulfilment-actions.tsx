"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { setFulfilmentStatus } from "@/server/actions/billing";

export function FulfilmentActions({ id, status }: { id: string; status: "pending" | "ready" | "delivered" }) {
  const [pending, start] = useTransition();
  const set = (next: "pending" | "ready" | "delivered", msg: string) =>
    start(async () => { const r = await setFulfilmentStatus({ id, status: next }); if (r.ok) toast.success(msg); else toast.error(r.error); });
  return (
    <div className="flex gap-2">
      {status === "pending" ? <Button size="sm" variant="outline" disabled={pending} onClick={() => set("ready", "Marked ready")}>Mark ready</Button> : null}
      {status !== "delivered" ? <Button size="sm" disabled={pending} onClick={() => set("delivered", "Marked delivered")}>Delivered</Button> : null}
      {status === "delivered" ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => set("pending", "Reopened")}>Reopen</Button> : null}
    </div>
  );
}
