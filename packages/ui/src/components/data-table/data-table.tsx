"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type VisibilityState,
} from "@tanstack/react-table";
import { Columns3 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@koryo/ui/components/ui/button";
import { Checkbox } from "@koryo/ui/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger,
} from "@koryo/ui/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@koryo/ui/components/ui/table";
import { cn } from "@koryo/ui/lib/utils";

export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  getRowId: (row: T) => string;
  /** Adds a checkbox column; selected ids are reported via onSelectionChange. */
  selectable?: boolean;
  onSelectionChange?: (ids: string[]) => void;
  /** Rendered above the table, receives the selected ids (bulk actions). */
  toolbar?: (selected: string[]) => ReactNode;
  empty?: ReactNode;
  caption?: string;
  /** Column ids hidden initially. */
  hiddenColumns?: string[];
  className?: string;
}

/** The one table for Desk lists (§0.6 "Tables: shared DataTable"). Data/pagination are server-driven. */
export function DataTable<T>({
  columns, data, getRowId, selectable, onSelectionChange, toolbar, empty, caption, hiddenColumns = [], className,
}: DataTableProps<T>) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => Object.fromEntries(hiddenColumns.map((c) => [c, false])));

  const selectColumn: ColumnDef<T, unknown> = {
    id: "__select",
    enableHiding: false,
    header: ({ table }) => (
      <Checkbox
        aria-label="Select all rows"
        checked={table.getIsAllRowsSelected() ? true : table.getIsSomeRowsSelected() ? "indeterminate" : false}
        onCheckedChange={(v) => table.toggleAllRowsSelected(Boolean(v))}
      />
    ),
    cell: ({ row }) => (
      <Checkbox aria-label="Select row" checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(Boolean(v))} />
    ),
  };

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table v8 is the pinned table engine (ADR-0009)
  const table = useReactTable({
    data,
    columns: selectable ? [selectColumn, ...columns] : columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    state: { rowSelection, columnVisibility },
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    enableRowSelection: Boolean(selectable),
  });

  const selected = Object.keys(rowSelection).filter((k) => rowSelection[k]);
  useEffect(() => {
    onSelectionChange?.(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- report only when the selection set changes
  }, [selected.join(",")]);

  // New data (filter/page change) clears the selection.
  useEffect(() => setRowSelection({}), [data]);

  const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide());

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar?.(selected)}</div>
        {hideable.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Columns3 aria-hidden className="size-4" /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Show columns</DropdownMenuLabel>
              {hideable.map((c) => (
                <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(Boolean(v))}>
                  {typeof c.columnDef.header === "string" ? c.columnDef.header : c.id}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <div className="overflow-x-auto rounded-xl border border-default bg-surface">
        <Table>
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className={h.column.id === "__select" ? "w-10" : undefined}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="py-10 text-center text-fg-secondary">
                  {empty ?? "No results."}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
