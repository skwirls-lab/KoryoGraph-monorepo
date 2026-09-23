import "server-only";
import { SYSTEM_TEMPLATES } from "@koryo/comms";
import type { Ctx } from "../context";

export async function editorOptions(ctx: Ctx) {
  const [{ data: programs }, { data: stages }] = await Promise.all([
    ctx.supabase.from("programs").select("id, name").eq("active", true).order("sort"),
    ctx.supabase.from("pipeline_stages").select("key, name").not("key", "is", null).order("position"),
  ]);
  return {
    templates: Object.values(SYSTEM_TEMPLATES).filter((t) => t.channels.email || t.channels.sms).map((t) => ({ key: t.key, description: t.description })),
    programs: programs ?? [],
    stages: (stages ?? []).map((s) => ({ key: s.key ?? "", name: s.name })),
  };
}
