"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { revokeKiosk } from "@/server/actions/kiosk";

export function RevokeKiosk({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="ghost" className="text-danger" disabled={pending}
      onClick={() => start(async () => { const r = await revokeKiosk({ id }); if (r.ok) toast.success(`${name} revoked`); else toast.error(r.error); })}>
      Revoke
    </Button>
  );
}
