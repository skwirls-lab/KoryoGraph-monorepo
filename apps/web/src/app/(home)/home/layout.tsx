import type { ReactNode } from "react";
import { TabShell } from "@/components/shell/tab-shell";
import { HOME_NAV, resolveNav } from "@/lib/nav";
import { requireSurfacePage } from "@/server/context";
import { loadShellData } from "@/server/queries/shell";

export default async function HomeLayout({ children }: { children: ReactNode }) {
  const ctx = await requireSurfacePage("home");
  const shell = await loadShellData(ctx);
  return (
    <TabShell surface="home" title={ctx.tenantName ?? "Home"} nav={resolveNav(HOME_NAV, ctx.permissions, ctx.modules)} user={shell.user} logoUrl={shell.logoUrl}>
      {children}
    </TabShell>
  );
}
