"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, House, Plus, Settings, UserCircle, Users } from "lucide-react";

import { ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

const items = [
  { href: "/", label: "Feed", icon: House },
  { href: "/members", label: "Members", icon: Users },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profile", label: "Profile", icon: UserCircle },
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
    <aside className="fixed top-0 left-0 hidden h-screen w-16 border-r border-border bg-background md:flex md:flex-col md:items-center">
      <div className="flex h-16 items-center justify-center">
        <span className="font-bold text-lg leading-none">F</span>
      </div>

      <nav className="mt-8 flex flex-1 flex-col items-center gap-4">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;

          return (
            <Button
              key={item.href}
              asChild
              variant="ghost"
              size="icon-lg"
              title={item.label}
              className={cn(
                active
                  ? "rounded-full bg-muted text-foreground hover:bg-muted"
                  : "text-muted-foreground"
              )}
            >
              <Link href={item.href} aria-label={item.label}>
                <Icon className="size-6" />
              </Link>
            </Button>
          );
        })}
      </nav>

      <div className="mb-3 flex flex-col items-center gap-2">
        <ThemeToggle title="Toggle theme" />
        <Button
          asChild
          variant="ghost"
          size="icon"
          title="Settings"
          aria-label="Settings"
        >
          <Link href="/settings">
            <Settings className="size-5 text-muted-foreground" />
          </Link>
        </Button>
        <Button
          asChild
          size="icon"
          title="Create"
          className="size-10 rounded-full shadow-md"
        >
          <Link href="/create" aria-label="Create">
            <Plus className="size-5" />
          </Link>
        </Button>
      </div>
    </aside>
  );
}
