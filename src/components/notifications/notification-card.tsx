import Image from "next/image";
import { Bell, Image as ImageIcon, UserCheck, UserX, Video } from "lucide-react";

import type { TagNotificationItem } from "~/lib/mocks/tagging";

const eventIcons: Record<TagNotificationItem["event"], React.ReactNode> = {
  "tag-photo": <ImageIcon className="size-4" aria-hidden="true" />,
  "tag-video": <Video className="size-4" aria-hidden="true" />,
  "family-member-tagged": <UserCheck className="size-4" aria-hidden="true" />,
  "unclaimed-member-tagged": <UserX className="size-4" aria-hidden="true" />,
};

const categoryColors: Record<TagNotificationItem["category"], string> = {
  tags: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  invites: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  system: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
};

type NotificationCardProps = {
  notification: TagNotificationItem;
};

export function NotificationCard({ notification }: NotificationCardProps) {
  const { title, body, createdAtLabel, isRead, thumbnailUrl, event, category } = notification;

  return (
    <article
      className={`flex items-start gap-4 rounded-2xl border px-4 py-3.5 transition-colors ${
        isRead ? "bg-card" : "border-primary/20 bg-primary/5"
      }`}
    >
      {/* Leading icon */}
      <div
        className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${categoryColors[category]}`}
        aria-label={`${category} notification`}
      >
        {eventIcons[event] ?? <Bell className="size-4" aria-hidden="true" />}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className={`text-sm leading-snug ${isRead ? "font-normal" : "font-semibold"}`}>
              {title}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
          </div>

          {/* Thumbnail */}
          {thumbnailUrl && (
            <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border bg-muted">
              <Image
                src={thumbnailUrl}
                alt=""
                fill
                sizes="48px"
                className="object-cover"
              />
            </div>
          )}
        </div>

        {/* Metadata row */}
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{createdAtLabel}</span>
          {!isRead && (
            <span className="size-1.5 rounded-full bg-primary" aria-label="Unread" />
          )}
        </div>
      </div>
    </article>
  );
}
