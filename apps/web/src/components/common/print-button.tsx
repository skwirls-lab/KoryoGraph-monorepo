"use client";

import { Printer } from "lucide-react";
import { Button } from "@koryo/ui/components/ui/button";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => window.print()}><Printer aria-hidden className="size-4" /> {label}</Button>;
}
