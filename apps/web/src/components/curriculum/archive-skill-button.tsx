"use client";

import { Archive } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { archiveSkill } from "@/server/actions/curriculum";

export function ArchiveSkillButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="icon" aria-label={`Archive ${name}`} disabled={pending}
      onClick={() => start(async () => { const r = await archiveSkill({ id }); if (r.ok) toast.success(`Archived ${name}`); else toast.error(r.error); })}>
      <Archive className="size-4" />
    </Button>
  );
}
