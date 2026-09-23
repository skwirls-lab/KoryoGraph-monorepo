"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Json } from "@koryo/db/types";
import { THEMES } from "@koryo/ui/components/theme/themes";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { ONBOARDING_STEPS } from "@/lib/onboarding";
import { PROGRAM_PRESETS } from "@/lib/program-presets";
import { inviteStaffMember, STAFF_ROLE_KEYS } from "../admin/invites";
import { getCtx, type Ctx } from "../context";
import { authorize } from "../lib/authorize";

const done = () => {
  revalidatePath("/desk/onboarding", "layout");
};

async function mergeTenantJson(ctx: Ctx, column: "onboarding" | "branding", patch: Record<string, unknown>): Promise<boolean> {
  const { data: t } = await ctx.supabase.from("tenants").select(column).eq("id", ctx.tenantId as string).single();
  const current = ((t as Record<string, unknown> | null)?.[column] ?? {}) as Record<string, unknown>;
  const next = column === "onboarding" ? { ...current, steps: { ...((current.steps ?? {}) as object), ...patch } } : { ...current, ...patch };
  const { error } = await ctx.supabase.from("tenants").update(column === "onboarding" ? { onboarding: next as Json } : { branding: next as Json }).eq("id", ctx.tenantId as string);
  return !error;
}

const locationSchema = z.object({
  name: z.string().trim().min(2, { error: "Name the location" }).max(80),
  line1: z.string().trim().min(3, { error: "Enter the street address" }).max(120),
  line2: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2, { error: "Enter the city" }).max(80),
  region: z.string().trim().max(60).optional(),
  postalCode: z.string().trim().min(3, { error: "Enter the postal code" }).max(20),
  country: z.string().trim().length(2, { error: "Use a 2-letter country code" }).toUpperCase(),
  phone: z.string().trim().max(40).optional(),
});

/** The school's main location (address used on receipts, Stripe readers and the public page). */
export async function saveLocation(input: z.input<typeof locationSchema>): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "settings.manage" });
  if (denied) return denied;
  const v = locationSchema.safeParse(input);
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Check the address");
  const { data, error } = await ctx.supabase.from("locations").update({
    name: v.data.name, phone: v.data.phone || null,
    address: { line1: v.data.line1, line2: v.data.line2 || undefined, city: v.data.city, region: v.data.region || undefined, postal_code: v.data.postalCode, country: v.data.country },
  }).eq("is_default", true).select("id");
  if (error || !data?.length) return fail("Couldn't save the location.");
  done();
  revalidatePath("/desk/settings/location");
  return ok();
}

/** Create a program with a starter rank ladder (the school edits names, colours and requirements later). */
export async function applyProgramPreset(input: { preset: string }): Promise<ActionResult<{ programId: string }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "curriculum.write" });
  if (denied) return denied;
  const p = PROGRAM_PRESETS.find((x) => x.key === input.preset);
  if (!p) return fail("Choose a preset.");
  let slug = p.key;
  for (let n = 2; ; n++) {
    const { data } = await ctx.supabase.from("programs").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = `${p.key}-${n}`;
  }
  const { data: prog, error } = await ctx.supabase.from("programs").insert({ tenant_id: ctx.tenantId as string, name: p.name, slug, description: p.description, color: p.color }).select("id").single();
  if (error || !prog) return fail("Couldn't create the program.");
  const { error: re } = await ctx.supabase.from("ranks").insert(p.ranks.map((r, i) => ({ tenant_id: ctx.tenantId as string, program_id: prog.id, name: r.name, belt_color: r.color, stripes_max: r.stripes, position: i + 1 })));
  if (re) return fail("The program was created but its ranks couldn't be added; add them on the program page.");
  done();
  return ok({ programId: prog.id });
}

/** Mark a step as skipped for now (the checklist says "skipped" until the real thing exists). */
export async function skipStep(input: { step: string }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "settings.manage" });
  if (denied) return denied;
  if (!ONBOARDING_STEPS.some((s) => s.key === input.step && s.key !== "golive")) return fail("Unknown step.");
  if (!(await mergeTenantJson(ctx, "onboarding", { [input.step]: true }))) return fail("Couldn't save.");
  done();
  return ok();
}

/** Theme default for the school and an optional logo (already uploaded to "<tenant>/branding/…"). */
export async function saveBranding(input: { theme: string; logoPath: string | null }): Promise<ActionResult> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "settings.manage" });
  if (denied) return denied;
  const v = z.object({ theme: z.enum(THEMES), logoPath: z.string().max(300).nullable() }).safeParse(input);
  if (!v.success) return fail("Choose a theme.");
  if (v.data.logoPath && !v.data.logoPath.startsWith(`${ctx.tenantId}/branding/`)) return fail("Upload the logo first.");
  if (!(await mergeTenantJson(ctx, "branding", { theme: v.data.theme, logo_path: v.data.logoPath, saved_at: new Date().toISOString() }))) return fail("Couldn't save the branding.");
  done();
  revalidatePath("/", "layout");
  return ok();
}

const inviteSchema = z.object({
  email: z.email({ error: "Enter a valid email" }),
  name: z.string().trim().min(2, { error: "Enter their name" }).max(80),
  roleKey: z.enum(STAFF_ROLE_KEYS),
});

/** Invite a staff member by email; they accept after signing in. */
export async function inviteStaff(input: z.input<typeof inviteSchema>): Promise<ActionResult<{ existingUser: boolean }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "staff.manage" });
  if (denied) return denied;
  const v = inviteSchema.safeParse(input);
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Check the invitation");
  const redirectTo = new URL("/auth/accept?next=/welcome", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100").toString();
  const r = await inviteStaffMember(ctx, { ...v.data, redirectTo });
  if (!r.ok) return fail(r.error);
  done();
  revalidatePath("/desk/staff");
  return ok({ existingUser: r.existingUser });
}

/** Go live: the trial ends and the chosen plan (or modules) become the school's entitlements. */
export async function goLive(input: { plan: string | null; modules: string[]; cycle: "monthly" | "annual" }): Promise<ActionResult<{ modules: string[] }>> {
  const ctx = await getCtx();
  const denied = authorize(ctx, { permission: "settings.manage" });
  if (denied) return denied;
  const v = z.object({ plan: z.string().regex(/^[a-z_]{2,40}$/).nullable(), modules: z.array(z.string().regex(/^[a-z_]{2,40}$/)).max(20), cycle: z.enum(["monthly", "annual"]) }).safeParse(input);
  if (!v.success) return fail("Choose a plan.");
  // p_plan null = a custom set of modules (the generated types don't model nullable RPC args).
  const { data, error } = await ctx.supabase.rpc("go_live", { p_plan: v.data.plan as string, p_modules: v.data.modules, p_cycle: v.data.cycle });
  if (error) return fail(error.code === "42501" ? "Only the owner can choose the plan." : "Couldn't switch the plan.");
  // New module claims arrive with a refreshed token.
  await ctx.supabase.auth.refreshSession();
  revalidatePath("/", "layout");
  return ok({ modules: data ?? [] });
}
