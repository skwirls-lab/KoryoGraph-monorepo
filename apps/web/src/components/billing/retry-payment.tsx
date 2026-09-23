"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { retryInvoicePayment } from "@/server/actions/billing";

export function RetryPaymentButton({ invoiceId }: { invoiceId: string }) {
  const [pending, start] = useTransition();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const router = useRouter();
  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => {
      const r = await retryInvoicePayment({ invoiceId, attemptKey: key });
      setKey(crypto.randomUUID());
      if (r.ok) toast.success(r.data.status === "succeeded" ? "Payment succeeded" : "Payment processing");
      else toast.error(r.error);
      router.refresh();
    })}>
      {pending ? "Retrying…" : "Retry card"}
    </Button>
  );
}
