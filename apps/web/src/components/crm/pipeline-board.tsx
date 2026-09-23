"use client";

import { DndContext, KeyboardSensor, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@koryo/ui/components/ui/dialog";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { selectClass } from "@/components/forms/select-field";
import { bookTrial, moveLead } from "@/server/actions/crm";

export interface BoardStage { id: string; key: string | null; name: string; kind: string }
export interface BoardLead {
  id: string;
  stageId: string;
  name: string;
  source: string | null;
  interest: string[];
  nextAction: string | null;
  /** 0–100 from lead scoring (null until scored) and the AI's suggested next step. */
  score: number | null;
  aiNextAction: string | null;
  nextActionDue: string | null;
  overdue: boolean;
  trial: string | null;
  lostReason: string | null;
}
export interface TrialSession { id: string; label: string }

function Card({ lead, stages, onMove }: { lead: BoardLead; stages: BoardStage[]; onMove: (lead: BoardLead, stage: BoardStage) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  return (
    <li ref={setNodeRef} aria-label={lead.name} style={{ transform: CSS.Translate.toString(transform) }}
      className={`rounded-lg border border-default bg-surface p-2.5 text-sm shadow-kg-sm ${isDragging ? "z-10 opacity-80" : ""}`}>
      <div className="flex items-start gap-1.5">
        <button type="button" className="mt-0.5 cursor-grab text-fg-muted" aria-label={`Drag ${lead.name}`} {...attributes} {...listeners}><GripVertical className="size-4" /></button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <Link href={`/desk/crm/leads/${lead.id}`} className="font-medium">{lead.name}</Link>
            {lead.score != null ? <span className="shrink-0 rounded-full border border-default px-1.5 text-xs tabular text-fg-secondary" title="Lead score (0–100)" aria-label={`Score ${lead.score}`}>{lead.score}</span> : null}
          </div>
          <div className="text-xs text-fg-muted">{[lead.source, ...lead.interest].filter(Boolean).join(" · ")}</div>
          {lead.trial ? <div className="text-xs text-fg-secondary">Trial: {lead.trial}</div> : null}
          {lead.nextAction ? <div className={`text-xs ${lead.overdue ? "text-danger" : "text-fg-secondary"}`}>Next: {lead.nextAction}{lead.nextActionDue ? ` · ${lead.nextActionDue}` : ""}</div> : null}
          {lead.aiNextAction && !lead.nextAction ? <div className="text-xs text-fg-secondary"><span className="text-fg-muted">Suggested:</span> {lead.aiNextAction}</div> : null}
          {lead.lostReason ? <div className="text-xs text-fg-muted">Lost: {lead.lostReason}</div> : null}
        </div>
      </div>
      <label className="mt-2 block">
        <span className="sr-only">Move {lead.name} to</span>
        <select className={`${selectClass} h-8 text-xs`} value={lead.stageId} onChange={(e) => { const s = stages.find((x) => x.id === e.target.value); if (s) onMove(lead, s); }}>
          {stages.map((s) => <option key={s.id} value={s.id} className="bg-surface">{s.name}</option>)}
        </select>
      </label>
    </li>
  );
}

function Column({ stage, leads, stages, onMove }: { stage: BoardStage; leads: BoardLead[]; stages: BoardStage[]; onMove: (lead: BoardLead, stage: BoardStage) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <section ref={setNodeRef} aria-labelledby={`st-${stage.id}`} data-stage={stage.key ?? stage.id}
      className={`flex w-64 shrink-0 flex-col rounded-xl border bg-elevated/40 p-2 ${isOver ? "border-primary" : "border-default"}`}>
      <h2 id={`st-${stage.id}`} className="mb-2 flex items-center justify-between px-1 text-sm font-semibold">
        {stage.name} <Badge variant="outline">{leads.length}</Badge>
      </h2>
      <ul className="min-h-24 space-y-2" aria-label={`${stage.name} leads`}>
        {leads.map((l) => <Card key={l.id} lead={l} stages={stages} onMove={onMove} />)}
      </ul>
      {!leads.length ? <p className="px-1 pb-1 text-xs text-fg-muted">No leads here — drag one in.</p> : null}
    </section>
  );
}

/** Kanban: drag a card (or use its stage menu). Trial scheduled asks for a class; Lost asks for a reason. */
export function PipelineBoard({ stages, leads: initial, sessions }: { stages: BoardStage[]; leads: BoardLead[]; sessions: TrialSession[] }) {
  const [leads, setLeads] = useState(initial);
  const [booking, setBooking] = useState<BoardLead | null>(null);
  const [losing, setLosing] = useState<{ lead: BoardLead; stage: BoardStage } | null>(null);
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const dndId = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));
  const [prev, setPrev] = useState(initial);
  if (prev !== initial) {
    setPrev(initial);
    setLeads(initial);
  }

  const onMove = (lead: BoardLead, stage: BoardStage) => {
    if (stage.id === lead.stageId) return;
    if (stage.key === "trial_scheduled" && !lead.trial) return setBooking(lead);
    if (stage.kind === "lost") return setLosing({ lead, stage });
    if (stage.kind === "won") {
      toast.info("Open the lead and use Convert to enroll them.");
      return;
    }
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, stageId: stage.id } : l)));
    start(async () => {
      const r = await moveLead({ leadId: lead.id, stageId: stage.id });
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });
  };
  const onDragEnd = (e: DragEndEvent) => {
    const lead = leads.find((l) => l.id === e.active.id);
    const stage = stages.find((s) => s.id === e.over?.id);
    if (lead && stage) onMove(lead, stage);
  };

  return (
    <>
      <DndContext id={dndId} sensors={sensors} collisionDetection={pointerWithin} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-3">
          {stages.map((s) => <Column key={s.id} stage={s} stages={stages} leads={leads.filter((l) => l.stageId === s.id)} onMove={onMove} />)}
        </div>
      </DndContext>
      <Dialog open={Boolean(booking)} onOpenChange={(o) => { if (!o) setBooking(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book a trial class</DialogTitle>
            <DialogDescription>{booking?.name} is booked into a real class; attending it moves them to Trial attended.</DialogDescription>
          </DialogHeader>
          {!sessions.length ? <p className="text-sm text-fg-muted">No bookable classes in the next two weeks.</p> : (
            <div className="space-y-3">
              <Label htmlFor="trial-session">Class</Label>
              <select id="trial-session" className={selectClass} value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
                {sessions.map((s) => <option key={s.id} value={s.id} className="bg-surface">{s.label}</option>)}
              </select>
              <Button className="w-full" disabled={pending || !sessionId} onClick={() => start(async () => {
                const r = await bookTrial({ leadId: booking?.id ?? "", sessionId });
                if (r.ok) { toast.success("Trial booked"); setBooking(null); } else toast.error(r.error);
                router.refresh();
              })}>Book trial</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(losing)} onOpenChange={(o) => { if (!o) { setLosing(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Why was {losing?.lead.name} lost?</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await moveLead({ leadId: losing?.lead.id ?? "", stageId: losing?.stage.id ?? "", lostReason: reason });
              if (r.ok) { setLosing(null); setReason(""); } else toast.error(r.error);
              router.refresh();
            });
          }}>
            <Label htmlFor="lost-reason">Reason</Label>
            <Input id="lost-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Price, schedule, went elsewhere…" maxLength={200} />
            <Button type="submit" disabled={pending}>Mark lost</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
