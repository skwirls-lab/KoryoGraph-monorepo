import type { ReactNode } from "react";
import { cn } from "@koryo/ui/lib/utils";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  /** e.g. "+12% vs last week"; tone colours it. */
  delta?: ReactNode;
  tone?: "neutral" | "positive" | "negative" | "warning";
  hint?: ReactNode;
  href?: string;
  className?: string;
}

const toneClass: Record<NonNullable<StatCardProps["tone"]>, string> = {
  neutral: "text-fg-secondary",
  positive: "text-success",
  negative: "text-danger",
  warning: "text-warning",
};

export function StatCard({ label, value, delta, tone = "neutral", hint, href, className }: StatCardProps) {
  const body = (
    <>
      <div className="text-sm font-medium text-fg-secondary">{label}</div>
      <div className="font-display text-3xl font-bold tabular text-fg">{value}</div>
      {delta ? <div className={cn("text-xs font-medium", toneClass[tone])}>{delta}</div> : null}
      {hint ? <div className="text-xs text-fg-muted">{hint}</div> : null}
    </>
  );
  const classes = cn(
    "flex flex-col gap-1 rounded-xl border border-default bg-surface p-5 shadow-kg-sm transition-colors",
    href && "hover:border-strong focus-visible:border-strong",
    className,
  );
  return href ? (
    <a href={href} className={cn(classes, "text-fg no-underline")}>
      {body}
    </a>
  ) : (
    <div className={classes}>{body}</div>
  );
}
