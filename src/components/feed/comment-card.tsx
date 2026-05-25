"use client";

import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { MentionText } from "~/components/feed/mention-text";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Heart, Comment, More, Edit, Delete } from "~/components/ui/icons";

export type FeedComment = {
  id: string;
  postId: string;
  parentCommentId: string | null;
  content: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  author: {
    id: string;
    name: string;
    slug: string;
    avatarUrl: string;
  };
  mentions: Array<{
    id: string;
    start: number;
    end: number;
    member: {
      id: string;
      name: string;
      slug: string;
      avatarUrl: string;
    };
  }>;
  likedByCurrentUser: boolean;
  likeCount: number;
  replyCount: number;
  replies: FeedComment[];
};

type CommentCardProps = {
  comment: FeedComment;
  isOwnComment: boolean;
  isHighlighted?: boolean;
  onToggleLike: (commentId: string) => void;
  onStartReply: (commentId: string) => void;
  onStartEdit: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  likePending?: boolean;
  showReply?: boolean;
  currentMemberSlug?: string;
  children?: React.ReactNode;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatCreatedAtLabel(dateInput: Date | string) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export function CommentCard({
  comment,
  isOwnComment,
  isHighlighted = false,
  onToggleLike,
  onStartReply,
  onStartEdit,
  onDelete,
  likePending = false,
  showReply = true,
  currentMemberSlug,
  children,
}: CommentCardProps) {
  const authorHref = isOwnComment ? "/profile" : `/member/${comment.author.slug}`;

  return (
    <article
      className={`rounded-2xl border border-border/80 bg-card/90 px-4 py-3 transition-all duration-500 ${
        isHighlighted ? "ring-2 ring-primary/50 bg-primary/5" : ""
      }`}
    >
      <header className="flex items-center gap-3">
        <Link
          href={authorHref}
          className="rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={`Open ${comment.author.name}'s profile`}
        >
          <Avatar className="size-9 shrink-0 border border-border">
            <AvatarImage src={comment.author.avatarUrl} alt={comment.author.name} />
            <AvatarFallback className="text-xs font-semibold text-foreground">
              {getInitials(comment.author.name)}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-none text-foreground">{comment.author.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{formatCreatedAtLabel(comment.createdAt)}</p>
        </div>

        {isOwnComment ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-full"
                aria-label="Open comment actions"
              >
                <More className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-fit rounded-xl" align="end">
              <DropdownMenuItem className="cursor-pointer" onSelect={() => onStartEdit(comment.id)}>
                <Edit className="mr-2 size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive cursor-pointer hover:bg-destructive/20" onSelect={() => onDelete(comment.id)}>
                <Delete className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </header>

      <p className="mt-3 whitespace-pre-wrap leading-relaxed text-foreground">
        <MentionText
          text={comment.content}
          mentions={comment.mentions}
          currentMemberSlug={currentMemberSlug}
        />
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-2xl px-3"
          onClick={() => onToggleLike(comment.id)}
          disabled={likePending}
          aria-pressed={comment.likedByCurrentUser}
          aria-label={comment.likedByCurrentUser ? "Unlike this comment" : "Like this comment"}
        >
          <Heart className={`size-4 ${comment.likedByCurrentUser ? "fill-red-500 text-red-500" : ""}`} />
          Like
          {comment.likeCount > 0 ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
              {comment.likeCount}
            </span>
          ) : null}
        </Button>

        {showReply ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-2xl px-3"
            onClick={() => onStartReply(comment.id)}
          >
            <Comment className="size-4" />
            Reply
          </Button>
        ) : null}

      </div>

      {children ? <div className="mt-3">{children}</div> : null}
    </article>
  );
}
