import "server-only";
import Link from "next/link";
import { Badge } from "@koryo/ui/components/ui/badge";
import type { Ctx } from "@/server/context";

interface Reason { factor: string; points: number; detail: string }

/** Students at risk (latest Drift Detector scores), highest first, with the reasons and any drafted outreach. */
export async function RiskList({ ctx, level }: { ctx: Ctx; level: "high" | "medium" }) {
  if (!ctx.modules.has("intelligence")) return null;
  const { data } = await ctx.supabase.from("v_risk_latest").select("person_id, person_name, score, level, reasons, explanation, computed_on, approval_item_id")
    .in("level", level === "high" ? ["high"] : ["high", "medium"]).order("score", { ascending: false }).limit(50);
  return (
    <section aria-labelledby="risk-h" className="mb-6 rounded-xl border border-default bg-surface p-4">
      <h2 id="risk-h" className="mb-1 text-base font-semibold">At risk ({data?.length ?? 0})</h2>
      <p className="mb-3 text-xs text-fg-muted">Scored nightly from attendance, absences, balances and notes{data?.[0]?.computed_on ? ` · last run ${data[0].computed_on}` : ""}. Outreach drafts wait in Approvals.</p>
      {!data?.length ? <p className="text-sm text-fg-muted">No one is flagged right now.</p> : (
        <ol className="divide-y divide-default text-sm" aria-label="Students at risk">
          {data.map((r, i) => (
            <li key={r.person_id} aria-label={r.person_name ?? ""} className="flex flex-wrap items-center gap-2 py-2">
              <span className="w-6 text-right text-fg-muted">{i + 1}.</span>
              <Link href={`/desk/people/${r.person_id}`} className="font-medium">{r.person_name}</Link>
              <Badge variant={r.level === "high" ? "destructive" : "outline"}>{r.score}</Badge>
              <span className="text-xs text-fg-secondary">{((r.reasons ?? []) as unknown as Reason[]).map((x) => x.detail).join(" · ")}</span>
              {r.approval_item_id ? <Link href="/desk/inbox/approvals?kind=drift_outreach" className="ml-auto text-xs">outreach draft</Link> : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Profile insight: this student's latest risk and why. */
export async function RiskInsight({ ctx, personId }: { ctx: Ctx; personId: string }) {
  if (!ctx.modules.has("intelligence")) return null;
  const { data: r } = await ctx.supabase.from("v_risk_latest").select("score, level, reasons, explanation, computed_on, approval_item_id").eq("person_id", personId).maybeSingle();
  if (!r || r.level === "low") return null;
  return (
    <section aria-label="Risk insight" className={`rounded-xl border p-4 text-sm ${r.level === "high" ? "border-danger/50 bg-danger/5" : "border-warning/50 bg-warning/5"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{r.level === "high" ? "At risk of leaving" : "Worth a check-in"}</span>
        <Badge variant={r.level === "high" ? "destructive" : "outline"}>{r.score}/100</Badge>
        <span className="text-xs text-fg-muted">as of {r.computed_on}</span>
        {r.approval_item_id ? <Link href="/desk/inbox/approvals?kind=drift_outreach" className="ml-auto text-xs">Review the drafted outreach</Link> : null}
      </div>
      {r.explanation ? <p className="mt-1">{r.explanation}</p> : null}
      <ul className="mt-1 list-disc pl-5 text-fg-secondary">{((r.reasons ?? []) as unknown as Reason[]).map((x) => <li key={x.factor}>{x.detail}</li>)}</ul>
    </section>
  );
}
