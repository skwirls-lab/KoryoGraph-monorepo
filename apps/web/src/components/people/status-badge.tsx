import { Badge } from "@koryo/ui/components/ui/badge";
import { cn } from "@koryo/ui/lib/utils";
import { STATUS_LABELS, type PersonStatus } from "@/lib/people";

const TONE: Record<PersonStatus, string> = {
  lead: "border-info/40 text-info",
  trial: "border-warning/40 text-warning",
  active: "border-success/40 text-success",
  on_hold: "border-warning/40 text-warning",
  cancelled: "border-danger/40 text-danger",
  alumni: "border-default text-fg-secondary",
  staff: "border-default text-fg-secondary",
  guardian_only: "border-default text-fg-secondary",
};

export function StatusBadge({ status }: { status: string }) {
  const s = (status in STATUS_LABELS ? status : "active") as PersonStatus;
  return (
    <Badge variant="outline" className={cn("bg-transparent", TONE[s])}>
      {STATUS_LABELS[s]}
    </Badge>
  );
}
