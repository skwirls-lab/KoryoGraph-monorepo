import type { ReactNode } from "react";
import { DeskShell } from "@/components/shell/desk-shell";
import { DESK_NAV, resolveNav } from "@/lib/nav";
import { requireSurfacePage } from "@/server/context";
import { loadShellData } from "@/server/queries/shell";

export default async function DeskLayout({ children }: { children: ReactNode }) {
  const ctx = await requireSurfacePage("desk");
  const shell = await loadShellData(ctx);
  return (
    <DeskShell
      nav={resolveNav(DESK_NAV, ctx.permissions, ctx.modules)}
      tenant={{ id: ctx.tenantId, name: ctx.tenantName ?? "Your school" }}
      tenants={shell.tenants}
      user={shell.user}
    >
      {children}
    </DeskShell>
  );
}
