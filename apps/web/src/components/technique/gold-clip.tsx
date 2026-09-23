"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { createBrowserClient } from "@koryo/db/browser";
import { Button } from "@koryo/ui/components/ui/button";
import { MAX_CLIP_BYTES } from "@/lib/technique";
import { setGoldClip } from "@/server/actions/technique";

/** Upload or clear the instructor's reference clip for a skill (used alongside students' clips for feedback). */
export function GoldClip({ tenantId, skillId, skillName, hasClip }: { tenantId: string; skillId: string; skillName: string; hasClip: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const upload = (file: File) => start(async () => {
    if (file.size > MAX_CLIP_BYTES) { toast.error("Clips can be up to 50 MB."); return; }
    const ext = (file.name.split(".").pop() ?? "mp4").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 4) || "mp4";
    const path = `${tenantId}/gold/${skillId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await createBrowserClient().storage.from("tenant-media").upload(path, file, { contentType: file.type || "video/mp4" });
    if (error) { toast.error("The upload didn't go through."); return; }
    const r = await setGoldClip({ skillId, path });
    if (r.ok) { toast.success("Reference clip saved"); router.refresh(); } else toast.error(r.error);
  });
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-fg-muted">{hasClip ? "Reference clip set" : "No reference clip"}</span>
      <input ref={input} type="file" accept="video/*" className="sr-only" aria-label={`Reference clip for ${skillName}`} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => input.current?.click()}>{pending ? "Uploading…" : hasClip ? "Replace" : "Upload"}</Button>
      {hasClip ? <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await setGoldClip({ skillId, path: null }); if (r.ok) router.refresh(); else toast.error(r.error); })}>Remove</Button> : null}
    </div>
  );
}
