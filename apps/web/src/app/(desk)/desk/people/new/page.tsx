import { forbidden } from "next/navigation";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { NewHouseholdForm } from "@/components/people/new-household-form";
import { todayIn } from "@/lib/people";
import { requireSurfacePage } from "@/server/context";

export const metadata = { title: "Add family" };

export default async function NewHouseholdPage() {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("people.write")) forbidden();
  return (
    <>
      <PageHeader title="Add a family" description="Create the household with its guardians and students in one go." />
      <NewHouseholdForm today={todayIn(ctx.tz)} />
    </>
  );
}
