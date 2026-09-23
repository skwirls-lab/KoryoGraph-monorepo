import type { ReactNode } from "react";
import { SiteShell } from "./site-shell";

/** Plain-language legal drafts, clearly marked as not yet reviewed. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl px-4 py-14 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
        <h1 className="text-4xl font-bold">{title}</h1>
        <p className="mt-3 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm" role="note"><strong>Draft — legal review pending.</strong> This is a plain-language draft of how KoryoGraph intends to work, not a final legal document. Last updated {updated}.</p>
        {children}
      </article>
    </SiteShell>
  );
}
