import type { ReactNode } from "react";
import { DeskShell } from "@/components/shell/desk-shell";
import { DESK_NAV, resolveNav } from "@/lib/nav";
import { requireSurfacePage } from "@/server/context";
import { unreadThreadCount } from "@/server/queries/messaging";
import { loadShellData } from "@/server/queries/shell";

export default async function DeskLayout({ children }: { children: ReactNode }) {
  const ctx = await requireSurfacePage("desk");
  const [shell, unread, approvals] = await Promise.all([
    loadShellData(ctx),
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
    >
      {children}
    </DeskShell>
  );
}
