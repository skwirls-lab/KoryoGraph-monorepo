"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { selectClass } from "@/components/forms/select-field";
import { autoMap, IMPORT_FIELDS, PRESETS, type FieldKey, type Mapping } from "@/lib/import/fields";
import { commitImportChunk, finishImport, rollbackImport, saveImportMapping, suggestImportMapping, uploadImport, validateImport, type ValidationReport } from "@/server/actions/imports";

export function UploadImport() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      start(async () => { setError(null); const r = await uploadImport(fd); if (r.ok) router.push(`/desk/people/import/${r.data.id}`); else setError(r.error); });
    }}>
      <label className="space-y-1 text-sm"><span className="block font-medium">CSV file</span><input name="file" type="file" accept=".csv,text/csv" required className="block text-sm" /></label>
      <Button type="submit" disabled={pending}>{pending ? "Reading…" : "Upload"}</Button>
      {error ? <p role="alert" className="w-full text-sm text-danger">{error}</p> : null}
    </form>
  );
}

export function RollbackImport({ id, file }: { id: string; file: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={() => {
      if (!confirm(`Roll back "${file}"? Everyone this import created — and anything recorded for them since — will be deleted.`)) return;
      start(async () => { const r = await rollbackImport({ id }); if (r.ok) { toast.success(`Rolled back: ${r.data.people} people, ${r.data.households} households removed`); router.refresh(); } else toast.error(r.error); });
    }}>Roll back</Button>
  );
}

const Issues = ({ title, items, tone }: { title: string; items: ValidationReport["errors"]; tone: "danger" | "warning" }) => (
  <details open={tone === "danger"} className="text-sm">
    <summary className={`cursor-pointer font-medium ${tone === "danger" ? "text-danger" : "text-warning"}`}>{title} ({items.length})</summary>
    <ul className="mt-2 max-h-64 space-y-1 overflow-auto" aria-label={title} tabIndex={0}>{items.map((e, i) => <li key={i}>Line {e.row}: {e.message}</li>)}</ul>
  </details>
);

