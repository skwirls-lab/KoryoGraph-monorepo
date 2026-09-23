import { cn } from "@koryo/ui/lib/utils";

export interface RankBadgeProps {
  name: string;
  /** CSS colour of the belt, e.g. "#f5f5f5" for white. */
  beltColor: string;
  stripes?: number;
  stripesMax?: number;
  className?: string;
}

export function RankBadge({ name, beltColor, stripes = 0, stripesMax = 0, className }: RankBadgeProps) {
  const label = stripes > 0 ? `${name}, ${stripes} stripe${stripes === 1 ? "" : "s"}` : name;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-default bg-elevated px-2.5 py-1 text-xs font-medium text-fg",
        className,
      )}
      role="img"
      aria-label={label}
    >
      <span aria-hidden className="relative inline-flex h-2.5 w-7 items-center justify-end overflow-hidden rounded-sm border border-strong" style={{ backgroundColor: beltColor }}>
        {Array.from({ length: Math.max(stripesMax, stripes) }, (_, i) => (
          <span key={i} className={cn("mr-0.5 h-full w-0.5", i < stripes ? "bg-[#111]" : "bg-transparent")} />
        ))}
      </span>
      <span aria-hidden>{name}</span>
      {stripes > 0 ? <span aria-hidden className="text-fg-muted">· {stripes}</span> : null}
    </span>
  );
}
