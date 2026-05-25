"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu } from "~/components/ui/icons";

import { formatUnreadBadgeCount } from "~/components/nav/unread-badge";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

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
