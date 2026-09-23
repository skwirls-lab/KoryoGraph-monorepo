import { Bell } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { HomePwa } from "@/components/home/pwa";
import { TabShell } from "@/components/shell/tab-shell";
import { HOME_NAV, resolveNav } from "@/lib/nav";
import { requireSurfacePage } from "@/server/context";
import { loadShellData } from "@/server/queries/shell";

export default async function HomeLayout({ children }: { children: ReactNode }) {
  const ctx = await requireSurfacePage("home");
  const [shell, { count: unread }] = await Promise.all([
    loadShellData(ctx),
    ctx.supabase.from("communications").select("id", { count: "exact", head: true }).eq("channel", "inapp").eq("status", "sent").is("read_at", null),
  ]);
  const bell = (
    <Link href="/home/notifications" className="relative grid size-9 place-items-center rounded-md text-fg hover:bg-elevated" aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}>
      <Bell className="size-5" aria-hidden />
      {unread ? <span aria-hidden className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-semibold leading-4 text-primary-foreground">{unread > 99 ? "99+" : unread}</span> : null}
    </Link>
  );
  return (
    <TabShell surface="home" title={ctx.tenantName ?? "Home"} nav={resolveNav(HOME_NAV, ctx.permissions, ctx.modules)} user={shell.user} logoUrl={shell.logoUrl} headerExtra={<><HomePwa />{bell}</>}>
      {children}
    </TabShell>
  );
}
