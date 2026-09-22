"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { RankBadge } from "@koryo/ui/components/app/rank-badge";
import { Button } from "@koryo/ui/components/ui/button";
import { Checkbox } from "@koryo/ui/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@koryo/ui/components/ui/dialog";
import { Form } from "@koryo/ui/components/ui/form";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { FormError } from "@/components/forms/form-error";
import { TextField } from "@/components/forms/text-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { CATEGORY_LABELS, type SkillCategory } from "@/lib/curriculum";
import { rankSchema, type RankInput } from "@/lib/validation/curriculum";
import { deleteRank, reorderRanks, saveRank, saveRequirement } from "@/server/actions/curriculum";

export interface LadderRank {
  id: string;
  name: string;
  beltColor: string;
  position: number;
  stripesMax: number;
  testingFeeCents: number;
  requirement: { minClasses: number; minDays: number; approval: boolean; notes: string } | null;
  skillIds: string[];
}
export interface LadderSkill {
  id: string;
  name: string;
  category: string;
  shared: boolean;
}

function RankDialog({ programId, rank, trigger }: { programId: string; rank?: LadderRank; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const initial: RankInput = rank
    ? { id: rank.id, programId, name: rank.name, beltColor: rank.beltColor, stripesMax: rank.stripesMax, testingFee: (rank.testingFeeCents / 100).toFixed(2) }
    : { programId, name: "", beltColor: "#f5f5f5", stripesMax: 0, testingFee: "0" };
  const { form, pending, submit } = useActionForm({
    schema: rankSchema,
    defaultValues: initial,
    action: saveRank,
    onSuccess: () => { toast.success(rank ? "Rank saved" : "Rank added"); setOpen(false); if (!rank) form.reset(initial); },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{rank ? `Edit ${rank.name}` : "Add a rank"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <TextField form={form} name="name" label="Rank name" placeholder="Yellow belt (9th gup)" />
            <div className="grid grid-cols-3 gap-3">
              <TextField form={form} name="beltColor" label="Belt colour" type="color" className="h-9 p-1" />
              <TextField form={form} name="stripesMax" label="Stripes" type="number" min={0} max={10} />
              <TextField form={form} name="testingFee" label="Testing fee" inputMode="decimal" />
            </div>
            <FormError form={form} />
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : rank ? "Save rank" : "Add rank"}</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function RequirementsDialog({ programId, rank, skills }: { programId: string; rank: LadderRank; skills: LadderSkill[] }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({
    minClasses: String(rank.requirement?.minClasses ?? 0),
    minDays: String(rank.requirement?.minDays ?? 0),
    approval: rank.requirement?.approval ?? false,
    notes: rank.requirement?.notes ?? "",
    skillIds: new Set(rank.skillIds),
  });
  const [pending, start] = useTransition();
  const grouped = Object.entries(
    skills.reduce<Record<string, LadderSkill[]>>((acc, s) => ((acc[s.category] ??= []).push(s), acc), {}),
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1"><ListChecks aria-hidden className="size-4" /> Requirements</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Requirements for {rank.name}</DialogTitle>
          <DialogDescription>What a student must reach, since their last promotion, to test for this rank.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveRequirement({
                programId, rankId: rank.id, minClasses: Number(v.minClasses), minDays: Number(v.minDays),
                requiresApproval: v.approval, notes: v.notes, skillIds: [...v.skillIds],
              });
              if (r.ok) { toast.success("Requirements saved"); setOpen(false); } else toast.error(r.error);
            });
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor={`mc-${rank.id}`}>Minimum classes</Label><Input id={`mc-${rank.id}`} type="number" min={0} value={v.minClasses} onChange={(e) => setV({ ...v, minClasses: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor={`md-${rank.id}`}>Minimum days</Label><Input id={`md-${rank.id}`} type="number" min={0} value={v.minDays} onChange={(e) => setV({ ...v, minDays: e.target.value })} /></div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id={`ap-${rank.id}`} checked={v.approval} onCheckedChange={(c) => setV({ ...v, approval: Boolean(c) })} />
            <Label htmlFor={`ap-${rank.id}`} className="font-normal">Requires instructor approval</Label>
          </div>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Required skills</legend>
            {grouped.length === 0 ? <p className="text-sm text-fg-muted">No skills yet — add them in Curriculum.</p> : null}
            {grouped.map(([cat, list]) => (
              <div key={cat}>
                <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">{CATEGORY_LABELS[cat as SkillCategory] ?? cat}</p>
                <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                  {list.map((s) => (
                    <li key={s.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`sk-${rank.id}-${s.id}`}
                        checked={v.skillIds.has(s.id)}
                        onCheckedChange={(c) => {
                          const next = new Set(v.skillIds);
                          if (c) next.add(s.id); else next.delete(s.id);
                          setV({ ...v, skillIds: next });
                        }}
                      />
                      <Label htmlFor={`sk-${rank.id}-${s.id}`} className="font-normal">{s.name}{s.shared ? " (shared)" : ""}</Label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </fieldset>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save requirements"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RankRow({ programId, rank, index, count, skills, canWrite, onMove }: {
  programId: string; rank: LadderRank; index: number; count: number; skills: LadderSkill[]; canWrite: boolean; onMove: (from: number, to: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rank.id, disabled: !canWrite });
  const [pending, start] = useTransition();
  const req = rank.requirement;
  const summary = req
    ? [`${req.minClasses} classes`, `${req.minDays} days`, `${rank.skillIds.length} skill${rank.skillIds.length === 1 ? "" : "s"}`, req.approval ? "approval" : null].filter(Boolean).join(" · ")
    : rank.position === 1 ? "Starting rank" : "No requirements set";
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-wrap items-center gap-2 rounded-lg border border-default bg-surface p-3 ${isDragging ? "z-10 shadow-kg-lg" : ""}`}
      aria-label={`${rank.position}. ${rank.name}`}
    >
      {canWrite ? (
        <button type="button" className="cursor-grab rounded p-1 text-fg-muted hover:text-fg" aria-label={`Drag ${rank.name}`} {...attributes} {...listeners}>
          <GripVertical className="size-4" />
        </button>
      ) : null}
      <span className="w-6 text-right text-sm tabular text-fg-muted">{rank.position}</span>
      <RankBadge name={rank.name} beltColor={rank.beltColor} stripesMax={rank.stripesMax} />
      <span className="min-w-0 flex-1 text-xs text-fg-secondary">{summary}{rank.testingFeeCents ? ` · fee ${formatMoney(rank.testingFeeCents)}` : ""}</span>
      {canWrite ? (
        <div className="flex flex-wrap items-center gap-1">
          <Button variant="ghost" size="icon" aria-label={`Move ${rank.name} up`} disabled={index === 0 || pending} onClick={() => onMove(index, index - 1)}><ArrowUp className="size-4" /></Button>
          <Button variant="ghost" size="icon" aria-label={`Move ${rank.name} down`} disabled={index === count - 1 || pending} onClick={() => onMove(index, index + 1)}><ArrowDown className="size-4" /></Button>
          {rank.position > 1 ? <RequirementsDialog programId={programId} rank={rank} skills={skills} /> : null}
          <RankDialog programId={programId} rank={rank} trigger={<Button variant="ghost" size="icon" aria-label={`Edit ${rank.name}`}><Pencil className="size-4" /></Button>} />
          <Button
            variant="ghost" size="icon" className="text-danger" aria-label={`Delete ${rank.name}`} disabled={pending}
            onClick={() => start(async () => { const r = await deleteRank({ rankId: rank.id, programId }); if (r.ok) toast.success(`Deleted ${rank.name}`); else toast.error(r.error); })}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ) : null}
    </li>
  );
}

export function LadderEditor({ programId, ranks, skills, canWrite }: { programId: string; ranks: LadderRank[]; skills: LadderSkill[]; canWrite: boolean }) {
  // Stable id: dnd-kit otherwise numbers its a11y ids globally and SSR/CSR hydration disagrees.
  const dndId = useId();
  const [order, setOrder] = useState(ranks);
  const [synced, setSynced] = useState(ranks);
  if (synced !== ranks) {
    // Server data changed (add/edit/delete): adopt it.
    setSynced(ranks);
    setOrder(ranks);
  }
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const commit = (next: LadderRank[]) => {
    const prev = order;
    const renumbered = next.map((r, i) => ({ ...r, position: i + 1 }));
    setOrder(renumbered);
    void reorderRanks({ programId, rankIds: renumbered.map((r) => r.id) }).then((res) => {
      if (!res.ok) { setOrder(prev); toast.error(res.error); }
    });
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = order.findIndex((r) => r.id === e.active.id);
    const to = order.findIndex((r) => r.id === e.over?.id);
    commit(arrayMove(order, from, to));
  };

  return (
    <section aria-labelledby="ladder-h" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="ladder-h" className="text-lg font-semibold">Rank ladder</h2>
        {canWrite ? <RankDialog programId={programId} trigger={<Button size="sm" className="gap-2"><Plus aria-hidden className="size-4" /> Add rank</Button>} /> : null}
      </div>
      {order.length === 0 ? (
        <p className="rounded-lg border border-dashed border-default p-6 text-center text-sm text-fg-secondary">No ranks yet. Add the first rank of this ladder.</p>
      ) : (
        <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <ol className="space-y-2" aria-label="Ranks in order">
              {order.map((r, i) => (
                <RankRow key={r.id} programId={programId} rank={r} index={i} count={order.length} skills={skills} canWrite={canWrite} onMove={(from, to) => commit(arrayMove(order, from, to))} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}
