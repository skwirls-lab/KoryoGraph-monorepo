"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { fileLink } from "@/server/actions/documents";

/** Opens a private file through a short-lived signed URL (Storage RLS decides access). */
export function FileLink({ path, label }: { path: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="link" size="sm" className="h-auto p-0" disabled={pending}
      onClick={() => start(async () => { const r = await fileLink({ path }); if (r.ok) window.open(r.data.url, "_blank", "noopener"); else toast.error(r.error); })}>
      {label}
    </Button>
  );
}
