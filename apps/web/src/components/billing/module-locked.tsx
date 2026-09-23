import Link from "next/link";
import { PageHeader } from "@koryo/ui/components/app/page-header";

export function ModuleLocked({ title, module = "Billing" }: { title: string; module?: string }) {
  return (
    <>
      <PageHeader title={title} />
      <p className="rounded-xl border border-default bg-surface p-4 text-sm">
        This is part of the {module} module, which isn&apos;t on your plan. <Link href="/desk/upgrade">See plans</Link>.
      </p>
    </>
  );
}
