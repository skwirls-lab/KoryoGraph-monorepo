"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { resendCommunication } from "@/server/actions/messaging";

export function ResendButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await resendCommunication({ id }); if (r.ok) toast.success(r.data.status === "sent" ? "Sent" : "Still failing"); else toast.error(r.error); })}>
      Resend
    </Button>
  );
}
