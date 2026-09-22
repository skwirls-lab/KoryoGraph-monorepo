import Link from "next/link";
import { forbidden } from "next/navigation";
import { DateText } from "@koryo/ui/components/app/date-text";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { RevokeKiosk } from "@/components/settings/revoke-kiosk";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Kiosk devices" };

export default async function KioskSettings() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("kiosk.manage")) forbidden();
  const { data: devices } = await ctx.supabase.from("kiosk_devices").select("id, name, created_at, last_seen_at, revoked_at, settings, locations(name)").order("created_at", { ascending: false });
  return (
    <>
      <PageHeader eyebrow={<Link href="/desk/settings">Settings</Link>} title="Kiosk devices" description="To pair a tablet, open /kiosk on it and sign in as staff." />
      {!devices?.length ? <EmptyState title="No kiosks paired yet" /> : (
        <ul className="divide-y divide-default rounded-xl border border-default bg-surface">
          {devices.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{d.name}{d.revoked_at ? <span className="ml-2 text-xs text-danger">revoked</span> : null}</div>
                <div className="text-xs text-fg-muted">{d.locations?.name} · confirms with {(d.settings as { confirm?: string })?.confirm === "photo" ? "tap" : "PIN"} · paired <DateText value={d.created_at} timeZone={ctx.tz} />{d.last_seen_at ? <> · last used <DateText value={d.last_seen_at} timeZone={ctx.tz} style="datetime" /></> : null}</div>
              </div>
              {!d.revoked_at ? <RevokeKiosk id={d.id} name={d.name} /> : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
