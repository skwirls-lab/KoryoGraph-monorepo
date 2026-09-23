"use client";

import type { ChartSpec } from "@koryo/ai";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { askReport, saveReport, type NlResult } from "@/server/actions/nl-reports";
import { ReportChart } from "./report-chart";

const EXAMPLES = ["attendance by program, last 8 weeks", "revenue by category for the last 6 months", "which members haven't attended in 30 days", "trial funnel by source"];

export function ResultTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <p className="text-sm text-fg-muted">No rows.</p>;
  const cols = Object.keys(rows[0] ?? {});
  return (
    <div className="max-h-96 overflow-auto rounded-xl border border-default bg-surface" tabIndex={0} role="region" aria-label="Report rows">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-elevated text-left text-xs text-fg-muted"><tr>{cols.map((c) => <th key={c} scope="col" className="p-2">{c.replaceAll("_", " ")}</th>)}</tr></thead>
        <tbody className="divide-y divide-default">
          {rows.slice(0, 500).map((r, i) => <tr key={i}>{cols.map((c) => <td key={c} className="p-2 tabular-nums">{r[c] === null || r[c] === undefined ? "—" : typeof r[c] === "object" ? JSON.stringify(r[c]) : String(r[c])}</td>)}</tr>)}
        </tbody>
      </table>
      {rows.length > 500 ? <p className="p-2 text-xs text-fg-muted">Showing 500 of {rows.length} rows.</p> : null}
    </div>
  );
}

export function AskReport({ initial }: { initial?: string }) {
  const [q, setQ] = useState(initial ?? "");
  const [res, setRes] = useState<NlResult | null>(null);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const ask = (question: string) => start(async () => {
    const r = await askReport({ question });
    if (!r.ok) { toast.error(r.error); setRes(null); return; }
    setRes(r.data);
    setName(r.data.title);
  });
  return (
    <div className="space-y-4">
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <Label htmlFor="nl-q" className="sr-only">Ask a question about your school</Label>
        <Input id="nl-q" className="min-w-72 flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. attendance by program, last 8 weeks" />
        <Button type="submit" disabled={pending || q.trim().length < 3}>{pending ? "Working…" : "Ask"}</Button>
      </form>
      <div className="flex flex-wrap gap-1.5" aria-label="Examples">
        {EXAMPLES.map((e) => <Button key={e} size="sm" variant="outline" disabled={pending} onClick={() => { setQ(e); ask(e); }}>{e}</Button>)}
      </div>
      {res ? (
        <section aria-labelledby="nl-title" className="space-y-3 rounded-xl border border-default bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2"><h2 id="nl-title" className="text-base font-semibold">{res.title}</h2>{res.fixture ? <Badge variant="secondary">dev fixture</Badge> : null}<span className="text-xs text-fg-muted">{res.rows.length} rows</span></div>
          {res.explanation ? <p className="text-sm text-fg-secondary">{res.explanation}</p> : null}
          <ReportChart rows={res.rows} spec={res.chart} title={res.title} />
          <ResultTable rows={res.rows} />
          <details className="text-sm"><summary className="cursor-pointer text-fg-secondary">Show the query</summary><pre className="mt-2 overflow-x-auto rounded-lg bg-elevated p-3 text-xs" tabIndex={0}>{res.sql}</pre></details>
          <form className="flex flex-wrap items-end gap-2 border-t border-default pt-3" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveReport({ name, question: q, sql: res.sql, chart: res.chart as ChartSpec, runId: res.runId }); if (r && !r.ok) toast.error(r.error); }); }}>
            <div className="min-w-60 flex-1 space-y-1"><Label htmlFor="nl-name">Report name</Label><Input id="nl-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <Button type="submit" variant="outline" disabled={pending}>Save as report</Button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
