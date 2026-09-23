"use client";

import type { Citation } from "@koryo/ai";
import { Bot, Loader2, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { Label } from "@koryo/ui/components/ui/label";
import { selectClass } from "@/components/forms/select-field";
import { CitationChips } from "./citation-chips";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  steps: { tool: string; args: unknown; ok: boolean }[];
  fixture: boolean;
  error: boolean;
}

const TOOL_LABEL: Record<string, string> = {
  find_person: "Looked up people", person_summary: "Read a profile", attendance_summary: "Checked attendance", invoices_for_household: "Checked invoices",
  run_report: "Ran a report", kb_search: "Searched policies", propose_action: "Drafted a message for approval", propose_messages: "Drafted messages for approval",
};

function Steps({ steps }: { steps: ChatMessage["steps"] }) {
  if (!steps.length) return null;
  return (
    <ul className="mb-2 space-y-0.5 text-xs text-fg-muted" aria-label="What the copilot did">
      {steps.map((s, i) => <li key={i} className="flex items-center gap-1"><Wrench aria-hidden className="size-3" />{TOOL_LABEL[s.tool] ?? s.tool}{s.tool === "run_report" ? ` (${(s.args as { key?: string }).key})` : ""}{s.ok ? "" : " — failed"}</li>)}
    </ul>
  );
}

export function CopilotChat({ conversationId: initialId, messages: initial, initialQuestion }: { conversationId: string | null; messages: ChatMessage[]; initialQuestion?: string }) {
  const [conversationId, setConversationId] = useState(initialId);
  const [messages, setMessages] = useState(initial);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<ChatMessage["steps"]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setBusy(true);
    setLive([]);
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: question, citations: [], steps: [], fixture: false, error: false }]);
    setQ("");
    const steps: ChatMessage["steps"] = [];
    try {
      const res = await fetch("/desk/copilot/stream", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId, question }) });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const e = JSON.parse(line) as { type: string; id?: string; tool?: string; args?: unknown; ok?: boolean; text?: string; citations?: Citation[]; fixture?: boolean; message?: string; messageId?: string };
          if (e.type === "conversation" && e.id) { setConversationId(e.id); if (!conversationId) window.history.replaceState(null, "", `/desk/copilot?c=${e.id}`); }
          if (e.type === "step") { steps.push({ tool: e.tool ?? "", args: e.args, ok: Boolean(e.ok) }); setLive([...steps]); }
          if (e.type === "answer") setMessages((m) => [...m, { id: e.messageId ?? `a-${Date.now()}`, role: "assistant", content: e.text ?? "", citations: e.citations ?? [], steps: [...steps], fixture: Boolean(e.fixture), error: false }]);
          if (e.type === "error") setMessages((m) => [...m, { id: `e-${Date.now()}`, role: "assistant", content: e.message ?? "Something went wrong.", citations: [], steps: [...steps], fixture: false, error: true }]);
        }
      }
    } catch (err) {
      setMessages((m) => [...m, { id: `e-${Date.now()}`, role: "assistant", content: err instanceof Error && err.message ? err.message : "Couldn't reach the copilot.", citations: [], steps, fixture: false, error: true }]);
    } finally {
      setBusy(false);
      setLive([]);
    }
  };

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages, live]);
  useEffect(() => {
    if (initialQuestion && !asked.current) { asked.current = true; void ask(initialQuestion); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  return (
    <div className="flex min-h-[60vh] flex-col rounded-xl border border-default bg-surface">
      <ol className="flex-1 space-y-4 overflow-y-auto p-4" aria-label="Conversation" aria-live="polite">
        {!messages.length ? <li className="text-sm text-fg-muted">Ask about your students, families, money or policies — e.g. “How many students are past due?” Answers cite the records they used; the copilot can draft messages but never sends anything.</li> : null}
        {messages.map((m) => (
          <li key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
            {m.role === "user" ? <p className="max-w-[80%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">{m.content}</p> : (
              <div className="max-w-[90%]" aria-label="Copilot answer">
                <div className="mb-1 flex items-center gap-2 text-xs text-fg-muted"><Bot aria-hidden className="size-4" />Copilot{m.fixture ? <Badge variant="secondary">dev fixture</Badge> : null}</div>
                <Steps steps={m.steps} />
                <p className={`whitespace-pre-line text-sm ${m.error ? "text-danger" : ""}`}>{m.content}</p>
                <CitationChips citations={m.citations} />
              </div>
            )}
          </li>
        ))}
        {busy ? (
          <li className="text-sm text-fg-muted" role="status">
            <Steps steps={live} />
            <span className="inline-flex items-center gap-2"><Loader2 aria-hidden className="size-4 animate-spin" />Working…</span>
          </li>
        ) : null}
      </ol>
      <div ref={endRef} />
      <form className="flex gap-2 border-t border-default p-3" onSubmit={(e) => { e.preventDefault(); void ask(q); }}>
        <Label htmlFor="copilot-q" className="sr-only">Ask the copilot</Label>
        <textarea id="copilot-q" rows={1} className={`${selectClass} min-h-10 flex-1 py-2`} value={q} placeholder="Ask a question…" onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(q); } }} />
        <Button type="submit" disabled={busy || !q.trim()}>Ask</Button>
      </form>
    </div>
  );
}
