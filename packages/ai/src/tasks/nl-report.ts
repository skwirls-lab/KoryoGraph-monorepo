import { z } from "zod";
import { REPORT_VIEWS } from "../sql-guard";
import type { AiTask } from "../types";

export const nlReportInput = z.object({ question: z.string().trim().min(3).max(500), today: z.string(), school: z.string() });
export type NlReportInput = z.infer<typeof nlReportInput>;

export const chartSpec = z.object({
  type: z.enum(["bar", "line", "table"]),
  /** Column for the x axis (category or date). */
  x: z.string().nullable(),
  /** Numeric column(s) plotted. */
  y: z.array(z.string()).max(4),
  /** Optional column whose values become separate series (≤ 8 distinct values shown). */
  series: z.string().nullable(),
});
export type ChartSpec = z.infer<typeof chartSpec>;

export const nlReportOutput = z.object({
  title: z.string().min(3).max(120),
  sql: z.string().min(10).max(4000),
  chart: chartSpec,
  explanation: z.string().max(400),
});
export type NlReportOutput = z.infer<typeof nlReportOutput>;

/** Plain-English question → one SELECT over the report views + a chart spec (A7). */
export const nlReport: AiTask<NlReportInput, NlReportOutput> = {
  id: "nl_report",
  tier: "frontier",
  description: "Natural-language report",
  input: nlReportInput,
  output: nlReportOutput,
  buildMessages: (i) => [
    { role: "system", content: `You write PostgreSQL for ${i.school}'s reports. Today is ${i.today}. Write ONE SELECT (a WITH is fine) using ONLY these views — no other tables, schemas, comments or quoted identifiers; functions limited to aggregates, round/coalesce/nullif/greatest/least, date_trunc/extract/to_char/age/make_date, lower/upper/trim/concat/length/string_agg. Money is in cents — divide by 100.0 for dollars. Order the rows sensibly and keep results under 5000 rows.
Views:
${Object.entries(REPORT_VIEWS).map(([k, v]) => `${k}: ${v}`).join("\n")}
Pick a chart: "line" for trends over time, "bar" for comparisons, "table" for lists. x = the category/date column, y = the numeric column(s), series = a column to split into separate lines/bars (or null).` },
    { role: "user", content: i.question },
  ],
  maxCostCents: 15,
  temperature: 0,
  fixtureKey: (i) => ({ q: i.question.trim().toLowerCase().replace(/\s+/g, " ") }),
  examples: [{ question: "attendance by program, last 8 weeks", today: "2026-09-25", school: "Ridgeline Taekwondo" }],
};
