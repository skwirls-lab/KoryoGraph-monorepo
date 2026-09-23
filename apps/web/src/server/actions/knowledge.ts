"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, issuesToFieldErrors, ok, type ActionResult } from "@/lib/action-result";
import { kbDocSchema, type KbDocInput } from "@/lib/validation/kb";
import { aiFor } from "../ai";
import { getCtx } from "../context";
import { indexDocument, searchKb, type KbHit } from "../kb";
import { authorize } from "../lib/authorize";

const manage = { permission: "settings.manage" } as const;

export async function saveKbDocument(input: KbDocInput): Promise<ActionResult<{ id: string; chunks: number; embedded: boolean; note: string | null }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, manage);
  if (denied) return denied;
  const parsed = kbDocSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const row = { title: v.title, kind: v.kind, audience: v.audience, body: v.body };
  const { data, error } = v.id
    ? await ctx.supabase.from("kb_documents").update(row).eq("id", v.id).eq("source", "manual").select("id, tenant_id, title, body").single()
    : await ctx.supabase.from("kb_documents").insert({ ...row, tenant_id: ctx.tenantId as string, created_by: ctx.userId }).select("id, tenant_id, title, body").single();
  if (error || !data) return fail("Couldn't save the document.");
  const r = await indexDocument(ctx.supabase, aiFor(ctx), data, ctx.userId);
  revalidatePath("/desk/settings/knowledge");
  return ok({ id: data.id, chunks: r.chunks, embedded: r.embedded, note: r.error });
}

export async function reindexKbDocument(input: { id: string }): Promise<ActionResult<{ chunks: number; embedded: boolean; note: string | null }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, manage);
  if (denied) return denied;
  if (!z.uuid().safeParse(input.id).success) return fail("Invalid document");
  const { data } = await ctx.supabase.from("kb_documents").select("id, tenant_id, title, body").eq("id", input.id).maybeSingle();
  if (!data) return fail("Document not found.");
  const r = await indexDocument(ctx.supabase, aiFor(ctx), data, ctx.userId);
  revalidatePath("/desk/settings/knowledge");
  return ok({ chunks: r.chunks, embedded: r.embedded, note: r.error });
}

export async function deleteKbDocument(input: { id: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, manage);
  if (denied) return denied;
  if (!z.uuid().safeParse(input.id).success) return fail("Invalid document");
  const { error } = await ctx.supabase.from("kb_documents").delete().eq("id", input.id);
  if (error) return fail("Couldn't delete it.");
  revalidatePath("/desk/settings/knowledge");
  return ok();
}

export async function testKbSearch(input: { query: string }): Promise<ActionResult<{ hits: KbHit[]; mode: "hybrid" | "text"; note: string | null }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, manage);
  if (denied) return denied;
  const q = z.string().trim().min(2).max(300).safeParse(input.query);
  if (!q.success) return fail("Type a question");
  return ok(await searchKb(ctx.supabase, aiFor(ctx), q.data, { tenantId: ctx.tenantId as string, userId: ctx.userId }));
}
