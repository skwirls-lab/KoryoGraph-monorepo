import type { ReactNode } from "react";
import { DeskShell } from "@/components/shell/desk-shell";
import { DESK_NAV, resolveNav } from "@/lib/nav";
import { requireSurfacePage } from "@/server/context";
import { unreadThreadCount } from "@/server/queries/messaging";
import { LocationSwitcher } from "@/components/locations/location-controls";
import { locationScope } from "@/server/queries/locations";
import { loadShellData } from "@/server/queries/shell";

export default async function DeskLayout({ children }: { children: ReactNode }) {
  const ctx = await requireSurfacePage("desk");
  const [shell, scope, unread, approvals] = await Promise.all([
    loadShellData(ctx),
    locationScope(ctx),
    unreadThreadCount(ctx),
    ctx.modules.has("intelligence") && ctx.permissions.has("ai.use")
      ? ctx.supabase.from("approval_items").select("id", { count: "exact", head: true }).eq("status", "pending").then((r) => r.count ?? 0)
      : Promise.resolve(0),
  ]);
  return (
    <DeskShell
      nav={resolveNav(DESK_NAV, ctx.permissions, ctx.modules, { "/desk/inbox": unread })}
      tenant={{ id: ctx.tenantId, name: ctx.tenantName ?? "Your school" }}
      tenants={shell.tenants}
      user={shell.user}
      approvals={approvals}
      logoUrl={shell.logoUrl}
      headerExtra={scope.multi ? <LocationSwitcher locations={scope.locations} selected={scope.selected} /> : undefined}
    >
      {children}
    </DeskShell>
  );
}
