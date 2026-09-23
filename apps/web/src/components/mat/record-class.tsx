"use client";

import { Mic, Square, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { Label } from "@koryo/ui/components/ui/label";
import { selectClass } from "@/components/forms/select-field";
import { submitClassNotes, uploadRecording } from "@/server/actions/recordings";

export interface RecordingRow { id: string; source: string; status: string; error: string | null; createdAt: string; approvalId: string | null; approvalStatus: string | null }

const STATUS: Record<string, string> = { uploaded: "Waiting to transcribe", transcribing: "Transcribing…", transcribed: "Transcribed", analyzing: "Building the board…", ready: "Board ready", failed: "Failed" };

export function RecordClass({ sessionId, gaps, recordings }: { sessionId: string; gaps: string[]; recordings: RecordingRow[] }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState<"record" | "notes">(gaps.length ? "notes" : "record");
  const [pending, start] = useTransition();
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const router = useRouter();
  const busy = recordings.some((r) => ["uploaded", "transcribing", "analyzing"].includes(r.status));

  useEffect(() => {
    if (!recording) return;
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [recording]);
  useEffect(() => {
    if (!busy) return;
    const t = window.setInterval(() => router.refresh(), 5000);
    return () => window.clearInterval(t);
  }, [busy, router]);

  const upload = (blob: Blob, name: string) => start(async () => {
    const f = new FormData();
    f.set("sessionId", sessionId);
    f.set("file", new File([blob], name, { type: blob.type || "audio/webm" }));
    const r = await uploadRecording(f);
    if (r.ok) toast.success("Uploaded — transcribing"); else toast.error(r.error);
    router.refresh();
  });
  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : undefined, audioBitsPerSecond: 24_000 });
      chunks.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      mr.onstop = () => { stream.getTracks().forEach((t) => t.stop()); upload(new Blob(chunks.current, { type: mr.mimeType }), `class-${Date.now()}.webm`); };
      mr.start(1000);
      rec.current = mr;
      setSeconds(0);
      setRecording(true);
    } catch {
      toast.error("The microphone isn't available. Allow access, upload a file, or type notes instead.");
    }
  };

  return (
    <section aria-labelledby="record-h" className="space-y-3 rounded-xl border border-default bg-surface p-4">
      <h2 id="record-h" className="font-semibold">After class: action board</h2>
      <p className="text-sm text-fg-secondary">Record the class or jot down what happened; KoryoGraph drafts attendance, skill notes, injuries and follow-ups for you to approve. Nothing is saved until you approve.</p>
      {gaps.length ? (
        <p role="note" className="rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
          Recording is off for this class: no AI-processing consent for {gaps.join(", ")}. Take attendance on the roster, or type notes without recording.
        </p>
      ) : null}
      <div className="flex gap-1" role="group" aria-label="How">
        <Button size="sm" variant={mode === "record" ? "secondary" : "ghost"} disabled={Boolean(gaps.length)} onClick={() => setMode("record")}>Record</Button>
        <Button size="sm" variant={mode === "notes" ? "secondary" : "ghost"} onClick={() => setMode("notes")}>Type notes</Button>
      </div>
      {mode === "record" ? (
        <div className="flex flex-wrap items-center gap-2">
          {!recording ? <Button className="gap-2" disabled={pending || Boolean(gaps.length)} onClick={() => void startRec()}><Mic aria-hidden className="size-4" /> Record class</Button>
            : <Button variant="destructive" className="gap-2" onClick={() => { rec.current?.stop(); setRecording(false); }}><Square aria-hidden className="size-4" /> Stop ({Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")})</Button>}
          <label className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-default px-3 py-2 text-sm ${gaps.length ? "pointer-events-none opacity-50" : ""}`}>
            <Upload aria-hidden className="size-4" /> Upload audio
            <input type="file" accept="audio/*" className="sr-only" disabled={Boolean(gaps.length) || pending} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, f.name); e.target.value = ""; }} />
          </label>
        </div>
      ) : (
        <form className="space-y-2" onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await submitClassNotes({ sessionId, notes });
            if (!r.ok) { toast.error(r.error); router.refresh(); return; }
            router.push(`/mat/session/${sessionId}/board`);
          });
        }}>
          <Label htmlFor="class-notes">What happened in class?</Label>
          <textarea id="class-notes" className={`${selectClass} h-32 py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Maya and Leo were here. Leo nailed his low block — sign it off. Riley twisted an ankle…" />
          <Button type="submit" disabled={pending || notes.trim().length < 10}>{pending ? "Building the board…" : "Build the board"}</Button>
        </form>
      )}
      {recordings.length ? (
        <ul className="divide-y divide-default text-sm" aria-label="Recordings">
          {recordings.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
              <span>{r.source === "notes" ? "Typed notes" : "Recording"} · {new Date(r.createdAt).toLocaleTimeString("en-US", { timeStyle: "short" })}</span>
              <Badge variant={r.status === "failed" ? "destructive" : r.status === "ready" ? "secondary" : "outline"}>{r.approvalStatus && r.approvalStatus !== "pending" ? r.approvalStatus : STATUS[r.status] ?? r.status}</Badge>
              {r.error ? <span className="w-full text-xs text-danger">{r.error}</span> : null}
              {r.status === "ready" && r.approvalStatus === "pending" ? <Link href={`/mat/session/${sessionId}/board`} className="ml-auto">Open board</Link> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
