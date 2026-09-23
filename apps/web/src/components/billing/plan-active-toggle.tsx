"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { setPlanActive } from "@/server/actions/billing";

export function PlanActiveToggle({ id, active, name }: { id: string; active: boolean; name: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" disabled={pending} aria-label={`${active ? "Archive" : "Restore"} ${name}`}
      onClick={() => start(async () => { const r = await setPlanActive({ id, active: !active }); if (r.ok) toast.success(active ? "Plan archived" : "Plan restored"); else toast.error(r.error); })}>
      {active ? "Archive" : "Restore"}
    </Button>
  );
}
