import { Bell } from "lucide-react";

import { NotificationCard } from "~/components/notifications/notification-card";
import { tagNotifications, type TagNotificationItem } from "~/lib/mocks/tagging";
import { Button } from "~/components/ui/button";

type FilterCategory = "all" | TagNotificationItem["category"];

const filters: { label: string; value: FilterCategory }[] = [
  { label: "All", value: "all" },
  { label: "Tags", value: "tags" },
  { label: "Invites", value: "invites" },
  { label: "System", value: "system" },
];

// Static active filter — visual-only, no interactivity in this phase
const activeFilter: FilterCategory = "all";

const filtered =
  activeFilter === "all"
    ? tagNotifications
    : tagNotifications.filter((n) => n.category === activeFilter);

const unread = filtered.filter((n) => !n.isRead);
const read = filtered.filter((n) => n.isRead);

export default function NotificationsPage() {
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
          {/* Mark all as read — visual-only */}
          {unread.length > 0 && (
            <Button variant="ghost" size="sm" className="shrink-0 text-xs">
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
        {filters.map(({ label, value }) => (
          <button
            key={value}
            role="tab"
            aria-selected={activeFilter === value}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              activeFilter === value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      {filtered.length === 0 ? (
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
                  <NotificationCard key={notification.id} notification={notification} />
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
                  <NotificationCard key={notification.id} notification={notification} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </section>
  );
}