"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, House, PlusCircle, UserCircle, Users } from "lucide-react";

import { cn } from "~/lib/utils";

const items = [
  { href: "/", label: "Feed", icon: House },
  { href: "/members", label: "Members", icon: Users },
  { href: "/create", label: "Create", icon: PlusCircle, prominent: true },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profile", label: "Profile", icon: UserCircle },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background md:hidden">
      <ul className="mx-auto flex h-16 max-w-screen-sm items-center justify-around px-2 pb-[max(env(safe-area-inset-bottom),0px)]">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                title={item.label}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-0.5 py-1 text-xs font-medium",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex items-center justify-center rounded-full transition-colors",
                    item.prominent
                      ? "size-9 bg-primary text-primary-foreground"
                      : "size-8"
                  )}
                >
                  <Icon className={cn(item.prominent ? "size-5" : "size-[18px]")} />
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
