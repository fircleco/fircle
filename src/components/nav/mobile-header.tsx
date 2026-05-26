"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, House, Image, Menu, Settings, User, Users } from "~/components/ui/icons";

import { formatUnreadBadgeCount } from "~/components/nav/unread-badge";
import { ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

const menuItems = [
  { href: "/", label: "Home", icon: House },
  { href: "/members", label: "Members", icon: Users },
  { href: "/gallery", label: "Gallery", icon: Image },
  { href: "/profile", label: "Profile", icon: User },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileHeader() {
  const pathname = usePathname();
  const shouldPollUnread = !pathname.startsWith("/notifications");

  const managementContext = api.invite.getManagementContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const familyId = managementContext.data?.family?.id;
  const unreadCountQuery = api.notification.getUnreadCount.useQuery(
    {
      familyId: familyId ?? "",
    },
    {
      enabled: Boolean(familyId),
      retry: false,
      refetchOnWindowFocus: shouldPollUnread,
      refetchInterval: shouldPollUnread ? 30_000 : false,
    },
  );

  const unreadCount = typeof unreadCountQuery.data?.count === "number"
    ? unreadCountQuery.data.count
    : 0;
  const unreadLabel = formatUnreadBadgeCount(unreadCount);

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center border-b border-border bg-background/80 px-3 backdrop-blur-sm md:hidden">
      <div className="flex w-full items-center justify-between">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Open menu"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>

          <SheetContent side="left" showCloseButton={false} className="w-[84vw] max-w-sm p-0">
            <SheetHeader className="border-b px-5 py-3">
              <SheetTitle>Fircle</SheetTitle>
            </SheetHeader>
            
            <nav className="px-2 py-3" aria-label="Mobile menu">
              <ul className="flex flex-col gap-1">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActivePath(pathname, item.href);

                  return (
                    <li key={item.href}>
                      <SheetClose asChild>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-base font-medium transition-colors",
                            active
                              ? "bg-muted text-foreground"
                              : "hover:bg-muted",
                          )}
                        >
                          <Icon className="size-6" />
                          <span>{item.label}</span>
                        </Link>
                      </SheetClose>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <SheetFooter className="border-t px-2 py-3">
              <ThemeToggle
                title="Toggle theme"
                className="w-fit justify-start gap-3 rounded-xl px-3"
              />
              <SheetClose asChild>
                <Link
                  href="/settings"
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-base font-medium transition-colors",
                    pathname.startsWith("/settings") ? "bg-muted text-foreground" : "hover:bg-muted",
                  )}
                >
                  <Settings className="size-6" />
                  <span>Settings</span>
                </Link>
              </SheetClose>
              
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="font-bold tracking-tight text-xl">Fircle</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="icon"
            title="Notifications"
            aria-label="Notifications"
            className="relative"
          >
            <Link href="/notifications">
              <Bell className="size-5" />
              {unreadLabel ? (
                <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                  {unreadLabel}
                </span>
              ) : null}
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
