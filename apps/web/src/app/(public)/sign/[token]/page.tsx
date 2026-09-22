import { createAnonClient } from "@koryo/db/anon";
import { AuthCard } from "@/components/auth/auth-card";
import { DocumentBody } from "@/components/documents/document-body";
import { LinkSign } from "@/components/documents/link-sign";
import { mergeDoc } from "@/lib/documents";

export const metadata = { title: "Sign a document", robots: { index: false } };

export default async function SignLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data } = await createAnonClient().rpc("signature_request_info", { p_token: token });
  const r = data?.[0];
  if (!r || r.expired || r.used) {
    return (
      <AuthCard title={r?.used ? "Already signed" : "Link not valid"} description={r?.used ? "This document has already been signed. Thank you!" : "This signing link is invalid or has expired. Please ask the school for a new one."}>
        <span />
      </AuthCard>
    );
  }
  const body = mergeDoc(r.body, { student_name: r.person_name, guardian_name: r.signer_name ?? "", school_name: r.tenant_name, date: new Date().toISOString().slice(0, 10) });
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <header>
        <p className="font-display font-bold">{r.tenant_name}</p>
        <h1 className="text-2xl font-bold">{r.template_name}</h1>
        <p className="text-sm text-fg-secondary">Version {r.version} · for {r.person_name}</p>
      </header>
      <article className="rounded-xl border border-default bg-surface p-4" aria-label="Document"><DocumentBody body={body} /></article>
      <LinkSign token={token} personName={r.person_name} documentName={r.template_name} />
    </main>
  );
}
