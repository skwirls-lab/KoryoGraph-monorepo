import { cn } from "@koryo/ui/lib/utils";

export function formatMoney(cents: number, currency = "USD", locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

export interface MoneyTextProps {
  cents: number;
  currency?: string;
  locale?: string;
  /** Colour negatives red and positives neutral. */
  signed?: boolean;
  className?: string;
}

export function MoneyText({ cents, currency = "USD", locale = "en-US", signed, className }: MoneyTextProps) {
  return (
    <span className={cn("tabular", signed && cents < 0 && "text-danger", className)}>
      {formatMoney(cents, currency, locale)}
    </span>
  );
}
