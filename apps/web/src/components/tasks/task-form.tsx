"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { selectClass } from "@/components/forms/select-field";
import type { TaskInput } from "@/lib/validation/staff";
import { assignTask, createTask } from "@/server/actions/tasks";

export function TaskForm({ staff }: { staff: { id: string; name: string }[] }) {
  const empty: TaskInput = { title: "", body: "", assigneeUserId: "", dueDate: "", personId: "" };
  const [v, setV] = useState<TaskInput>(empty);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form className="flex flex-wrap items-end gap-2" aria-label="New task" onSubmit={(e) => {
      e.preventDefault();
      setError(null);
      start(async () => {
        const r = await createTask(v);
        if (!r.ok) { setError(r.fieldErrors?.title ?? r.error); return; }
        toast.success("Task added");
        setV(empty);
        router.refresh();
      });
    }}>
      <div className="min-w-60 flex-1 space-y-1"><Label htmlFor="t-title">Task</Label><Input id="t-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Call the Nguyen family about the camp" /></div>
      <div className="space-y-1"><Label htmlFor="t-assignee">Assign to</Label>
        <select id="t-assignee" className={`${selectClass} w-48`} value={v.assigneeUserId ?? ""} onChange={(e) => setV({ ...v, assigneeUserId: e.target.value })}>
          <option value="" className="bg-surface">Front desk queue</option>
          {staff.map((s) => <option key={s.id} value={s.id} className="bg-surface">{s.name}</option>)}
        </select>
      </div>
      <div className="space-y-1"><Label htmlFor="t-due">Due</Label><Input id="t-due" type="date" value={v.dueDate ?? ""} onChange={(e) => setV({ ...v, dueDate: e.target.value })} /></div>
      <Button type="submit" disabled={pending}>Add task</Button>
      {error ? <p role="alert" className="w-full text-sm text-danger">{error}</p> : null}
    </form>
  );
}

export function AssignSelect({ taskId, title, current, staff }: { taskId: string; title: string; current: string | null; staff: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <select aria-label={`Assign ${title}`} disabled={pending} className={`${selectClass} h-8 w-44 text-xs`} value={current ?? ""}
      onChange={(e) => start(async () => { const r = await assignTask({ taskId, assigneeUserId: e.target.value }); if (!r.ok) toast.error(r.error); router.refresh(); })}>
      <option value="" className="bg-surface">Unassigned</option>
      {staff.map((s) => <option key={s.id} value={s.id} className="bg-surface">{s.name}</option>)}
    </select>
  );
}
