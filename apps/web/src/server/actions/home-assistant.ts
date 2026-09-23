"use server";

import { AiError, homeAssistant } from "@koryo/ai";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { displayName } from "@/lib/people";
import { aiFor } from "../ai";
import { getCtx } from "../context";
import { searchKb } from "../kb";
import { authorize } from "../lib/authorize";

export interface AssistantReply { conversationId: string; answer: string; sources: { id: string; title: string }[]; escalate: boolean; fixture: boolean; error: boolean }

/**
 * Home assistant: answers from the school's family-visible documents (RLS) and this family's own facts —
 * it's never given anything about other families, so it can't reveal them. Conversations are private.
 */
export async function askHomeAssistant(input: { conversationId?: string | null; question: string }): Promise<ActionResult<AssistantReply>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "home.access", module: "intelligence" });
  if (denied) return denied;
  const parsed = z.object({ conversationId: z.uuid().nullish(), question: z.string().trim().min(2, { error: "Ask a question" }).max(1000) }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ask a question");
  const db = ctx.supabase;
  let conversationId = parsed.data.conversationId ?? null;
  if (conversationId) {
    const { data } = await db.from("ai_conversations").select("id").eq("id", conversationId).eq("surface", "home").maybeSingle();
    if (!data) conversationId = null;
  }
  if (!conversationId) {
    const { data, error } = await db.from("ai_conversations").insert({ tenant_id: ctx.tenantId as string, user_id: ctx.userId as string, surface: "home", title: parsed.data.question.slice(0, 80) }).select("id").single();
    if (error || !data) return fail("Couldn't start a conversation.");
    conversationId = data.id;
  }
  await db.from("ai_messages").insert({ tenant_id: ctx.tenantId as string, conversation_id: conversationId, role: "user", content: parsed.data.question });

  // This family's own facts only (RLS limits people/balances to their households).
  const { data: hh } = await db.rpc("my_household_ids");
  const householdIds = (hh ?? []) as string[];
  const { data: members } = householdIds.length ? await db.from("household_members").select("person_id, relationship, people(first_name, last_name, preferred_name, status)").in("household_id", householdIds) : { data: [] };
  const students = (members ?? []).filter((m) => m.relationship === "student" && m.people).map((m) => ({ id: m.person_id, name: displayName(m.people as NonNullable<typeof m.people>), status: m.people?.status }));
  const { data: bal } = householdIds.length && ctx.modules.has("billing") ? await db.from("v_household_balance").select("open_cents, past_due_cents").in("household_id", householdIds) : { data: [] };
  const open = (bal ?? []).reduce((a, b) => a + (b.open_cents ?? 0), 0);
  const facts = [
    students.length ? `Students: ${students.map((s) => `${s.name} (${s.status})`).join(", ")}.` : "No students on this account.",
    ctx.modules.has("billing") ? `Open balance: ${formatMoney(open, ctx.currency)}.` : "",
  ].filter(Boolean).join("\n");

  const ai = aiFor(ctx);
  const aiCtx = { tenantId: ctx.tenantId as string, userId: ctx.userId };
  const kb = await searchKb(db, ai, parsed.data.question, aiCtx, 5).catch(() => ({ hits: [], mode: "text" as const, note: null }));
  let reply: AssistantReply;
  try {
    const r = await ai.runTask(homeAssistant, {
      question: parsed.data.question, school: ctx.tenantName ?? "the school", studentNames: students.map((s) => s.name), householdFacts: facts,
      kb: kb.hits.map((h) => ({ id: h.chunkId, title: h.title, content: h.content.slice(0, 1500) })),
    }, aiCtx);
    const titles = new Map(kb.hits.map((h) => [h.chunkId, h.title]));
    const sources = [...new Map(r.output.citations.filter((c) => titles.has(c)).map((c) => [titles.get(c) ?? "", { id: c, title: titles.get(c) ?? "" }])).values()];
    reply = { conversationId, answer: r.output.answer, sources, escalate: r.output.escalate, fixture: r.fixture, error: false };
    await db.from("ai_messages").insert({ tenant_id: ctx.tenantId as string, conversation_id: conversationId, role: "assistant", content: r.output.answer, citations: sources, fixture: r.fixture, ai_run_ids: r.runId ? [r.runId] : [] });
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    const answer = err.code === "no_fixture" || err.code === "no_key" || err.code === "no_model"
      ? "The assistant isn't available on this server right now. You can send your question to the front desk instead."
      : err.code === "budget_exceeded" ? "The assistant is resting for the rest of the month. You can send your question to the front desk." : "Sorry — I couldn't answer that just now. You can send your question to the front desk.";
    reply = { conversationId, answer, sources: [], escalate: true, fixture: false, error: true };
    await db.from("ai_messages").insert({ tenant_id: ctx.tenantId as string, conversation_id: conversationId, role: "assistant", content: answer, status: "error" });
  }
  return ok(reply);
}
