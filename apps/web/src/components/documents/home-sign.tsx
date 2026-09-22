"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signDocument } from "@/server/actions/documents";
import { SignForm } from "./sign-form";

export function HomeSign({ templateId, personId, personName, documentName }: { templateId: string; personId: string; personName: string; documentName: string }) {
  const router = useRouter();
  return (
    <SignForm
      agreement={`I have read ${documentName} and agree to it on behalf of ${personName}.`}
      onSign={(v) => signDocument({ templateId, personId, ...v })}
      onDone={() => { toast.success("Signed — thank you"); router.push("/home/documents"); }}
    />
  );
}
