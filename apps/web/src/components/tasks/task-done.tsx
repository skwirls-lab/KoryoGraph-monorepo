"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { completeTask } from "@/server/actions/tasks";

export function TaskDone({ taskId, title }: { taskId: string; title: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <input type="checkbox" aria-label={`Mark done: ${title}`} disabled={pending} className="size-4 accent-[var(--color-primary)]"
      onChange={() => start(async () => {
        const r = await completeTask({ taskId, done: true });
        if (!r.ok) toast.error(r.error);
        router.refresh();
      })} />
  );
}
