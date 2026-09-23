import { Download, UserPlus } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Button } from "@koryo/ui/components/ui/button";
import { Pagination } from "@/components/common/pagination";
import { PeopleTable, type PeopleTableRow } from "@/components/people/people-table";
import { PeopleToolbar } from "@/components/people/people-toolbar";
import { RiskList } from "@/components/risk/risk-list";
import { todayIn } from "@/lib/people";
import { requireSurfacePage } from "@/server/context";
import { listPeople, parsePeopleFilters, tenantTags } from "@/server/queries/people";
import { forbidden } from "next/navigation";

export const metadata = { title: "People" };

export default async function PeoplePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("people.read")) forbidden();
  const sp = await searchParams;
  const filters = parsePeopleFilters(sp);
  const [{ rows, total }, tags] = await Promise.all([listPeople(ctx, filters), tenantTags(ctx)]);
  const canWrite = ctx.permissions.has("people.write");
  const params: Record<string, string | undefined> = {
    q: filters.q, status: filters.status?.join(","), type: filters.type, tag: filters.tag, risk: filters.risk,
  };
  const exportQs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1]))).toString();

  const tableRows: PeopleTableRow[] = rows.map((r) => ({
    id: r.id as string,
    name: r.display_name ?? "",
    status: r.status ?? "active",
    households: r.household_names ?? [],
    householdId: r.household_id,
    dob: r.dob,
    phone: r.phone,
    email: r.email,
    tags: r.tags ?? [],
    flags: r.type_flags ?? [],
  }));

  return (
    <>
      <PageHeader
        title="People"
        description="Students, guardians, leads and staff."
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <a href={`/desk/people/export${exportQs ? `?${exportQs}` : ""}`} download>
                <Download aria-hidden className="size-4" /> Export CSV
              </a>
            </Button>
            {canWrite ? (
              <Button asChild size="sm" className="gap-2">
                <Link href="/desk/people/new"><UserPlus aria-hidden className="size-4" /> Add family</Link>
              </Button>
            ) : null}
          </>
        }
      />
      <div className="space-y-4">
        {filters.risk ? <RiskList ctx={ctx} level={filters.risk} /> : null}
        <PeopleToolbar tags={tags} />
        {total === 0 && !filters.q && !filters.status && !filters.type && !filters.tag && !filters.risk ? (
          <EmptyState
            title="No people yet"
            description="Add your first family, or import from your previous system (import arrives in M5)."
            action={canWrite ? <Button asChild><Link href="/desk/people/new">Add family</Link></Button> : undefined}
          />
        ) : (
          <>
            <PeopleTable rows={tableRows} today={todayIn(ctx.tz)} canWrite={canWrite} />
            <Pagination basePath="/desk/people" params={params} page={filters.page ?? 1} pageSize={filters.pageSize ?? 50} total={total} />
          </>
        )}
      </div>
    </>
  );
}