export function ImportWizard({ id, headers, samples, initial, preset: initialPreset, canAi }: {
  id: string; headers: string[]; samples: Record<string, string[]>; initial: Mapping; preset: string; canAi: boolean;
}) {
  const [mapping, setMapping] = useState<Mapping>(initial);
  const [preset, setPreset] = useState(initialPreset);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = (h: string, f: string) => { setMapping({ ...mapping, [h]: (f || null) as FieldKey | null }); setReport(null); };

  const check = () => start(async () => {
    setError(null);
    const s = await saveImportMapping({ id, mapping, preset });
    if (!s.ok) { setError(s.error); return; }
    const r = await validateImport({ id });
    if (r.ok) setReport(r.data); else setError(r.error);
  });

  const commit = () => start(async () => {
    if (!report) return;
    setError(null);
    const totals: Record<string, number> = {};
    let offset: number | null = 0;
    setProgress({ done: 0, total: report.valid });
    while (offset !== null) {
      const r = await commitImportChunk({ id, offset });
      if (!r.ok) { setError(r.error); router.refresh(); return; }
      for (const [k, v] of Object.entries(r.data.stats)) totals[k] = (totals[k] ?? 0) + v;
      offset = r.data.next;
      setProgress({ done: offset ?? r.data.total, total: r.data.total });
    }
    const f = await finishImport({ id, stats: totals });
    if (!f.ok) { setError(f.error); return; }
    setResult(totals);
    router.refresh();
  });

  if (result) {
    return (
      <section aria-label="Import finished" className="space-y-3 rounded-xl border border-default bg-surface p-4" role="status">
        <h2 className="font-semibold">Imported</h2>
        <p className="text-sm">{result.created ?? 0} new people, {result.updated ?? 0} updated, {result.households ?? 0} households, {result.enrollments ?? 0} rank enrollments, {result.memberships ?? 0} memberships.</p>
        <div className="flex gap-2"><Button asChild><Link href="/desk/people">See people</Link></Button><Button asChild variant="outline"><Link href="/desk/people/import">All imports</Link></Button></div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="map-h" className="space-y-3 rounded-xl border border-default bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="map-h" className="font-semibold">Match your columns</h2>
          <label className="ml-auto flex items-center gap-2 text-sm">Exported from
            <select className={`${selectClass} h-8 w-auto`} value={preset} onChange={(e) => { setPreset(e.target.value); setMapping(autoMap(headers, e.target.value)); setReport(null); }}>
              <option value="generic">Another system / my own spreadsheet</option>
              {Object.entries(PRESETS).map(([k, p]) => <option key={k} value={k}>{p.name}</option>)}
            </select>
          </label>
          {canAi ? <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => {
            const r = await suggestImportMapping({ id });
            if (!r.ok) { toast.error(r.error); return; }
            setMapping(r.data.mapping); setReport(null);
            toast.success(r.data.fixture ? "Suggested (dev fixture) — check each column" : "Suggested — check each column");
          })}>Suggest with AI</Button> : null}
        </div>
        <table className="w-full text-sm">
          <caption className="sr-only">Column mapping</caption>
          <thead><tr className="text-left text-fg-muted"><th className="py-1 font-medium">Column in your file</th><th className="py-1 font-medium">Example values</th><th className="py-1 font-medium">Import as</th></tr></thead>
          <tbody className="divide-y divide-default">
            {headers.map((h) => (
              <tr key={h}>
                <th scope="row" className="py-2 pr-2 text-left font-medium">{h}</th>
                <td className="max-w-64 truncate py-2 pr-2 text-fg-secondary">{(samples[h] ?? []).filter(Boolean).join(" · ") || "—"}</td>
                <td className="py-2">
                  <select aria-label={`Import ${h} as`} className={`${selectClass} h-8`} value={mapping[h] ?? ""} onChange={(e) => set(h, e.target.value)}>
                    <option value="">Don&apos;t import</option>
                    {IMPORT_FIELDS.map((f) => <option key={f.key} value={f.key} disabled={Object.entries(mapping).some(([hh, v]) => v === f.key && hh !== h)}>{f.group}: {f.label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-fg-muted">Programs, ranks and membership plans are matched by name to the ones already set up in KoryoGraph. Students are matched by the ID column when you re-import, so running the same file twice doesn&apos;t create duplicates.</p>
        <Button disabled={pending} onClick={check}>Check the file</Button>
      </section>

      {report ? (
        <section aria-labelledby="report-h" className="space-y-3 rounded-xl border border-default bg-surface p-4">
          <h2 id="report-h" className="font-semibold">Dry run</h2>
          <p className="text-sm" data-testid="import-summary">{report.valid} of {report.total} rows are ready: <strong>{report.toCreate} new</strong>, {report.toUpdate} already here (will be updated). Nothing has been imported yet.</p>
          <div className="flex flex-wrap gap-2">{report.errors.length ? <Badge variant="destructive">{report.errors.length} rows with errors will be skipped</Badge> : <Badge variant="secondary">No errors</Badge>}{report.warnings.length ? <Badge variant="outline">{report.warnings.length} warnings</Badge> : null}</div>
          {report.errors.length ? <Issues title="Errors" items={report.errors} tone="danger" /> : null}
          {report.warnings.length ? <Issues title="Warnings" items={report.warnings} tone="warning" /> : null}
          {progress ? (
            <div className="space-y-1">
              <div className="h-2 overflow-hidden rounded-full bg-elevated" role="progressbar" aria-label="Import progress" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
                <div className="h-full bg-brand transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 100}%` }} />
              </div>
              <p className="text-xs text-fg-muted">{progress.done} of {progress.total} rows</p>
            </div>
          ) : null}
          <Button disabled={pending || !report.valid} onClick={commit}>Import {report.valid} rows</Button>
        </section>
      ) : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
