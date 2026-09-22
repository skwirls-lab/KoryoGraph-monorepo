"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Textarea } from "@koryo/ui/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { markThreadRead } from "@/server/actions/messaging";

export function Composer({ threadId, send, label = "Reply" }: { threadId: string; send: (input: { threadId: string; body: string }) => Promise<ActionResult>; label?: string }) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await send({ threadId, body }); if (r.ok) setBody(""); else toast.error(r.error); }); }}>
      <label htmlFor="composer" className="sr-only">{label}</label>
      <Textarea id="composer" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message…" />
      <Button type="submit" disabled={pending || !body.trim()}>{pending ? "Sending…" : label}</Button>
    </form>
  );
}

/** Clears the unread counter for this side of the conversation once it has been opened. */
export function MarkRead({ threadId }: { threadId: string }) {
  useEffect(() => {
    void markThreadRead({ threadId });
  }, [threadId]);
  return null;
}
