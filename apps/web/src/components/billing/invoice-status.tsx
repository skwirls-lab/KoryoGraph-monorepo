import { Badge } from "@koryo/ui/components/ui/badge";

const VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "secondary", open: "outline", partially_paid: "outline", past_due: "destructive", void: "outline", refunded: "outline", draft: "outline",
};

export function InvoiceStatusBadge({ status }: { status: string }) {
  return <Badge variant={VARIANT[status] ?? "outline"}>{status.replace("_", " ")}</Badge>;
}
