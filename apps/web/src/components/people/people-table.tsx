"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Tag } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { DataTable } from "@koryo/ui/components/data-table/data-table";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@koryo/ui/components/ui/popover";
import { ageOn } from "@/lib/people";
import { addTag } from "@/server/actions/people";
import { StatusBadge } from "./status-badge";

export interface PeopleTableRow {
  id: string;
  name: string;
  status: string;
  households: string[];
  householdId: string | null;
  dob: string | null;
  phone: string | null;
  email: string | null;
  tags: string[];
  flags: string[];
}

function BulkTag({ selected, canWrite }: { selected: string[]; canWrite: boolean }) {
  const [tag, setTag] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  if (!canWrite || selected.length === 0) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="secondary" className="gap-2">
          <Tag aria-hidden className="size-4" /> Tag {selected.length} selected
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await addTag({ personIds: selected, tag });
              if (r.ok) {
                toast.success(`Tagged ${r.data.updated} ${r.data.updated === 1 ? "person" : "people"} “${tag.trim().toLowerCase()}”`);
                setTag("");
                setOpen(false);
              } else toast.error(r.error);
            });
          }}
        >
          <label className="block text-sm font-medium" htmlFor="bulk-tag">Tag</label>
          <Input id="bulk-tag" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. demo-team" autoFocus />
          <Button type="submit" size="sm" disabled={pending || !tag.trim()}>{pending ? "Tagging…" : "Add tag"}</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export function PeopleTable({ rows, today, canWrite }: { rows: PeopleTableRow[]; today: string; canWrite: boolean }) {
  const columns: ColumnDef<PeopleTableRow, unknown>[] = [
    {
      id: "name",
      header: "Name",
      enableHiding: false,
      cell: ({ row }) => (
        <Link href={`/desk/people/${row.original.id}`} className="font-medium text-fg">
          {row.original.name}
        </Link>
      ),
    },
    { id: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      id: "household",
      header: "Household",
      cell: ({ row }) =>
        row.original.householdId ? (
          <Link href={`/desk/households/${row.original.householdId}`} className="text-fg-secondary">
            {row.original.households.join(", ")}
          </Link>
        ) : (
          <span className="text-fg-muted">—</span>
        ),
    },
    { id: "age", header: "Age", cell: ({ row }) => (row.original.dob ? <span className="tabular">{ageOn(row.original.dob, today)}</span> : <span className="text-fg-muted">—</span>) },
    { id: "phone", header: "Phone", cell: ({ row }) => row.original.phone ?? <span className="text-fg-muted">—</span> },
    { id: "email", header: "Email", cell: ({ row }) => row.original.email ?? <span className="text-fg-muted">—</span> },
    {
      id: "tags",
      header: "Tags",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.tags.map((t) => (
            <Badge key={t} variant="secondary">{t}</Badge>
          ))}
        </div>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      selectable={canWrite}
      caption="People"
      hiddenColumns={["email"]}
      toolbar={(selected) => <BulkTag selected={selected} canWrite={canWrite} />}
      empty="No people match these filters."
    />
  );
}
