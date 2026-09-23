"use client";

import { useState, useTransition } from "react";
import { Button } from "@koryo/ui/components/ui/button";
import { acceptInvitation } from "@/server/actions/invitations";

export function Invitations({ invites }: { invites: { id: string; school: string; role: string }[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <ul className="space-y-2" aria-label="Invitations">
        {invites.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-2 rounded-md border border-default p-3 text-sm">
            <span className="flex-1"><strong>{i.school}</strong> invited you as {i.role}.</span>
            <Button size="sm" disabled={pending} onClick={() => start(async () => { const r = await acceptInvitation({ id: i.id }); if (r && !r.ok) setError(r.error); })}>Accept</Button>
          </li>
        ))}
      </ul>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
