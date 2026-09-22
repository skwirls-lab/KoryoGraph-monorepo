"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { requestExport } from "@/server/actions/exports";

export function ExportButton() {
  const [pending, start] = useTransition();
  return (
    <Button disabled={pending} onClick={() => start(async () => { const r = await requestExport(); if (!r.ok) toast.error(r.error); else toast.success(r.data.status === "ready" ? "Your export is ready" : "Export started — it will appear below shortly"); })}>
      {pending ? "Preparing…" : "Export all data"}
    </Button>
  );
}
