"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { deactivateTemplate } from "@/server/actions/schedule";

export function EndTemplateButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" className="text-danger" disabled={pending}
      onClick={() => { if (window.confirm(`End ${name}? Future sessions without bookings are removed.`)) start(async () => { const r = await deactivateTemplate({ id }); if (r.ok) toast.success(`${name} ended`); else toast.error(r.error); }); }}>
      End class
    </Button>
  );
}
