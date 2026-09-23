import type { ReactNode } from "react";
import { TabShell } from "@/components/shell/tab-shell";
import { MAT_NAV, resolveNav } from "@/lib/nav";
import { requireSurfacePage } from "@/server/context";
import { loadShellData } from "@/server/queries/shell";

export default async function MatLayout({ children }: { children: ReactNode }) {
  const ctx = await requireSurfacePage("mat");
  const shell = await loadShellData(ctx);
  return (
    <TabShell surface="mat" title={ctx.tenantName ?? "Mat"} nav={resolveNav(MAT_NAV, ctx.permissions, ctx.modules)} user={shell.user} logoUrl={shell.logoUrl}>
      {children}
    </TabShell>
  );
}
