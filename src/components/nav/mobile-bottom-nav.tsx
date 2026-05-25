"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Image, PlusCircle, User, Users } from "~/components/ui/icons";

import { useGlobalComposer } from "~/components/feed/global-composer-provider";
import { cn } from "~/lib/utils";

const items = [
  { href: "/", label: "Feed", icon: House },
  { href: "/members", label: "Members", icon: Users },
  { href: "#", label: "Create", icon: PlusCircle, prominent: true, action: "composer" },
  { href: "/gallery", label: "Gallery", icon: Image },
  { href: "/profile", label: "Profile", icon: User },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const { openComposer } = useGlobalComposer();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background md:hidden">
      <ul className="mx-auto flex h-16 max-w-screen-sm items-center justify-around px-2 pb-[max(env(safe-area-inset-bottom),0px)]">
        {items.map((item) => {
          const active = item.action === "composer" ? false : isActivePath(pathname, item.href);
          const Icon = item.icon;

          return (
            <li key={item.href} className="flex-1">
              {item.action === "composer" ? (
                <button
                  type="button"
                  title={item.label}
                  aria-label={item.label}
                  onClick={() => openComposer()}
                  className={cn(
                    "flex w-full flex-col items-center justify-center gap-0.5 py-1 text-xs font-medium",
                    "text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center rounded-full transition-colors",
                      item.prominent ? "size-9 bg-primary text-primary-foreground" : "size-8"
                    )}
                  >
                    <Icon className={cn(item.prominent ? "size-6" : "size-5")} />
                  </span>
                </button>
              ) : (
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
                      item.prominent ? "size-9 bg-primary text-primary-foreground" : "size-8"
                    )}
                  >
                    <Icon className={cn(item.prominent ? "size-6" : "size-5")} />
                  </span>
                  {/* <span>{item.label}</span> */}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
