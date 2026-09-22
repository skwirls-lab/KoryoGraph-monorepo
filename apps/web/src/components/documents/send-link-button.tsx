"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { sendSigningLink } from "@/server/actions/documents";

export function SendLinkButton({ templateId, personId, label }: { templateId: string; personId: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="outline" disabled={pending} aria-label={`Email signing link: ${label}`}
      onClick={() => start(async () => {
        const r = await sendSigningLink({ templateId, personId });
        if (!r.ok) return void toast.error(r.error);
        const n = Object.entries(r.data).map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`).join(", ");
        toast.success(`Signing link: ${n || "no guardian email on file"}`);
      })}>
      Email signing link
    </Button>
  );
}
