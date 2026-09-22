"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, issuesToFieldErrors, ok, type ActionResult } from "@/lib/action-result";
import { DOCUMENT_KINDS } from "@/lib/documents";
import { notify } from "../comms";
import { getCtx } from "../context";
import { storeSignaturePdf } from "../documents/render";
import { authorize } from "../lib/authorize";
import { logger } from "../log";

const publishSchema = z.object({
  name: z.string().trim().min(2, { error: "Name the document" }).max(120),
  kind: z.enum(DOCUMENT_KINDS),
  body: z.string().trim().min(20, { error: "The document needs some text" }).max(50_000),
  allStudents: z.boolean().default(false),
  programIds: z.array(z.uuid()).max(50).default([]),
});
export type PublishInput = z.input<typeof publishSchema>;

/** Publish a document; an existing name gets a new version (families re-sign). */
export async function publishDocument(input: PublishInput): Promise<ActionResult<{ id: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "settings.manage" });
  if (denied) return denied;
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields", issuesToFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const { data, error } = await ctx.supabase.rpc("publish_document", {
    p_name: v.name, p_kind: v.kind, p_body: v.body, p_required_for: { all_students: v.allStudents, program_ids: v.programIds },
  });
  if (error || !data) return fail("Couldn't publish the document.");
  revalidatePath("/desk/documents");
  redirect(`/desk/documents/${data}`);
}

async function requestMeta() {
  const h = await headers();
  return { ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null, ua: h.get("user-agent")?.slice(0, 300) ?? null };
}

/** A guardian (or adult student) signs from Home: typed name + agreement → signature + PDF. */
export async function signDocument(input: { templateId: string; personId: string; typedName: string; agree: boolean }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "home.access" });
  if (denied) return denied;
  const parsed = z.object({ templateId: z.uuid(), personId: z.uuid(), typedName: z.string().trim().min(2, { error: "Type your full name" }).max(120), agree: z.literal(true, { error: "Tick the box to agree" }) }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid signature", issuesToFieldErrors(parsed.error.issues));
  const { ip, ua } = await requestMeta();
  const { data: me } = await ctx.supabase.rpc("my_person_id");
  const { data: sig, error } = await ctx.supabase.from("signatures").insert({
    tenant_id: ctx.tenantId as string, template_id: parsed.data.templateId, person_id: parsed.data.personId, signer_person_id: me ?? null,
    signer_user_id: ctx.userId, typed_name: parsed.data.typedName, ip, user_agent: ua, method: "home",
  }).select("id").single();
  if (error || !sig) return fail(error?.code === "23505" ? "This document is already signed." : "Couldn't record your signature.");
  try {
    await storeSignaturePdf(ctx.supabase, sig.id);
  } catch (err) {
    // The signature stands; the signature_pdfs job renders the PDF later.
    logger(ctx).warn({ err: err instanceof Error ? err.message : String(err) }, "signature PDF deferred to job");
  }
  revalidatePath("/home/documents");
  return ok();
}

/** Staff: email the family a signing link (works without a Home login). */
export async function sendSigningLink(input: { templateId: string; personId: string }): Promise<ActionResult<Record<string, number>>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "people.write" });
  if (denied) return denied;
  const parsed = z.object({ templateId: z.uuid(), personId: z.uuid() }).safeParse(input);
  if (!parsed.success) return fail("Invalid request");
  const token = randomBytes(24).toString("base64url");
  const { data: tmpl } = await ctx.supabase.from("document_templates").select("name").eq("id", parsed.data.templateId).single();
  const { error } = await ctx.supabase.from("signature_requests").insert({
    tenant_id: ctx.tenantId as string, template_id: parsed.data.templateId, person_id: parsed.data.personId,
    token_hash: createHash("sha256").update(token).digest("hex"), created_by: ctx.userId,
  });
  if (error) return fail("Couldn't create the signing link.");
  const link = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100"}/sign/${token}`;
  const summary = await notify(ctx, {
    personIds: [parsed.data.personId], templateKey: "signature_request", channels: ["email"],
    data: { document_name: tmpl?.name ?? "a document", link }, related: { type: "document_template", id: parsed.data.templateId },
  });
  revalidatePath("/desk/compliance");
  return ok(summary.byStatus);
}

/** Staff: upload a file into a person's document vault. */
export async function uploadDocument(form: FormData): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "people.write" });
  if (denied) return denied;
  const personId = z.uuid().safeParse(form.get("personId"));
  const kind = z.enum(["medical", "photo", "certificate", "id", "contract", "other"]).safeParse(form.get("kind"));
  const file = form.get("file");
  if (!personId.success || !kind.success || !(file instanceof File) || file.size === 0) return fail("Choose a file to upload.");
  if (file.size > 10 * 1024 * 1024) return fail("Files must be 10 MB or smaller.");
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(-80);
  const path = `${ctx.tenantId}/people/${personId.data}/${randomUUID()}-${safeName}`;
  const { error: upErr } = await ctx.supabase.storage.from("tenant-media").upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (upErr) return fail("Upload failed.");
  const { error } = await ctx.supabase.from("documents").insert({
    tenant_id: ctx.tenantId as string, person_id: personId.data, kind: kind.data, name: file.name.slice(0, 200), storage_path: path,
    mime: file.type || null, size: file.size, uploaded_by: ctx.userId,
  });
  if (error) {
    await ctx.supabase.storage.from("tenant-media").remove([path]);
    return fail("Couldn't save the document.");
  }
  revalidatePath(`/desk/people/${personId.data}`);
  return ok();
}

/** Short-lived download link for a private file the caller may read (Storage RLS decides). */
export async function fileLink(input: { path: string }): Promise<ActionResult<{ url: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, {});
  if (denied) return denied;
  const path = z.string().max(500).safeParse(input.path);
  if (!path.success || !path.data.startsWith(`${ctx.tenantId}/`)) return fail("Not found");
  const { data, error } = await ctx.supabase.storage.from("tenant-media").createSignedUrl(path.data, 300);
  if (error || !data) return fail("You can't open that file.");
  return ok({ url: data.signedUrl });
}
