import "server-only";
import type { Ctx } from "../context";

export async function taxClassOptions(ctx: Ctx): Promise<{ value: string; label: string }[]> {
  const { data: rates } = await ctx.supabase.from("tax_rates").select("name, rate, applies_to");
  const classes = new Map<string, string>([["exempt", "No tax"], ["retail", "retail"]]);
  for (const r of rates ?? []) for (const c of r.applies_to) classes.set(c, `${c} (${r.name}, ${(Number(r.rate) * 100).toFixed(2)}%)`);
  return [...classes].map(([value, label]) => ({ value, label }));
}

/** Signed URLs (5 minutes) for private product images. */
export async function signedImages(ctx: Ctx, paths: string[]): Promise<Map<string, string | null>> {
  if (!paths.length) return new Map();
  const { data } = await ctx.supabase.storage.from("tenant-media").createSignedUrls(paths, 300);
  return new Map((data ?? []).map((d) => [d.path ?? "", d.signedUrl ?? null]));
}
