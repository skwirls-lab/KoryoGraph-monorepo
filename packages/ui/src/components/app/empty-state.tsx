import type { ReactNode } from "react";
import { cn } from "@koryo/ui/lib/utils";

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/** Honest empty state: says plainly what is missing and why. Never a lookalike of real data. */
export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <section
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-default bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? <div className="text-fg-muted [&_svg]:size-8">{icon}</div> : null}
      <h2 className="text-lg font-semibold">{title}</h2>
      {description ? <p className="max-w-md text-sm text-fg-secondary">{description}</p> : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </section>
  );
}
