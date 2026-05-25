import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { Bell, Comment, Heart, Image as ImageIcon, UserCheck, UserX, Video } from "~/components/ui/icons";

import type { RouterOutputs } from "~/trpc/react";

type NotificationListItem = RouterOutputs["notification"]["listByFamily"]["items"][number];

const eventIcons: Record<NotificationListItem["eventType"], React.ReactNode> = {
  MEDIA_TAG_CREATED: <ImageIcon className="size-4" aria-hidden="true" />,
  MEDIA_TAG_UPDATED: <Video className="size-4" aria-hidden="true" />,
  POST_MENTION_CREATED: <UserCheck className="size-4" aria-hidden="true" />,
  COMMENT_MENTION_CREATED: <UserX className="size-4" aria-hidden="true" />,
  POST_COMMENT_CREATED: <Comment className="size-4" aria-hidden="true" />,
  COMMENT_REPLIED: <Comment className="size-4" aria-hidden="true" />,
  POST_LIKED: <Heart className="size-4" aria-hidden="true" />,
  COMMENT_LIKED: <Heart className="size-4" aria-hidden="true" />,
  INVITE_CREATED: <UserCheck className="size-4" aria-hidden="true" />,
  INVITE_STATUS_CHANGED: <UserX className="size-4" aria-hidden="true" />,
  SYSTEM_EVENT: <Bell className="size-4" aria-hidden="true" />,
};

const categoryColors: Record<NotificationListItem["category"], string> = {
  TAG: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  MENTION: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  ENGAGEMENT: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  INVITE: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  SYSTEM: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
};

type NotificationCardProps = {
  notification: NotificationListItem;
  /** Overrides notification.isRead for visual styling so the card appearance
   * doesn't shift when auto-read updates the server state mid-visit. */
  initialIsRead?: boolean;
};

export function NotificationCard({ notification, initialIsRead }: NotificationCardProps) {
  const { title, body, isRead: serverIsRead, eventType, category, createdAt } = notification;
  const isRead = initialIsRead ?? serverIsRead;
  const createdAtLabel = formatDistanceToNow(new Date(createdAt), { addSuffix: true });
  const thumbnailUrl = null;

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
        {eventIcons[eventType] ?? <Bell className="size-4" aria-hidden="true" />}
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
