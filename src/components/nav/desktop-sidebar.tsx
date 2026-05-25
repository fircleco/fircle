"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, House, Image, Plus, Settings, User, Users } from "~/components/ui/icons";

import { useGlobalComposer } from "~/components/feed/global-composer-provider";
import { formatUnreadBadgeCount } from "~/components/nav/unread-badge";
import { ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

const items = [
  { href: "/", label: "Home", icon: House },
  { href: "/members", label: "Members", icon: Users },
  { href: "/gallery", label: "Gallery", icon: Image },
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
  const { openComposer } = useGlobalComposer();
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

  const unreadLabel = formatUnreadBadgeCount(unreadCountQuery.data?.count ?? 0);

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
                <span className="relative inline-flex">
                  <Icon className="size-6" />
                  {item.href === "/notifications" && unreadLabel ? (
                    <span className="absolute -top-2 -right-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-background bg-red-500 px-1 text-[10px] font-semibold text-white">
                      {unreadLabel}
                    </span>
                  ) : null}
                </span>
                <span>{item.label}</span>
              </Link>
            </Button>
          );
        })}
        <Button
          type="button"
          title="Create"
          onClick={() => openComposer()}
          className={cn(
            "h-12 w-full justify-start gap-3 rounded-full px-4 text-base",
            "bg-primary text-primary-foreground hover:bg-primary/80 text-center"
          )}
        >
          <span aria-label="Create" className="mx-auto inline-flex items-center gap-3">
            <Plus className="size-6" />
            <span>Create</span>
          </span>
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
