"use client";

import { Search, X } from "lucide-react";
import { parseAsString, useQueryStates } from "nuqs";
import { useState } from "react";
import { Button } from "@koryo/ui/components/ui/button";
import { Input } from "@koryo/ui/components/ui/input";
import { PERSON_STATUSES, STATUS_LABELS } from "@/lib/people";

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm text-fg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Search-as-you-type + filters, all in the URL (server re-renders the list). */
export function PeopleToolbar({ tags }: { tags: string[] }) {
  const [params, setParams] = useQueryStates(
    { q: parseAsString, status: parseAsString, type: parseAsString, tag: parseAsString, page: parseAsString },
    { shallow: false, throttleMs: 250 },
  );
  // Local mirror of ?q for responsive typing; the URL is the source of truth for the server render.
  const [q, setQ] = useState(params.q ?? "");

  const set = (patch: Partial<Record<keyof typeof params, string | null>>) => void setParams({ ...patch, page: null });
  const active = Boolean(params.q || params.status || params.type || params.tag);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="relative min-w-56 flex-1">
        <span className="sr-only">Search people</span>
        <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-muted" />
        <Input
          type="search"
          value={q}
          placeholder="Search by name…"
          className="pl-8"
          onChange={(e) => {
            setQ(e.target.value);
            set({ q: e.target.value || null });
          }}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-fg-secondary">
        Status
        <select className={selectClass} value={params.status ?? ""} onChange={(e) => set({ status: e.target.value || null })}>
          <option value="">Any status</option>
          {PERSON_STATUSES.map((s) => (
            <option key={s} value={s} className="bg-surface">{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-fg-secondary">
        Type
        <select className={selectClass} value={params.type ?? ""} onChange={(e) => set({ type: e.target.value || null })}>
          <option value="">Everyone</option>
          <option value="student" className="bg-surface">Students</option>
          <option value="guardian" className="bg-surface">Guardians</option>
          <option value="lead" className="bg-surface">Leads</option>
          <option value="staff" className="bg-surface">Staff</option>
        </select>
      </label>
      {tags.length > 0 ? (
        <label className="flex flex-col gap-1 text-xs text-fg-secondary">
          Tag
          <select className={selectClass} value={params.tag ?? ""} onChange={(e) => set({ tag: e.target.value || null })}>
            <option value="">Any tag</option>
            {tags.map((t) => (
              <option key={t} value={t} className="bg-surface">{t}</option>
            ))}
          </select>
        </label>
      ) : null}
      {active ? (
        <Button variant="ghost" size="sm" onClick={() => { setQ(""); void setParams({ q: null, status: null, type: null, tag: null, page: null }); }}>
          <X aria-hidden className="size-4" /> Clear
        </Button>
      ) : null}
    </div>
  );
}
