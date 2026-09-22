import Link from "next/link";
import { KioskApp } from "@/components/kiosk/kiosk-app";
import { PairForm } from "@/components/kiosk/pair-form";
import { getOptionalCtx } from "@/server/context";
import { kioskInfo } from "@/server/kiosk/device";

export const metadata = { title: "Kiosk" };

export default async function KioskPage() {
  const info = await kioskInfo();
  if (info) return <KioskApp info={info} />;

  const ctx = await getOptionalCtx();
  if (ctx?.tenantId && ctx.permissions.has("kiosk.manage")) {
    const { data: locations } = await ctx.supabase.from("locations").select("id, name").is("archived_at", null).order("is_default", { ascending: false });
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
        <div>
          <h1 className="text-3xl font-bold">Pair this device as a kiosk</h1>
          <p className="text-fg-secondary">{ctx.tenantName} · families will check themselves in here.</p>
        </div>
        <PairForm locations={locations ?? []} />
      </main>
    );
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-bold">This device isn&apos;t paired</h1>
      <p className="text-fg-secondary">A staff member with kiosk access needs to sign in once to pair it.</p>
      <p><Link href="/login?next=/kiosk">Staff sign-in</Link></p>
    </main>
  );
}
