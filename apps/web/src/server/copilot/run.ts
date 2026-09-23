import "server-only";
import { AiError, copilotStep, renderGrounded, type Citation } from "@koryo/ai";
import type { Json } from "@koryo/db/types";
import { aiFor } from "../ai";
import type { Ctx } from "../context";
import { executeTool, today } from "./tools";

export type CopilotEvent =
  | { type: "conversation"; id: string }
  | { type: "step"; tool: string; args: unknown; ok: boolean; note?: string }
  | { type: "answer"; text: string; citations: Citation[]; fixture: boolean; messageId: string | null }
  | { type: "error"; message: string };

const MAX_TOOLS = 4;

/** One copilot turn: tool steps (streamed as they happen), then the grounded answer, persisted. */
export async function runCopilot(ctx: Ctx, input: { conversationId?: string | null; question: string }, emit: (e: CopilotEvent) => void): Promise<void> {
  const db = ctx.supabase;
  let conversationId = input.conversationId ?? null;
  if (conversationId) {
    const { data } = await db.from("ai_conversations").select("id").eq("id", conversationId).eq("surface", "desk").maybeSingle();
    if (!data) conversationId = null;
  }
  if (!conversationId) {
    const { data, error } = await db.from("ai_conversations").insert({ tenant_id: ctx.tenantId as string, user_id: ctx.userId as string, surface: "desk", title: input.question.slice(0, 80) }).select("id").single();
    if (error || !data) { emit({ type: "error", message: "Couldn't start a conversation." }); return; }
    conversationId = data.id;
  }
  emit({ type: "conversation", id: conversationId });
  const { data: prior } = await db.from("ai_messages").select("role, content").eq("conversation_id", conversationId).eq("status", "ok").order("created_at", { ascending: false }).limit(6);
  await db.from("ai_messages").insert({ tenant_id: ctx.tenantId as string, conversation_id: conversationId, role: "user", content: input.question });

  const ai = aiFor(ctx);
  const aiCtx = { tenantId: ctx.tenantId as string, userId: ctx.userId };
  const observations: { tool: string; args: unknown; result: unknown }[] = [];
  const steps: { tool: string; args: unknown; ok: boolean }[] = [];
  const runIds: string[] = [];
  let fixture = false;
  const base = { question: input.question, school: ctx.tenantName ?? "the school", today: today(ctx), history: (prior ?? []).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 2000) })) };
  const fail = async (message: string) => {
    await db.from("ai_messages").insert({ tenant_id: ctx.tenantId as string, conversation_id: conversationId as string, role: "assistant", content: message, status: "error", steps: steps as unknown as Json, ai_run_ids: runIds });
    emit({ type: "error", message });
  };
  try {
    for (let i = 0; i <= MAX_TOOLS; i++) {
      const r = await ai.runTask(copilotStep, { ...base, observations }, aiCtx);
      if (r.runId) runIds.push(r.runId);
      fixture ||= r.fixture;
      const step = r.output;
      if (step.type === "answer" || i === MAX_TOOLS) {
        if (step.type !== "answer") { await fail("I couldn't finish within the step limit. Try a narrower question."); return; }
        const grounded = renderGrounded(step.text, observations);
        const text = grounded.missing.length ? `${grounded.text}\n\n(Some values couldn't be filled from the data.)` : grounded.text;
        const { data: msg } = await db.from("ai_messages").insert({ tenant_id: ctx.tenantId as string, conversation_id: conversationId, role: "assistant", content: text, citations: step.citations, steps: steps as unknown as Json, fixture, ai_run_ids: runIds }).select("id").single();
        await db.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
        emit({ type: "answer", text, citations: step.citations, fixture, messageId: msg?.id ?? null });
        return;
      }
      let result: unknown;
      let ok = true;
      try {
        result = await executeTool(ctx, step);
      } catch (err) {
        ok = false;
        result = { error: err instanceof Error ? err.message : "tool failed" };
      }
      observations.push({ tool: step.tool, args: step.args, result });
      steps.push({ tool: step.tool, args: step.args, ok });
      emit({ type: "step", tool: step.tool, args: step.args, ok, ...(ok ? {} : { note: (result as { error: string }).error }) });
    }
  } catch (err) {
    if (err instanceof AiError) {
      await fail(err.code === "no_fixture" ? "There's no OpenRouter key on this server, and this question isn't one of the recorded dev examples, so I can't answer it." : err.message);
      return;
    }
    throw err;
  }
}
