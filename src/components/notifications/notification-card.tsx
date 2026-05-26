import Image from "next/image";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Bell, Comment, Heart, Image as ImageIcon, UserCheck, UserSquare, UserX, Video } from "~/components/ui/icons";

type NotificationListItem = {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string | Date;
  eventType:
    | "MEDIA_TAG_CREATED"
    | "MEDIA_TAG_UPDATED"
    | "POST_MENTION_CREATED"
    | "COMMENT_MENTION_CREATED"
    | "POST_COMMENT_CREATED"
    | "COMMENT_REPLIED"
    | "POST_LIKED"
    | "COMMENT_LIKED"
    | "INVITE_CREATED"
    | "INVITE_STATUS_CHANGED"
    | "SYSTEM_EVENT";
  category: "TAG" | "MENTION" | "ENGAGEMENT" | "INVITE" | "SYSTEM";
  targetHref: string | null;
  actorMember: {
    id: string;
    name: string;
    slug: string;
    image: string | null;
  } | null;
};

const eventIcons: Record<NotificationListItem["eventType"], React.ReactNode> = {
  MEDIA_TAG_CREATED: <ImageIcon className="size-4" aria-hidden="true" />,
  MEDIA_TAG_UPDATED: <Video className="size-4" aria-hidden="true" />,
  POST_MENTION_CREATED: <UserSquare className="size-4" aria-hidden="true" />,
  COMMENT_MENTION_CREATED: <UserSquare className="size-4" aria-hidden="true" />,
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

function getNotificationCopy(notification: NotificationListItem) {
  const actorName = notification.actorMember?.name?.trim() ?? "Someone";

  switch (notification.eventType) {
    case "MEDIA_TAG_CREATED":
      return {
        title: `${actorName} tagged you in media`,
        body: "Open to see the tagged photo or video.",
      };
    case "MEDIA_TAG_UPDATED":
      return {
        title: `${actorName} updated your media tag`,
        body: "Open to review the updated media tag.",
      };
    case "POST_MENTION_CREATED":
      return {
        title: `${actorName} mentioned you in a post`,
        body: "Open the post to join the conversation.",
      };
    case "COMMENT_MENTION_CREATED":
      return {
        title: `${actorName} mentioned you in a comment`,
        body: "Open the comment thread to reply.",
      };
    case "POST_COMMENT_CREATED":
      return {
        title: `${actorName} commented on your post`,
        body: "Open the post to see the comment.",
      };
    case "COMMENT_REPLIED":
      return {
        title: `${actorName} replied to your comment`,
        body: "Open the thread to continue the conversation.",
      };
    case "POST_LIKED":
      return {
        title: `${actorName} liked your post`,
        body: "Open the post to see recent activity.",
      };
    case "COMMENT_LIKED":
      return {
        title: `${actorName} liked your comment`,
        body: "Open the thread to see recent activity.",
      };
    case "INVITE_CREATED":
      return {
        title: `${actorName} created a new invite`,
        body: "Open invites to review or share it.",
      };
    case "INVITE_STATUS_CHANGED":
      return {
        title: `${actorName} changed an invite status`,
        body: "Open invites to see the latest status.",
      };
    case "SYSTEM_EVENT":
      return {
        title: notification.title,
        body: notification.body,
      };
    default:
      return {
        title: notification.title,
        body: notification.body,
      };
  }
}

export function NotificationCard({ notification, initialIsRead }: NotificationCardProps) {
  const { isRead: serverIsRead, eventType, category, createdAt, targetHref } = notification;
  const isRead = initialIsRead ?? serverIsRead;
  const createdAtLabel = formatDistanceToNow(new Date(createdAt), { addSuffix: true });
  const thumbnailUrl = null;
  const { title, body } = getNotificationCopy(notification);

  const cardContent = (
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

  if (!targetHref) {
    return cardContent;
  }

  return (
    <Link
      href={targetHref}
      className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2"
      aria-label={title}
    >
      {cardContent}
    </Link>
  );
}
