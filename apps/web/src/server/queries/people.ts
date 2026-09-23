import "server-only";
import type { Views } from "@koryo/db/types";
import { PERSON_STATUSES, type PersonStatus } from "@/lib/people";
import type { Ctx } from "../context";

export type PersonRow = Views<"v_people_search">;

export interface PeopleFilters {
  q?: string;
  status?: PersonStatus[];
  tag?: string;
  type?: "student" | "guardian" | "lead" | "staff";
  /** Latest drift risk level (Intelligence): "high", or "medium" (= medium or high). */
  risk?: "high" | "medium";
  page?: number;
  pageSize?: number;
}

export function parsePeopleFilters(sp: Record<string, string | string[] | undefined>): PeopleFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const statuses = (one("status") ?? "")
    .split(",")
    .filter((s): s is PersonStatus => (PERSON_STATUSES as readonly string[]).includes(s));
  const type = one("type");
  return {
    q: one("q")?.trim() || undefined,
    status: statuses.length ? statuses : undefined,
    tag: one("tag")?.trim() || undefined,
    type: type === "student" || type === "guardian" || type === "lead" || type === "staff" ? type : undefined,
    risk: one("risk") === "high" || one("risk") === "medium" ? (one("risk") as "high" | "medium") : undefined,
    page: Math.max(1, Number(one("page") ?? 1) || 1),
    pageSize: Math.min(200, Math.max(10, Number(one("size") ?? 50) || 50)),
  };
}

/** People list for Desk (v_people_search, RLS applies). `all` ignores pagination (CSV export). */
export async function listPeople(ctx: Ctx, f: PeopleFilters, all = false): Promise<{ rows: PersonRow[]; total: number }> {
  let query = ctx.supabase.from("v_people_search").select("*", { count: "exact" });
  if (f.q) {
    for (const term of f.q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 4)) {
      query = query.ilike("search_text", `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
    }
  }
  if (f.status) query = query.in("status", f.status);
  if (f.tag) query = query.contains("tags", [f.tag]);
  if (f.type) query = query.contains("type_flags", [f.type]);
  if (f.risk) {
    const { data: risky } = await ctx.supabase.from("v_risk_latest").select("person_id").in("level", f.risk === "high" ? ["high"] : ["high", "medium"]).limit(2000);
    query = query.in("id", (risky ?? []).map((r) => r.person_id ?? "").filter(Boolean).concat("00000000-0000-0000-0000-000000000000"));
  }
  query = query.order("last_name").order("first_name").order("id");
  if (!all) {
    const size = f.pageSize ?? 50;
    const from = ((f.page ?? 1) - 1) * size;
    query = query.range(from, from + size - 1);
  } else {
    query = query.range(0, 9999);
  }
  const { data, count, error } = await query;
  if (error) throw new Error(`listPeople: ${error.message}`);
  return { rows: data ?? [], total: count ?? 0 };
}

export async function tenantTags(ctx: Ctx): Promise<string[]> {
  const { data } = await ctx.supabase.from("people").select("tags").not("tags", "eq", "{}").limit(2000);
  return [...new Set((data ?? []).flatMap((r) => r.tags))].sort();
}

export async function getPerson(ctx: Ctx, id: string) {
  const { data: person, error } = await ctx.supabase.from("people").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getPerson: ${error.message}`);
  if (!person) return null;

  const canMedical = ctx.permissions.has("people.medical.read");
  const [memberships, consents, notes, medical, audit] = await Promise.all([
    ctx.supabase
      .from("household_members")
      .select("household_id, relationship, households(id, name, primary_payer_person_id, household_members(person_id, relationship, is_primary_guardian, people(id, first_name, last_name, preferred_name, dob, status, phone, email)))")
      .eq("person_id", id),
    ctx.supabase.from("v_current_consents").select("kind, granted, granted_at, method").eq("person_id", id),
    ctx.supabase.from("notes").select("id, kind, body, pinned, source, created_at, by_user_id").eq("person_id", id).order("created_at", { ascending: false }).limit(100),
    canMedical ? ctx.supabase.from("people_medical").select("medical_notes, updated_at").eq("person_id", id).maybeSingle() : Promise.resolve({ data: null }),
    ctx.permissions.has("audit.read")
      ? ctx.supabase.from("audit_events").select("id, action, entity_type, before, after, created_at, actor_user_id, note").eq("entity_id", id).order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: null }),
  ]);

  return {
    person,
    households: (memberships.data ?? []).flatMap((m) => (m.households ? [{ relationship: m.relationship, ...m.households }] : [])),
    consents: consents.data ?? [],
    notes: notes.data ?? [],
    medical: canMedical ? (medical.data?.medical_notes ?? "") : null,
    audit: audit.data,
  };
}

export async function getHousehold(ctx: Ctx, id: string) {
  const { data, error } = await ctx.supabase
    .from("households")
    .select("*, household_members(id, person_id, relationship, is_primary_guardian, can_pickup, receives_billing, people(id, first_name, last_name, preferred_name, dob, status, email, phone, allergies))")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getHousehold: ${error.message}`);
  if (!data) return null;
  const { data: pin } = ctx.permissions.has("kiosk.manage")
    ? await ctx.supabase.from("kiosk_pins").select("updated_at, locked_until").eq("household_id", id).maybeSingle()
    : { data: null };
  return { household: data, pin };
}
