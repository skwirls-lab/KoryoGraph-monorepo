"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Label } from "@koryo/ui/components/ui/label";
import { uploadDocument } from "@/server/actions/documents";

export function UploadDocument({ personId }: { personId: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  return (
    <form ref={ref} className="flex flex-wrap items-end gap-2 rounded-xl border border-default bg-surface p-4" aria-label="Upload a document"
      action={(fd) => start(async () => { const r = await uploadDocument(fd); if (r.ok) { toast.success("Uploaded"); ref.current?.reset(); } else toast.error(r.error); })}>
      <input type="hidden" name="personId" value={personId} />
      <div className="space-y-1"><Label htmlFor="doc-file">File</Label><input id="doc-file" name="file" type="file" required className="block text-sm" /></div>
      <div className="space-y-1"><Label htmlFor="doc-kind">Kind</Label>
        <select id="doc-kind" name="kind" defaultValue="other" className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-fg">
          {["medical", "photo", "certificate", "id", "contract", "other"].map((k) => <option key={k} value={k} className="bg-surface">{k}</option>)}
        </select>
      </div>
      <Button type="submit" size="sm" disabled={pending}>{pending ? "Uploading…" : "Upload"}</Button>
    </form>
  );
}
