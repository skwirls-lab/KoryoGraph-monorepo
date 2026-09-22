import Link from "next/link";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { NewProgramDialog } from "@/components/curriculum/program-form";
import { requireSurfacePage } from "@/server/context";
import { listPrograms } from "@/server/queries/curriculum";

export const metadata = { title: "Programs" };

export default async function ProgramsPage() {
  const ctx = await requireSurfacePage("desk");
  const programs = await listPrograms(ctx);
  const canWrite = ctx.permissions.has("curriculum.write");
  return (
    <>
      <PageHeader
        title="Programs"
        description="Each program has its own rank ladder and requirements."
        actions={
          <>
            <Link href="/desk/curriculum" className="text-sm">Curriculum library</Link>
            {canWrite ? <NewProgramDialog /> : null}
          </>
        }
      />
      {programs.length === 0 ? (
        <EmptyState title="No programs yet" description="Create your first program, e.g. Youth Taekwondo or Little Tigers." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {programs.map((p) => (
            <li key={p.id}>
              <Link href={`/desk/programs/${p.id}`} className="block rounded-xl border border-default bg-surface p-5 text-fg no-underline transition-colors hover:border-strong">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="size-3 rounded-full" style={{ backgroundColor: p.color }} />
                  <h2 className="text-lg font-semibold">{p.name}</h2>
                  {!p.active ? <span className="text-xs text-fg-muted">inactive</span> : null}
                  {p.invite_only ? <span className="text-xs text-fg-muted">invite only</span> : null}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-fg-secondary">{p.description || "No description."}</p>
                <p className="mt-3 text-xs text-fg-muted">
                  {p.rankCount} ranks · {p.enrollmentCount} enrolled
                  {p.age_min !== null || p.age_max !== null ? ` · ages ${p.age_min ?? "?"}–${p.age_max ?? "+"}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
