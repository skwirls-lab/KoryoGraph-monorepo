import Link from "next/link";
import { Button } from "@koryo/ui/components/ui/button";

/** Server-rendered pager that preserves the current query string. */
export function Pagination({ basePath, params, page, pageSize, total }: { basePath: string; params: Record<string, string | undefined>; page: number; pageSize: number; total: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const sp = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])));
    if (p > 1) sp.set("page", String(p));
    else sp.delete("page");
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-2 text-sm text-fg-secondary">
      <span className="tabular">
        {from}–{to} of {total}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm"><Link href={href(page - 1)}>Previous</Link></Button>
        ) : (
          <Button variant="outline" size="sm" disabled>Previous</Button>
        )}
        {page < pages ? (
          <Button asChild variant="outline" size="sm"><Link href={href(page + 1)}>Next</Link></Button>
        ) : (
          <Button variant="outline" size="sm" disabled>Next</Button>
        )}
      </div>
    </nav>
  );
}
