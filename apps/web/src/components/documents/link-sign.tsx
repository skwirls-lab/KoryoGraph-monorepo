"use client";

import { useState } from "react";
import { completeSigningLink } from "@/server/documents/link-actions";
import { SignForm } from "./sign-form";

export function LinkSign({ token, personName, documentName }: { token: string; personName: string; documentName: string }) {
  const [done, setDone] = useState(false);
  if (done) return <p role="status" className="rounded-xl border border-success/40 bg-success/10 p-4">Signed — thank you. You can close this page.</p>;
  return (
    <SignForm
      agreement={`I have read ${documentName} and agree to it on behalf of ${personName}.`}
      onSign={(v) => completeSigningLink({ token, ...v })}
      onDone={() => setDone(true)}
    />
  );
}
