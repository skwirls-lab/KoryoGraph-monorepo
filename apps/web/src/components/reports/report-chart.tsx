"use client";

import type { ChartSpec } from "@koryo/ai";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Validated categorical order (dataviz check: lightness band, chroma, CVD and contrast pass in light and dark).
const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const MAX_SERIES = 5;

type Row = Record<string, unknown>;
const label = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : String(v));

/** Rows + spec → recharts data: one row per x, one key per series (series beyond 5 fold into "Other"). */
export function pivot(rows: Row[], spec: ChartSpec): { data: Row[]; keys: string[] } {
  const x = spec.x ?? "";
  const y = spec.y[0] ?? "";
  if (!spec.series) return { data: rows.map((r) => ({ ...r, [x]: label(r[x]) })), keys: spec.y };
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(label(r[spec.series]), (totals.get(label(r[spec.series])) ?? 0) + Number(r[y] ?? 0));
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const keep = new Set(ranked.slice(0, ranked.length > MAX_SERIES ? MAX_SERIES - 1 : MAX_SERIES));
  const byX = new Map<string, Row>();
  for (const r of rows) {
    const xv = label(r[x]);
    const s = label(r[spec.series]);
    const key = keep.has(s) ? s : "Other";
    const row = byX.get(xv) ?? { [x]: xv };
    row[key] = Number(row[key] ?? 0) + Number(r[y] ?? 0);
    byX.set(xv, row);
  }
  // Series order is fixed by total (a series keeps its color whatever the filter).
  const keys = [...ranked.filter((k) => keep.has(k)), ...(ranked.length > keep.size ? ["Other"] : [])];
  return { data: [...byX.values()], keys };
}

export function ReportChart({ rows, spec, title }: { rows: Row[]; spec: ChartSpec; title: string }) {
  if (spec.type === "table" || !spec.x || !spec.y.length || !rows.length) return null;
  const { data, keys } = pivot(rows, spec);
  const common = {
    data, margin: { top: 8, right: 12, bottom: 0, left: 0 },
  };
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
      <XAxis dataKey={spec.x} tickLine={false} axisLine={{ stroke: "var(--border-default)" }} tick={{ fill: "var(--text-muted)", fontSize: 12 }} interval="preserveStartEnd" />
      <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} width={52} />
      <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-default)", borderRadius: 6, fontSize: 12 }} labelStyle={{ color: "var(--text-muted)" }} itemStyle={{ color: "var(--text-primary)" }} />
      {keys.length > 1 ? <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} /> : null}
    </>
  );
  return (
    <figure className="space-y-2" aria-label={title}>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {spec.type === "line" ? (
            <LineChart {...common}>{axes}{keys.map((k, i) => <Line key={k} type="linear" dataKey={k} stroke={SERIES[i % SERIES.length]} strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />)}</LineChart>
          ) : (
            <BarChart {...common} barCategoryGap="25%">{axes}{keys.map((k, i) => <Bar key={k} dataKey={k} fill={SERIES[i % SERIES.length]} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} stroke="var(--bg-surface)" strokeWidth={1} />)}</BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <figcaption className="text-xs text-fg-muted">{title}. The table below has the same numbers.</figcaption>
    </figure>
  );
}
