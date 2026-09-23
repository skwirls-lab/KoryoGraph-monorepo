"use client";

import { PageError } from "@/components/states/page-states";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError error={error} reset={reset} home="/home" />;
}
