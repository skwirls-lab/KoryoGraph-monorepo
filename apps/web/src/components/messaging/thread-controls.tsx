"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { assignThread, setThreadStatus } from "@/server/actions/messaging";

export function ThreadControls({ threadId, assignedUserId, status, staff }: { threadId: string; assignedUserId: string | null; status: string; staff: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs text-fg-secondary">Assigned to
        <select className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-fg" value={assignedUserId ?? ""} disabled={pending}
          onChange={(e) => start(async () => { const r = await assignThread({ threadId, userId: e.target.value || null }); if (!r.ok) toast.error(r.error); })}>
          <option value="" className="bg-surface">Unassigned</option>
          {staff.map((s) => <option key={s.id} value={s.id} className="bg-surface">{s.name}</option>)}
        </select>
      </label>
      <Button size="sm" variant="outline" disabled={pending}
        onClick={() => start(async () => { const r = await setThreadStatus({ threadId, status: status === "open" ? "closed" : "open" }); if (r.ok) toast.success(status === "open" ? "Closed" : "Reopened"); else toast.error(r.error); })}>
        {status === "open" ? "Close conversation" : "Reopen"}
      </Button>
    </div>
  );
}
