"use client";

import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@koryo/ui/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@koryo/ui/components/ui/dropdown-menu";
import { switchTenant } from "@/server/actions/session";

export interface TenantOption {
  id: string;
  name: string;
}

export function TenantSwitcher({ current, tenants }: { current: TenantOption; tenants: TenantOption[] }) {
  const [pending, start] = useTransition();
  if (tenants.length <= 1) {
    return (
      <span className="inline-flex min-w-0 items-center gap-2 font-medium">
        <Building2 aria-hidden className="size-4 shrink-0 text-fg-muted" />
        <span className="truncate">{current.name}</span>
      </span>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="min-w-0 gap-2" disabled={pending} aria-label="Switch school">
          <Building2 aria-hidden className="size-4 shrink-0" />
          <span className="truncate">{current.name}</span>
          <ChevronsUpDown aria-hidden className="size-4 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Your schools</DropdownMenuLabel>
        {tenants.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onSelect={() =>
              t.id !== current.id &&
              start(async () => {
                const r = await switchTenant(t.id);
                if (r && !r.ok) toast.error(r.error);
              })
            }
          >
            <span className="flex-1 truncate">{t.name}</span>
            {t.id === current.id ? <Check aria-hidden className="size-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
