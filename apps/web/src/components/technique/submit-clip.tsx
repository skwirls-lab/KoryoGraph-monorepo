"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createBrowserClient } from "@koryo/db/browser";
import { Button } from "@koryo/ui/components/ui/button";
import { Label } from "@koryo/ui/components/ui/label";
import { selectClass } from "@/components/forms/select-field";
import { MAX_CLIP_BYTES } from "@/lib/technique";
import { grantAiConsent, submitTechnique } from "@/server/actions/technique";

/** Read a video file's duration in the browser (the job re-checks it with ffmpeg). */
function videoDurationMs(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Math.round(v.duration * 1000)); };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file isn't a video this browser can read.")); };
    v.src = url;
  });
}

export function ConsentForm({ personId, skillId, name }: { personId: string; skillId: string; name: string }) {
  const [checked, setChecked] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form className="space-y-3 rounded-xl border border-warning/50 bg-warning/10 p-4 text-sm" onSubmit={(e) => {
      e.preventDefault();
      start(async () => { const r = await grantAiConsent({ personId, skillId }); if (r.ok) { toast.success("Consent recorded"); router.refresh(); } else toast.error(r.error); });
    }}>
      <p>{name} is under 18, so a parent or guardian needs to agree before a clip is analysed. Clips and the stills taken from them are stored by your school, analysed by an AI model, and reviewed by an instructor before {name} sees anything.</p>
      <label className="flex items-start gap-2"><input type="checkbox" className="mt-1 accent-[var(--color-primary)]" checked={checked} onChange={(e) => setChecked(e.target.checked)} /> I&apos;m {name}&apos;s parent or guardian and I consent to AI processing of their practice clips.</label>
      <Button type="submit" size="sm" disabled={!checked || pending}>Record consent</Button>
    </form>
  );
}

export function SubmitClip({ tenantId, personId, skillId }: { tenantId: string; personId: string; skillId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault();
      setError(null);
      if (!file) { setError("Choose a video."); return; }
      if (file.size > MAX_CLIP_BYTES) { setError("Clips can be up to 50 MB — trim it or record at a lower quality."); return; }
      start(async () => {
        let durationMs: number;
        try { durationMs = await videoDurationMs(file); } catch (err) { setError((err as Error).message); return; }
        if (durationMs > 60_500) { setError(`That clip is ${Math.round(durationMs / 1000)} seconds; please trim it to 60 seconds or less.`); return; }
        const ext = (file.name.split(".").pop() ?? "mp4").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 4) || "mp4";
        const path = `${tenantId}/technique/${personId}/${crypto.randomUUID()}.${ext}`;
        const { error: up } = await createBrowserClient().storage.from("tenant-media").upload(path, file, { contentType: file.type || "video/mp4", upsert: false });
        if (up) { setError("The upload didn't go through; check your connection and try again."); return; }
        const r = await submitTechnique({ personId, skillId, path, durationMs, note: note || undefined });
        if (!r.ok) { setError(r.error); return; }
        toast.success("Clip submitted — you'll see feedback here once an instructor has reviewed it.");
        setFile(null);
        setNote("");
        router.refresh();
      });
    }}>
      <div className="space-y-1">
        <Label htmlFor="clip">Practice clip (up to 60 seconds)</Label>
        <input id="clip" type="file" accept="video/*" capture="environment" className="block w-full text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <p className="text-xs text-fg-muted">Film the whole body from the side, in good light.</p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="clip-note">Anything the instructor should know? (optional)</Label>
        <textarea id="clip-note" className={`${selectClass} h-20 py-2`} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={pending || !file}>{pending ? "Uploading…" : "Submit for feedback"}</Button>
    </form>
  );
}
