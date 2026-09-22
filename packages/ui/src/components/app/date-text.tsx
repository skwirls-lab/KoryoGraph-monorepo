import { cn } from "@koryo/ui/lib/utils";

export type DateStyle = "date" | "datetime" | "time" | "short" | "weekday";

const presets: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  date: { year: "numeric", month: "short", day: "numeric" },
  datetime: { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  time: { hour: "numeric", minute: "2-digit" },
  short: { month: "short", day: "numeric" },
  weekday: { weekday: "short", month: "short", day: "numeric" },
};

export function formatDate(value: string | Date, timeZone: string, style: DateStyle = "date", locale = "en-US"): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, { ...presets[style], timeZone }).format(d);
}

export interface DateTextProps {
  value: string | Date;
  /** Tenant timezone (IANA). Stored values are UTC. */
  timeZone: string;
  style?: DateStyle;
  locale?: string;
  className?: string;
}

export function DateText({ value, timeZone, style = "date", locale = "en-US", className }: DateTextProps) {
  const iso = typeof value === "string" ? value : value.toISOString();
  return (
    <time dateTime={iso} className={cn("tabular", className)}>
      {formatDate(value, timeZone, style, locale)}
    </time>
  );
}
