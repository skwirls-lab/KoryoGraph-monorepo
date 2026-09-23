import "server-only";
import type { Ctx } from "../context";

export interface PayrollRow {
  userId: string;
  name: string;
  hours: number;
  hourlyCents: number;
  hourlyPayCents: number;
  sessions: number;
  perClassCents: number;
  classPayCents: number;
  commissionCents: number;
  totalCents: number;
}

/** One month of v_payroll (period "YYYY-MM", school-local). */
export async function payroll(ctx: Ctx, period: string): Promise<PayrollRow[]> {
  const { data, error } = await ctx.supabase.from("v_payroll").select("*").eq("period", period).order("staff_name");
  if (error) throw new Error(`payroll: ${error.message}`);
  return (data ?? []).map((r) => ({
    userId: r.user_id ?? "", name: r.staff_name ?? "Staff", hours: Number(r.hours ?? 0), hourlyCents: r.hourly_cents ?? 0, hourlyPayCents: r.hourly_pay_cents ?? 0,
    sessions: r.sessions ?? 0, perClassCents: r.per_class_cents ?? 0, classPayCents: r.class_pay_cents ?? 0, commissionCents: r.commission_cents ?? 0, totalCents: r.total_cents ?? 0,
  }));
}

export const isPeriod = (p: string | undefined): p is string => Boolean(p && /^\d{4}-(0[1-9]|1[0-2])$/.test(p));
