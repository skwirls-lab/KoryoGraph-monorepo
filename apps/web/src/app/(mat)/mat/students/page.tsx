import Link from "next/link";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { Input } from "@koryo/ui/components/ui/input";
import { requireSurfacePage } from "@/server/context";
import { listPeople } from "@/server/queries/people";

export const metadata = { title: "Students" };

export default async function MatStudents({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireSurfacePage("mat");
  const { q } = await searchParams;
  const { rows } = await listPeople(ctx, { q, type: "student", status: ["active", "trial"], page: 1, pageSize: 60 });
  return (
    <>
      <PageHeader title="Students" />
      <form method="get" className="mb-4" role="search">
        <label className="block"><span className="sr-only">Search students</span><Input type="search" name="q" defaultValue={q ?? ""} placeholder="Search by name" className="h-12 text-base" /></label>
      </form>
      {rows.length === 0 ? <EmptyState title={q ? "No matches" : "No students yet"} /> : (
        <ul className="divide-y divide-default rounded-xl border border-default bg-surface">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/mat/students/${r.id}`} className="flex min-h-14 items-center justify-between px-4 text-fg no-underline hover:bg-elevated">
                <span className="font-medium">{r.display_name}</span>
                <span className="text-xs text-fg-muted">{(r.household_names ?? []).join(", ")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
