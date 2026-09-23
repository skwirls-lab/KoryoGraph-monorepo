import Link from "next/link";
import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@koryo/ui/components/ui/table";
import { TIERS } from "@koryo/ai";
import { BudgetForm, TestConnection } from "@/components/ai/ai-settings-controls";
import { aiFor } from "@/server/ai";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "AI settings" };

const TIER_USE: Record<string, string> = {
  fast: "Drafting messages, lead scoring, summaries", frontier: "Copilot, action board, reports", vision: "Packing slips, technique feedback",
  audio: "Class recordings", embed: "Knowledge-base search",
};
const card = "rounded-xl border border-default bg-surface p-4 sm:p-5";

export default async function AiSettingsPage() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("settings.manage")) forbidden();
  const status = aiFor(ctx).status();
  const [{ data: budget }, { data: usage }, { data: runs }] = await Promise.all([
    ctx.supabase.rpc("ai_budget_status"),
    ctx.supabase.from("v_ai_usage").select("*").eq("period", new Intl.DateTimeFormat("en-CA", { timeZone: ctx.tz }).format(new Date()).slice(0, 7)),
    ctx.supabase.from("ai_runs").select("id, task_id, tier, model, transport, status, error, cost_cents, latency_ms, created_at").order("created_at", { ascending: false }).limit(15),
  ]);
  const b = budget?.[0];
  const used = Number(b?.used_cents ?? 0);
  const limit = b?.limit_cents ?? 0;
  const byTask = new Map<string, { runs: number; cost: number; failed: number }>();
  for (const u of usage ?? []) {
    const x = byTask.get(u.task_id ?? "") ?? { runs: 0, cost: 0, failed: 0 };
    byTask.set(u.task_id ?? "", { runs: x.runs + (u.runs ?? 0), cost: x.cost + Number(u.cost_cents ?? 0), failed: x.failed + (u.status === "ok" ? 0 : u.runs ?? 0) });
  }
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/settings">Settings</Link>} title="AI" description="The AI layer runs through OpenRouter. Every run is logged here; nothing is sent to families without staff approval." />
      <div className="grid gap-4 xl:grid-cols-2">
        <section className={card} aria-labelledby="provider-h">
          <h2 id="provider-h" className="mb-3 text-base font-semibold">Provider</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-fg-muted">API key</dt>
            <dd>{status.keyPresent ? <Badge variant="secondary">Platform key configured</Badge> : <Badge variant="outline">No key</Badge>}</dd>
            <dt className="text-fg-muted">Mode</dt>
            <dd>{status.transport === "live" ? "Live" : "Recorded dev fixtures"}</dd>
          </dl>
          {!status.keyPresent ? (
            <p className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              OPENROUTER_API_KEY isn&apos;t set on this server, so AI features only replay recorded examples (marked &ldquo;dev fixture&rdquo;) and say so when there&apos;s nothing recorded. Add the key to enable live AI.
            </p>
          ) : null}
          <div className="mt-4"><TestConnection /></div>
        </section>
        <section className={card} aria-labelledby="budget-h">
          <h2 id="budget-h" className="mb-3 text-base font-semibold">Budget</h2>
          <p className="mb-3 text-sm">Used this month: <strong>${(used / 100).toFixed(2)}</strong> of ${(limit / 100).toFixed(2)}{limit ? ` (${Math.round((used / limit) * 100)}%)` : ""}. Calls that would exceed the budget are refused.</p>
          <BudgetForm monthly={(limit / 100).toFixed(2)} />
        </section>
        <section className={card} aria-labelledby="tiers-h">
          <h2 id="tiers-h" className="mb-3 text-base font-semibold">Model tiers</h2>
          <dl className="divide-y divide-default text-sm" aria-label="Model per tier">
            {TIERS.map((t) => (
              <div key={t} className="grid gap-1 py-2 sm:grid-cols-[6rem_1fr]">
                <dt className="font-medium">{t}</dt>
                <dd>
                  <div className="break-all">{status.models[t] ?? <span className="text-fg-muted">not set (AI_MODEL_{t.toUpperCase()})</span>}</div>
                  <div className="text-xs text-fg-muted">{TIER_USE[t]}</div>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-fg-muted">Models are chosen per deployment from OpenRouter&apos;s catalogue (environment variables).</p>
        </section>
        <section className={card} aria-labelledby="usage-h">
          <h2 id="usage-h" className="mb-3 text-base font-semibold">Usage this month</h2>
          {!byTask.size ? <p className="text-sm text-fg-muted">No AI runs yet this month.</p> : (
            <Table><caption className="sr-only">AI usage by task</caption>
              <TableHeader><TableRow><TableHead>Task</TableHead><TableHead className="text-right">Runs</TableHead><TableHead className="text-right">Not ok</TableHead><TableHead className="text-right">Cost</TableHead></TableRow></TableHeader>
              <TableBody>{[...byTask.entries()].map(([k, v]) => <TableRow key={k}><TableCell>{k}</TableCell><TableCell className="text-right tabular">{v.runs}</TableCell><TableCell className="text-right tabular">{v.failed}</TableCell><TableCell className="text-right tabular">${(v.cost / 100).toFixed(4)}</TableCell></TableRow>)}</TableBody>
            </Table>
          )}
        </section>
      </div>
      <section className={`${card} mt-4`} aria-labelledby="runs-h">
        <h2 id="runs-h" className="mb-3 text-base font-semibold">Recent runs</h2>
        {!runs?.length ? <p className="text-sm text-fg-muted">None yet.</p> : (
          <ul className="divide-y divide-default text-sm" aria-label="Recent AI runs">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-1.5">
                <span className="font-medium">{r.task_id}</span>
                <Badge variant={r.status === "ok" ? "secondary" : "outline"}>{r.status.replace("_", " ")}</Badge>
                {r.transport === "fixture" ? <Badge variant="outline">dev fixture</Badge> : null}
                <span className="text-xs text-fg-muted">{r.model ?? "—"} · {new Date(r.created_at).toLocaleString("en-US", { timeZone: ctx.tz, dateStyle: "short", timeStyle: "short" })}</span>
                {r.error ? <span className="w-full text-xs text-fg-muted">{r.error}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
