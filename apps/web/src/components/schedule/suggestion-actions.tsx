"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { setSuggestionStatus } from "@/server/actions/schedule-suggestions";

export function SuggestionActions({ id, title }: { id: string; title: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = (status: "done" | "dismissed") => start(async () => {
    const r = await setSuggestionStatus({ id, status });
    if (r.ok) router.refresh(); else toast.error(r.error);
  });
  return (
    <div className="flex gap-1">
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => set("done")} aria-label={`Mark done: ${title}`}>Done</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => set("dismissed")} aria-label={`Dismiss: ${title}`}>Dismiss</Button>
    </div>
  );
}
