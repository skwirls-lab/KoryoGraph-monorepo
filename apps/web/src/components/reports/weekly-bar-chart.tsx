"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";

export interface WeeklyPoint {
  week: string; // YYYY-MM-DD (Monday)
  label: string; // "Sep 21"
  value: number;
}

function Tip({ active, payload, unit }: TooltipContentProps<number, string> & { unit: string }) {
  const p = payload?.[0]?.payload as WeeklyPoint | undefined;
  if (!active || !p) return null;
  return (
    <div className="rounded-md border border-default bg-popover px-3 py-2 text-xs shadow-kg-md">
      <div className="text-fg-muted">Week of {p.label}</div>
      <div className="font-semibold tabular text-fg">{p.value.toLocaleString()} {unit}</div>
    </div>
  );
}

/**
 * Single-series weekly bars: one brand hue, thin bars with 4px rounded tops on a zero baseline,
 * recessive grid/axes, hover tooltip. No legend — the chart title names the series.
 */
export function WeeklyBarChart({ data, unit, title }: { data: WeeklyPoint[]; unit: string; title: string }) {
  return (
    <figure className="space-y-2" aria-label={title}>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--border-default)" }} tick={{ fill: "var(--text-muted)", fontSize: 12 }} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} width={44} />
            <Tooltip cursor={{ fill: "var(--accent-primary-subtle)" }} content={(props) => <Tip {...(props as TooltipContentProps<number, string>)} unit={unit} />} />
            <Bar dataKey="value" name={unit} fill="var(--accent-primary)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="text-xs text-fg-muted">{title}. The table below lists the same numbers.</figcaption>
    </figure>
  );
}
