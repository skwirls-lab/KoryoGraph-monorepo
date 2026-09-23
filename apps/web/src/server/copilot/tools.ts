import "server-only";
import type { CopilotToolCall } from "@koryo/ai";
import { formatMoney } from "@koryo/ui/components/app/money-text";
import { displayName, todayIn } from "@/lib/people";
import { aiFor } from "../ai";
import type { Ctx } from "../context";
import { searchKb } from "../kb";
import { attendanceReport } from "../queries/reports";

/** Tool results are plain JSON the model reads (and answers quote via placeholders). */
export type ToolResult = Record<string, unknown>;

const need = (ctx: Ctx, perm: string) => {
  if (!ctx.permissions.has(perm)) throw new Error(`You don't have access to that (${perm}).`);
};

export async function executeTool(ctx: Ctx, call: CopilotToolCall): Promise<ToolResult> {
  const db = ctx.supabase;
  const money = (c: number) => formatMoney(c, ctx.currency);
  switch (call.tool) {
    case "find_person": {
      need(ctx, "people.read");
      const q = call.args.query.replace(/[%_,()]/g, " ").trim();
      const parts = q.split(/\s+/).filter(Boolean).slice(0, 3);
      let query = db.from("people").select("id, first_name, last_name, preferred_name, status, type_flags, household_members(household_id, households(name))").is("archived_at", null).limit(6);
      for (const p of parts) query = query.or(`first_name.ilike.%${p}%,last_name.ilike.%${p}%,preferred_name.ilike.%${p}%`);
      const { data } = await query;
      return { count: data?.length ?? 0, people: (data ?? []).map((p) => ({ person_id: p.id, name: displayName(p), status: p.status, roles: p.type_flags, household_id: p.household_members[0]?.household_id ?? null, household: p.household_members[0]?.households?.name ?? null })) };
    }
    case "person_summary": {
      need(ctx, "people.read");
      const id = call.args.person_id;
      const [{ data: p }, { data: enr }, { data: last }, { data: mem }] = await Promise.all([
        db.from("people").select("id, first_name, last_name, preferred_name, status, dob, household_members(household_id, relationship, households(name))").eq("id", id).maybeSingle(),
        db.from("enrollments").select("status, programs(name), ranks!enrollments_tenant_id_current_rank_id_fkey(name)").eq("person_id", id),
        db.from("attendance").select("checked_in_at").eq("person_id", id).order("checked_in_at", { ascending: false }).limit(1),
        ctx.permissions.has("billing.read") ? db.from("memberships").select("status, membership_plans(name)").eq("person_id", id).in("status", ["active", "trial", "past_due", "on_hold", "suspended"]) : Promise.resolve({ data: null }),
      ]);
      if (!p) return { found: false };
      const hh = p.household_members[0];
      const { data: bal } = hh && ctx.permissions.has("billing.read") ? await db.from("v_household_balance").select("open_cents, past_due_cents").eq("household_id", hh.household_id).maybeSingle() : { data: null };
      return {
        found: true, person_id: p.id, name: displayName(p), status: p.status, age: p.dob ? Math.floor((Date.now() - Date.parse(p.dob)) / 31_557_600_000) : null,
        household_id: hh?.household_id ?? null, household: hh?.households?.name ?? null,
        programs: (enr ?? []).map((e) => ({ program: e.programs?.name, rank: e.ranks?.name ?? null, status: e.status })),
        last_class: last?.[0]?.checked_in_at?.slice(0, 10) ?? null,
        memberships: mem ? mem.map((m) => ({ plan: m.membership_plans?.name, status: m.status })) : "not visible",
        balance: bal ? { open: money(bal.open_cents ?? 0), past_due: money(bal.past_due_cents ?? 0) } : "not visible",
      };
    }
    case "attendance_summary": {
      need(ctx, "people.read");
      const since = new Date(Date.now() - call.args.weeks * 7 * 86_400_000).toISOString();
      const { data } = await db.from("attendance").select("checked_in_at").eq("person_id", call.args.person_id).gte("checked_in_at", since).limit(1000);
      const perWeek = (data?.length ?? 0) / call.args.weeks;
      return { person_id: call.args.person_id, weeks: call.args.weeks, classes: data?.length ?? 0, per_week: Math.round(perWeek * 10) / 10, last_class: data?.map((d) => d.checked_in_at).sort().at(-1)?.slice(0, 10) ?? null };
    }
    case "invoices_for_household": {
      need(ctx, "billing.read");
      const { data } = await db.from("invoices").select("id, number, status, total_cents, balance_cents, due_at").eq("household_id", call.args.household_id).in("status", ["open", "partially_paid", "past_due"]).order("due_at").limit(20);
      const total = (data ?? []).reduce((a, i) => a + i.balance_cents, 0);
      return { household_id: call.args.household_id, open_invoices: data?.length ?? 0, total_due: money(total), invoices: (data ?? []).map((i) => ({ invoice_id: i.id, number: i.number, status: i.status, balance: money(i.balance_cents), due: i.due_at })) };
    }
    case "run_report": {
      need(ctx, "reports.read");
      switch (call.args.key) {
        case "past_due": {
          need(ctx, "billing.read");
          const { data } = await db.from("v_ar_aging").select("invoice_id, household_id, household_name, balance_cents, days_overdue, dunning_stage").gt("days_overdue", 0).limit(5000);
          const rows = data ?? [];
          const byHh = new Map<string, { name: string; cents: number }>();
          for (const r of rows) byHh.set(r.household_id ?? "", { name: r.household_name ?? "", cents: (byHh.get(r.household_id ?? "")?.cents ?? 0) + (r.balance_cents ?? 0) });
          const { data: inv } = rows.length ? await db.from("invoices").select("person_id").in("id", rows.map((r) => r.invoice_id ?? "")) : { data: [] };
          const total = rows.reduce((a, r) => a + (r.balance_cents ?? 0), 0);
          return {
            report: "past_due", households: byHh.size, invoices: rows.length, students: new Set((inv ?? []).map((i) => i.person_id).filter(Boolean)).size, total: money(total),
            top: [...byHh.entries()].sort((a, b) => b[1].cents - a[1].cents).slice(0, 8).map(([id, v]) => ({ household_id: id, household: v.name, owed: money(v.cents) })),
          };
        }
        case "active_students": {
          const { data } = await db.from("v_owner_dashboard").select("active_students, trials, leads").eq("tenant_id", ctx.tenantId ?? "").maybeSingle();
          return { report: "active_students", active_students: data?.active_students ?? 0, trials: data?.trials ?? 0, leads: data?.leads ?? 0 };
        }
        case "attendance_by_week": {
          const weeks = call.args.weeks ?? 4;
          const { weekly } = await attendanceReport(ctx, weeks);
          return { report: "attendance_by_week", weeks, total: weekly.reduce((a, w) => a + w.value, 0), by_week: weekly.map((w) => ({ week: w.label, check_ins: w.value })) };
        }
        case "mrr": {
          need(ctx, "billing.read");
          const { data } = await db.from("v_membership_mrr").select("mrr_cents").limit(10000);
          const cents = (data ?? []).reduce((a, r) => a + (r.mrr_cents ?? 0), 0);
          return { report: "mrr", mrr: money(cents), members: data?.length ?? 0 };
        }
        case "trials": {
          const { data } = await db.from("leads").select("pipeline_stages(key, name)").limit(1000);
          const by = new Map<string, number>();
          for (const l of data ?? []) by.set(l.pipeline_stages?.name ?? "?", (by.get(l.pipeline_stages?.name ?? "?") ?? 0) + 1);
          return { report: "trials", leads: data?.length ?? 0, by_stage: Object.fromEntries(by) };
        }
      }
      break;
    }
    case "kb_search": {
      const r = await searchKb(db, aiFor(ctx), call.args.query, { tenantId: ctx.tenantId as string, userId: ctx.userId }, 4);
      return { mode: r.mode, hits: r.hits.map((h) => ({ chunk_id: h.chunkId, document_id: h.documentId, title: h.title, excerpt: h.content.slice(0, 900) })) };
    }
    case "propose_action": {
      need(ctx, "ai.use");
      const { data: p } = await db.from("people").select("id, first_name, last_name, preferred_name").eq("id", call.args.person_id).maybeSingle();
      if (!p) return { created: false, error: "person not found" };
      const { data, error } = await db.from("approval_items").insert({
        tenant_id: ctx.tenantId as string, kind: "copilot_write", title: `Message ${displayName(p)}'s family`, preview: call.args.reason, person_id: p.id, requested_by: ctx.userId,
        payload: { person_id: p.id, messages: [{ channel: call.args.channel, ...(call.args.subject ? { subject: call.args.subject } : {}), body: call.args.body }] },
      }).select("id").single();
      if (error || !data) return { created: false, error: "couldn't create the draft" };
      return { created: true, approval_id: data.id, note: "Draft waiting in Approvals; nothing was sent." };
    }
  }
  return {};
}

export const reportHref: Record<string, string> = {
  past_due: "/desk/reports/ar-aging", active_students: "/desk/reports/roster", attendance_by_week: "/desk/reports/attendance", mrr: "/desk/reports/mrr", trials: "/desk/reports/funnel",
};
export const today = (ctx: Ctx) => todayIn(ctx.tz);
