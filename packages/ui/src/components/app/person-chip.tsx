import Link from "next/link";
import { cn } from "@koryo/ui/lib/utils";

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export interface PersonChipProps {
  name: string;
  href?: string;
  photoUrl?: string | null;
  meta?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = { sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-12 text-base" } as const;

export function PersonChip({ name, href, photoUrl, meta, size = "md", className }: PersonChipProps) {
  const inner = (
    <>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- storage URLs are signed and short-lived
        <img src={photoUrl} alt="" className={cn("shrink-0 rounded-full object-cover", sizes[size])} />
      ) : (
        <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-brand-subtle font-semibold text-brand-text", sizes[size])}>
          {initials(name)}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate font-medium text-fg">{name}</span>
        {meta ? <span className="block truncate text-xs text-fg-muted">{meta}</span> : null}
      </span>
    </>
  );
  const classes = cn("inline-flex min-w-0 items-center gap-2", className);
  return href ? (
    <Link href={href} className={cn(classes, "rounded-md no-underline hover:underline")}>
      {inner}
    </Link>
  ) : (
    <span className={classes}>{inner}</span>
  );
}
