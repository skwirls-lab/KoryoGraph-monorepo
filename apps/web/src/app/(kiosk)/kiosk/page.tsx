import { EmptyState } from "@koryo/ui/components/app/empty-state";

export const metadata = { title: "Kiosk" };

export default function KioskPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <EmptyState title="Kiosk not paired" description="Self check-in with device pairing and family PINs arrives in milestone M1." className="max-w-lg" />
    </main>
  );
}
