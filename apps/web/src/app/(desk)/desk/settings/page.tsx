import Link from "next/link";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Settings" };

const SECTIONS = [
  { href: "/desk/settings/templates", title: "Message templates", description: "Wording of the emails and texts KoryoGraph sends.", permission: "comms.send" },
  { href: "/desk/settings/kiosks", title: "Kiosk devices", description: "Paired check-in tablets; revoke lost devices.", permission: "kiosk.manage" },
  { href: "/desk/settings/export", title: "Data export", description: "Download all of your school's data as a ZIP.", permission: "exports.run" },
  { href: "/desk/schedule/holidays", title: "Holidays", description: "Dates when classes don't run.", permission: "schedule.manage" },
];

export default async function SettingsPage() {
  const ctx = await requireSurfacePage("desk");
  const visible = SECTIONS.filter((s) => ctx.permissions.has(s.permission));
  return (
    <>
      <PageHeader title="Settings" description={ctx.tenantName ?? undefined} />
      <ul className="grid gap-3 md:grid-cols-2">
        {visible.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="block rounded-xl border border-default bg-surface p-4 text-fg no-underline hover:border-strong">
              <h2 className="font-semibold">{s.title}</h2>
              <p className="text-sm text-fg-secondary">{s.description}</p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-fg-muted">School profile, locations, roles, payments and the audit log are added to Settings in later milestones.</p>
    </>
  );
}
