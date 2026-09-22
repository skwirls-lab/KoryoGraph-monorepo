"use client";

import { LogOut, UserRound } from "lucide-react";
import { ThemeToggle } from "@koryo/ui/components/app/theme-toggle";
import { Button } from "@koryo/ui/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@koryo/ui/components/ui/dropdown-menu";

export function UserMenu({ name, email, role }: { name: string; email: string | null; role: string | null }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2" aria-label="Account menu">
          <UserRound aria-hidden className="size-4" />
          <span className="hidden max-w-40 truncate sm:inline">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="space-y-0.5">
          <div className="truncate font-medium">{name}</div>
          {email ? <div className="truncate text-xs font-normal text-fg-muted">{email}</div> : null}
          {role ? <div className="text-xs font-normal capitalize text-fg-muted">{role.replace(/_/g, " ")}</div> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <ThemeToggle />
        </div>
        <DropdownMenuSeparator />
        <form action="/auth/signout" method="post" className="px-1 py-1">
          <Button type="submit" variant="ghost" size="sm" className="w-full justify-start gap-2">
            <LogOut aria-hidden className="size-4" /> Sign out
          </Button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
