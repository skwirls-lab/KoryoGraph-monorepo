"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { bookSession, cancelBooking } from "@/server/actions/bookings";

export function BookButton({ sessionId, personId, full, label, size = "sm" }: { sessionId: string; personId: string; full: boolean; label: string; size?: "sm" | "default" }) {
  const [pending, start] = useTransition();
  return (
    <Button size={size} variant={full ? "outline" : "default"} disabled={pending} aria-label={`${full ? "Join waitlist" : "Book"} ${label}`}
      onClick={() => start(async () => {
        const r = await bookSession({ sessionId, personId });
        if (!r.ok) return void toast.error(r.error);
        toast.success(r.data.status === "waitlisted" ? `On the waitlist (#${r.data.waitlistPosition})` : "Booked");
      })}>
      {full ? "Join waitlist" : "Book"}
    </Button>
  );
}

export function CancelBookingButton({ bookingId, sessionId, label, size = "sm" }: { bookingId: string; sessionId: string; label: string; size?: "sm" | "default" }) {
  const [pending, start] = useTransition();
  return (
    <Button size={size} variant="ghost" className="text-danger" disabled={pending} aria-label={`Cancel ${label}`}
      onClick={() => start(async () => {
        const r = await cancelBooking({ bookingId, sessionId });
        if (!r.ok) return void toast.error(r.error);
        toast.success(r.data.creditEarned ? "Cancelled — a makeup credit was added" : "Cancelled");
      })}>
      Cancel
    </Button>
  );
}
