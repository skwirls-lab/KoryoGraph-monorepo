import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Honest empty state: says plainly what is missing and why. Never a lookalike of real data. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section className="kg-empty-state" role="status">
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {action ? <div>{action}</div> : null}
    </section>
  );
}
