"use client";

import { Bell, Menu } from "lucide-react";

import { Button } from "~/components/ui/button";

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center border-b border-border bg-background/80 px-3 backdrop-blur-sm md:hidden">
      <div className="flex w-full items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Open menu"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </Button>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="font-bold tracking-tight text-xl">fircle</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Notifications"
            aria-label="Notifications"
            className="relative"
          >
            <Bell className="size-5" />
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
              2
            </span>
          </Button>

          <div
            title="Profile"
            aria-hidden
            className="size-8 rounded-full border border-border bg-muted"
          />
        </div>
      </div>
    </header>
  );
}
