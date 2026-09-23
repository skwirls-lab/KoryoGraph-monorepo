import { forbidden } from "next/navigation";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@koryo/ui/components/ui/table";
import { MONTH_RANGES, ReportHeader, monthLabel, monthsParam } from "@/components/reports/report-header";
import { todayIn } from "@/lib/people";
import { requireSurfacePage } from "@/server/context";
import { monthsBack, pct, trialFunnel } from "@/server/queries/growth";

export const metadata = { title: "Trial funnel" };

export default async function FunnelReport({ searchParams }: { searchParams: Promise<{ months?: string }> }) {
  const ctx = await requireSurfacePage("desk");
  if (!ctx.permissions.has("reports.read")) forbidden();
  const months = monthsParam((await searchParams).months);
  const from = monthsBack(todayIn(ctx.tz), months - 1);
  const canSee = ctx.modules.has("grow") && ctx.permissions.has("crm.manage");
  const rows = canSee ? await trialFunnel(ctx, from) : [];
  const total = rows.reduce((a, r) => ({ leads: a.leads + r.leads, booked: a.booked + r.booked, attended: a.attended + r.attended, won: a.won + r.won, lost: a.lost + r.lost }), { leads: 0, booked: 0, attended: 0, won: 0, lost: 0 });
  const steps = [{ label: "Leads", n: total.leads }, { label: "Trial booked", n: total.booked }, { label: "Trial attended", n: total.attended }, { label: "Enrolled", n: total.won }];
  const bySource = new Map<string, typeof total>();
  for (const r of rows) {
    const s = bySource.get(r.source) ?? { leads: 0, booked: 0, attended: 0, won: 0, lost: 0 };
    bySource.set(r.source, { leads: s.leads + r.leads, booked: s.booked + r.booked, attended: s.attended + r.attended, won: s.won + r.won, lost: s.lost + r.lost });
  }
  const byMonth = new Map<string, typeof total>();
  for (const r of rows) {
    const s = byMonth.get(r.period) ?? { leads: 0, booked: 0, attended: 0, won: 0, lost: 0 };
    byMonth.set(r.period, { leads: s.leads + r.leads, booked: s.booked + r.booked, attended: s.attended + r.attended, won: s.won + r.won, lost: s.lost + r.lost });
  }
  return (
    <>
      <ReportHeader title="Trial funnel" description={`Leads that arrived since ${monthLabel(from)}, and how far they got. A later stage counts the earlier steps.`}
        path="/desk/reports/funnel" range={months} ranges={MONTH_RANGES} exportHref={`/desk/reports/growth/export?report=funnel&months=${months}`} />
      {!canSee ? <p className="rounded-xl border border-dashed border-default p-4 text-sm text-fg-secondary">The trial funnel needs the Grow module and access to the pipeline.</p> : (
        <>
          <section aria-labelledby="funnel-h" className="rounded-xl border border-default bg-surface p-4">
            <h2 id="funnel-h" className="mb-3 font-semibold">Conversion</h2>
            <ol className="space-y-2" aria-label="Funnel steps">
              {steps.map((s, i) => (
                <li key={s.label} className="grid grid-cols-[8rem_1fr_7rem] items-center gap-3 text-sm">
                  <span>{s.label}</span>
                  <span className="h-6 rounded-sm bg-elevated" aria-hidden><span className="block h-6 rounded-r-sm bg-primary" style={{ width: `${total.leads ? (s.n / total.leads) * 100 : 0}%` }} /></span>
                  <span className="tabular-nums text-right"><strong>{s.n}</strong>{i > 0 ? <span className="text-fg-muted"> · {pct(s.n, steps[i - 1]?.n ?? 0)}</span> : null}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-fg-muted">{total.lost} lost · lead → enrolled {pct(total.won, total.leads)}</p>
          </section>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {[{ id: "src", title: "By source", map: bySource }, { id: "mon", title: "By month", map: byMonth }].map((t) => (
              <section key={t.id} aria-labelledby={`${t.id}-h`}>
                <h2 id={`${t.id}-h`} className="mb-2 font-semibold">{t.title}</h2>
                <div className="overflow-x-auto rounded-xl border border-default bg-surface">
                  <Table><caption className="sr-only">Trial funnel {t.title.toLowerCase()}</caption>
                    <TableHeader><TableRow><TableHead>{t.id === "src" ? "Source" : "Month"}</TableHead><TableHead className="text-right">Leads</TableHead><TableHead className="text-right">Booked</TableHead><TableHead className="text-right">Attended</TableHead><TableHead className="text-right">Enrolled</TableHead><TableHead className="text-right">Rate</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {[...t.map.entries()].map(([k, v]) => (
                        <TableRow key={k}><TableCell>{t.id === "mon" ? monthLabel(k) : k}</TableCell><TableCell className="text-right tabular">{v.leads}</TableCell><TableCell className="text-right tabular">{v.booked}</TableCell><TableCell className="text-right tabular">{v.attended}</TableCell><TableCell className="text-right tabular">{v.won}</TableCell><TableCell className="text-right tabular">{pct(v.won, v.leads)}</TableCell></TableRow>
                      ))}
                      {!t.map.size ? <TableRow><TableCell colSpan={6} className="text-center text-fg-muted">No leads in this period.</TableCell></TableRow> : null}
                    </TableBody>
                    {t.map.size ? <TableFooter><TableRow><TableCell>Total</TableCell><TableCell className="text-right tabular">{total.leads}</TableCell><TableCell className="text-right tabular">{total.booked}</TableCell><TableCell className="text-right tabular">{total.attended}</TableCell><TableCell className="text-right tabular">{total.won}</TableCell><TableCell className="text-right tabular">{pct(total.won, total.leads)}</TableCell></TableRow></TableFooter> : null}
                  </Table>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
