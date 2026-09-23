import type { ReactNode } from "react";
import { TabShell } from "@/components/shell/tab-shell";
import { MAT_NAV, resolveNav } from "@/lib/nav";
import { requireSurfacePage } from "@/server/context";
import { LocationSwitcher } from "@/components/locations/location-controls";
import { locationScope } from "@/server/queries/locations";
import { loadShellData } from "@/server/queries/shell";

export default async function MatLayout({ children }: { children: ReactNode }) {
  const ctx = await requireSurfacePage("mat");
  const [shell, scope] = await Promise.all([loadShellData(ctx), locationScope(ctx)]);
  return (
    <TabShell surface="mat" title={ctx.tenantName ?? "Mat"} nav={resolveNav(MAT_NAV, ctx.permissions, ctx.modules)} user={shell.user} logoUrl={shell.logoUrl} headerExtra={scope.multi ? <LocationSwitcher locations={scope.locations} selected={scope.selected} /> : undefined}>
      {children}
    </TabShell>
  );
}
