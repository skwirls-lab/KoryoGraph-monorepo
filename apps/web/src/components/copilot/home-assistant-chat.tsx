"use client";

import { Bot } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { Label } from "@koryo/ui/components/ui/label";
import { selectClass } from "@/components/forms/select-field";
import { askHomeAssistant } from "@/server/actions/home-assistant";
import { startThread } from "@/server/actions/messaging";

interface Msg { role: "user" | "assistant"; content: string; sources: { id: string; title: string }[]; escalate: boolean; fixture: boolean; question?: string }

export function HomeAssistantChat({ initial, conversationId: cid }: { initial: Msg[]; conversationId: string | null }) {
  const [messages, setMessages] = useState(initial);
  const [conversationId, setConversationId] = useState(cid);
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const ask = () => {
    const question = q.trim();
    if (question.length < 2) return;
    setMessages((m) => [...m, { role: "user", content: question, sources: [], escalate: false, fixture: false }]);
    setQ("");
    start(async () => {
      const r = await askHomeAssistant({ conversationId, question });
      if (!r.ok) { toast.error(r.error); return; }
      setConversationId(r.data.conversationId);
      setMessages((m) => [...m, { role: "assistant", content: r.data.answer, sources: r.data.sources, escalate: r.data.escalate, fixture: r.data.fixture, question }]);
    });
  };
  const escalate = (question: string) => start(async () => {
    const r = await startThread({ subject: "Question from the app assistant", body: question });
    if (r && !r.ok) toast.error(r.error);
  });
  return (
    <div className="space-y-3">
      <ol className="space-y-3" aria-label="Conversation" aria-live="polite">
        {!messages.length ? <li className="text-sm text-fg-muted">Ask about the school&apos;s policies, testing, schedule or your family&apos;s account. Anything else goes to the front desk.</li> : null}
        {messages.map((m, i) => (
          <li key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            {m.role === "user" ? <p className="max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">{m.content}</p> : (
              <div className="max-w-[92%] rounded-2xl border border-default bg-surface p-3" aria-label="Assistant answer">
                <div className="mb-1 flex items-center gap-2 text-xs text-fg-muted"><Bot aria-hidden className="size-4" />Assistant{m.fixture ? <Badge variant="secondary">dev fixture</Badge> : null}</div>
                <p className="whitespace-pre-line text-sm">{m.content}</p>
                {m.sources.length ? <p className="mt-2 text-xs text-fg-muted">From: {m.sources.map((s) => s.title).join(", ")}</p> : null}
                {m.escalate && m.question ? <Button size="sm" variant="outline" className="mt-2" disabled={pending} onClick={() => escalate(m.question ?? "")}>Message the front desk</Button> : null}
              </div>
            )}
          </li>
        ))}
        {pending ? <li className="text-sm text-fg-muted" role="status">Thinking…</li> : null}
      </ol>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <Label htmlFor="assistant-q" className="sr-only">Ask the assistant</Label>
        <textarea id="assistant-q" rows={1} className={`${selectClass} min-h-10 flex-1 py-2`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask a question…"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }} />
        <Button type="submit" disabled={pending || q.trim().length < 2}>Ask</Button>
      </form>
    </div>
  );
}
