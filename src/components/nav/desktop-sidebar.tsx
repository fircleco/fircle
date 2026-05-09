"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, House, Plus, Settings, User, Users } from "~/components/ui/icons";

import { ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

const items = [
  { href: "/", label: "Home", icon: House },
  { href: "/members", label: "Members", icon: Users },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profile", label: "Profile", icon: User },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed top-0 left-0 hidden h-screen w-72 border-r border-border bg-background md:flex md:flex-col">
      <div className="flex h-16 items-center px-6">
        <span className="font-semibold text-xl leading-none tracking-tight">
          Fircle
        </span>
      </div>

      <nav className="mt-4 flex flex-1 flex-col gap-2 px-4">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;

          return (
            <Button
              key={item.href}
              asChild
              variant="ghost"
              size="default"
              title={item.label}
              className={cn(
                "h-12 w-fit justify-start gap-3 rounded-full px-4 text-base text-foreground",
                active && "bg-muted font-semibold hover:bg-muted"
              )}
            >
              <Link href={item.href} aria-label={item.label}>
                <Icon className="size-6" />
                <span>{item.label}</span>
              </Link>
            </Button>
          );
        })}
        <Button
          asChild
          title="Create"
          className={cn(
            "h-12 w-full justify-start gap-3 rounded-full px-4 text-base",
            "bg-primary text-primary-foreground hover:bg-primary/80 text-center"
          )}
        >
          <Link href="/create" aria-label="Create" className="mx-auto">
            <Plus className="size-6" />
            <span>Create</span>
          </Link>
        </Button>
      </nav>

      <div className="flex flex-col gap-2 px-4 pb-4">
        <ThemeToggle
          title="Toggle theme"
          className={cn(
            "h-12 w-fit justify-start gap-3 rounded-full px-4 text-base",
            "text-foreground"
          )}
        />
        <Button
          asChild
          variant="ghost"
          title="Settings"
          aria-label="Settings"
          className={cn(
            "h-12 w-fit justify-start gap-3 rounded-full px-4 text-base",
            "text-foreground"
          )}
        >
          <Link href="/settings">
            <Settings className="size-6" />
            <span>Settings</span>
          </Link>
        </Button>
      </div>
    </aside>
  );
}
