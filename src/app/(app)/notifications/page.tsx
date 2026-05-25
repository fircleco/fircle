"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Bell } from "~/components/ui/icons";

import { NotificationCard } from "~/components/notifications/notification-card";
import { Button } from "~/components/ui/button";
import { api, type RouterOutputs } from "~/trpc/react";

type NotificationListItem = RouterOutputs["notification"]["listByFamily"]["items"][number];
type FilterCategory = "all" | NotificationListItem["category"];

const filters: { label: string; value: FilterCategory }[] = [
  { label: "All", value: "all" },
  { label: "Tags", value: "TAG" },
  { label: "Mentions", value: "MENTION" },
  { label: "Activity", value: "ENGAGEMENT" },
  { label: "Invites", value: "INVITE" },
  { label: "System", value: "SYSTEM" },
];

const adminOnlyFilters: ReadonlySet<FilterCategory> = new Set(["INVITE", "SYSTEM"]);

export default function NotificationsPage() {
  const [activeFilter, setActiveFilter] = useState<FilterCategory>("all");
  const autoReadTriggeredFamilyRef = useRef<string | null>(null);
  const initialReadStateRef = useRef<Map<string, boolean> | null>(null);
  const trpcUtils = api.useUtils();

  const managementContext = api.invite.getManagementContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const familyId = managementContext.data?.family?.id;
  const isAdmin = managementContext.data?.role === "OWNER" || managementContext.data?.role === "ADMIN";

  const visibleFilters = useMemo(
    () => filters.filter((filter) => isAdmin || !adminOnlyFilters.has(filter.value)),
    [isAdmin],
  );

  useEffect(() => {
    if (!visibleFilters.some((filter) => filter.value === activeFilter)) {
      setActiveFilter("all");
    }
  }, [activeFilter, visibleFilters]);

  const notificationsQuery = api.notification.listByFamily.useQuery(
    {
      familyId: familyId ?? "",
      limit: 50,
    },
    {
      enabled: Boolean(familyId),
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const unreadCountQuery = api.notification.getUnreadCount.useQuery(
    {
      familyId: familyId ?? "",
    },
    {
      enabled: Boolean(familyId),
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const markAllAsReadMutation = api.notification.markAllAsRead.useMutation({
    onSuccess: async () => {
      await Promise.all([
        trpcUtils.notification.listByFamily.invalidate(),
        trpcUtils.notification.getUnreadCount.invalidate(),
      ]);
    },
  });

  useEffect(() => {
    if (!familyId) {
      autoReadTriggeredFamilyRef.current = null;
      return;
    }

    if (!notificationsQuery.isSuccess) {
      return;
    }

    if (!unreadCountQuery.isSuccess) {
      return;
    }

    if (autoReadTriggeredFamilyRef.current === familyId) {
      return;
    }

    const unreadCount = unreadCountQuery.data?.count ?? 0;
    autoReadTriggeredFamilyRef.current = familyId;

    if (unreadCount <= 0) {
      return;
    }

    void markAllAsReadMutation
      .mutateAsync({ familyId })
      .catch(() => {
        autoReadTriggeredFamilyRef.current = null;
      });
  }, [
    familyId,
    notificationsQuery.isSuccess,
    unreadCountQuery.isSuccess,
    unreadCountQuery.data?.count,
    markAllAsReadMutation,
  ]);

  const notifications = useMemo(() => notificationsQuery.data?.items ?? [], [notificationsQuery.data?.items]);

  // Capture initial isRead state once on first successful load so section
  // placement doesn't shift when auto-read flips items server-side.
  if (initialReadStateRef.current === null && notifications.length > 0) {
    initialReadStateRef.current = new Map(
      notifications.map((n) => [n.id, n.isRead]),
    );
  }

  const filtered = useMemo(
    () =>
      activeFilter === "all"
        ? notifications
        : notifications.filter((notification) => notification.category === activeFilter),
    [activeFilter, notifications],
  );

  const snapshot = initialReadStateRef.current;
  const unread = filtered.filter((n) => !(snapshot?.get(n.id) ?? n.isRead));
  const read = filtered.filter((n) => snapshot?.get(n.id) ?? n.isRead);
  const unreadCount = unreadCountQuery.data?.count ?? 0;
  const isLoading = managementContext.isLoading || (Boolean(familyId) && notificationsQuery.isLoading);
  const hasNoFamily = !managementContext.isLoading && !familyId;
  const showMarkAll = unreadCount > 0;

  const handleMarkAllAsRead = async () => {
    if (!familyId || markAllAsReadMutation.isPending) {
      return;
    }

    autoReadTriggeredFamilyRef.current = familyId;
    await markAllAsReadMutation.mutateAsync({ familyId });
  };

  return (
    <section className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Activity</p>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Notifications</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tag events, invites, and family activity.
            </p>
          </div>
          {showMarkAll && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-xs"
              onClick={() => void handleMarkAllAsRead()}
              disabled={markAllAsReadMutation.isPending}
            >
              Mark all as read
            </Button>
          )}
        </div>
      </header>

      {/* Filter chips */}
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Notification filters"
      >
        {visibleFilters.map(({ label, value }) => (
          <button
            key={value}
            role="tab"
            aria-selected={activeFilter === value}
            onClick={() => setActiveFilter(value)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              activeFilter === value
                ? "border-primary bg-primary text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2"
                : "border-border bg-card text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {hasNoFamily ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border bg-card py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Bell className="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <div>
            <p className="font-medium">No family membership found</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Join a family to view your notifications.
            </p>
          </div>
        </div>
      ) : isLoading ? (
        <div className="rounded-3xl border bg-card px-6 py-14 text-center text-sm text-muted-foreground">
          Loading notifications...
        </div>
      ) : notificationsQuery.error ? (
        <div className="rounded-3xl border bg-card px-6 py-14 text-center">
          <p className="font-medium">Unable to load notifications</p>
          <p className="mt-1 text-sm text-muted-foreground">{notificationsQuery.error.message}</p>
          <Button className="mt-4" size="sm" onClick={() => void notificationsQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center gap-3 rounded-3xl border bg-card py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Bell className="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <div>
            <p className="font-medium">No notifications yet</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Tag events and family activity will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Unread section */}
          {unread.length > 0 && (
            <section aria-label="Unread notifications">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                New
              </h2>
              <div className="space-y-2">
                {unread.map((notification) => (
                  <NotificationCard key={notification.id} notification={notification} initialIsRead={snapshot?.get(notification.id) ?? notification.isRead} />
                ))}
              </div>
            </section>
          )}

          {/* Read section */}
          {read.length > 0 && (
            <section aria-label="Earlier notifications">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Earlier
              </h2>
              <div className="space-y-2">
                {read.map((notification) => (
                  <NotificationCard key={notification.id} notification={notification} initialIsRead={snapshot?.get(notification.id) ?? notification.isRead} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </section>
  );
}
