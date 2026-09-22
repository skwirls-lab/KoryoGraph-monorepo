"use client";

import { MessageSquare } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@koryo/ui/components/ui/dialog";
import { Label } from "@koryo/ui/components/ui/label";
import { Textarea } from "@koryo/ui/components/ui/textarea";
import { messageClass } from "@/server/actions/messaging";

export function MessageClass({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="min-h-11 gap-2"><MessageSquare aria-hidden className="size-4" /> Message this class</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Message this class</DialogTitle><DialogDescription>Sent to the families on this roster by email and text, respecting their consent.</DialogDescription></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); start(async () => {
          const r = await messageClass({ sessionId, message });
          if (!r.ok) return void toast.error(r.error);
          const parts = Object.entries(r.data).map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`).join(", ");
          toast.success(`Message recorded: ${parts}`);
          setOpen(false);
          setMessage("");
        }); }}>
          <Label htmlFor="class-msg">Message</Label>
          <Textarea id="class-msg" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
          <Button type="submit" disabled={pending || !message.trim()}>{pending ? "Sending…" : "Send"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
