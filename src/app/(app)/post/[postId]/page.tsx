"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ArrowLeft, Heart } from "~/components/ui/icons";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { PostCard } from "~/components/feed/post-card";
import type { PostCardData } from "~/components/feed/post-card";
import { api } from "~/trpc/react";

type PostComment = {
  id: string;
  author: {
    name: string;
    avatarUrl: string;
  };
  createdAtLabel: string;
  body: string;
  reactionCount: number;
};

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

function formatFullPostTimestamp(dateInput: Date | string) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  const fullDate = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${time} · ${fullDate}`;
}

function mapPostToPostCardData(item: {
  id: string;
  type: "TEXT" | "PHOTO" | "VIDEO" | "MIXED";
  author: { name: string; avatarUrl: string };
  createdAt: Date | string;
  caption: string | null;
  mediaItems: Array<{
    id: string;
    type: string;
    url: string;
    alt: string;
    durationLabel?: string;
    caption?: string | null;
  }>;
}): PostCardData {
  return {
    id: item.id,
    type: item.type.toLowerCase() as PostCardData["type"],
    author: {
      name: item.author.name,
      avatarUrl: item.author.avatarUrl,
    },
    createdAtLabel: formatCreatedAtLabel(item.createdAt),
    body: item.caption ?? "",
    mediaItems: item.mediaItems.map((media) => ({
      id: media.id,
      type: media.type === "video" ? "video" : "image",
      url: media.url,
      alt: media.alt,
      caption: media.caption ?? undefined,
      durationLabel: media.durationLabel,
    })),
    taggedMembers: [],
    reactionCount: 0,
    commentCount: 0,
  };
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function CommentCard({ comment }: { comment: PostComment }) {
  return (
    <article className="rounded-2xl border border-border/80 bg-card/90 px-4 py-3">
      {/* Header: avatar + name + timestamp */}
      <header className="flex items-center gap-3">
        <Avatar className="size-9 shrink-0 border border-border">
          <AvatarImage src={comment.author.avatarUrl} alt={comment.author.name} />
          <AvatarFallback className="text-xs font-semibold text-foreground">
            {getInitials(comment.author.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-none">{comment.author.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{comment.createdAtLabel}</p>
        </div>
      </header>

      {/* Body */}
      <p className="mt-3 text-foreground leading-relaxed">{comment.body}</p>

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" className="rounded-2xl px-3">
          <Heart className="size-4" />
          Like
          {comment.reactionCount > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
              {comment.reactionCount}
            </span>
          )}
        </Button>
      </div>
    </article>
  );
}

function CommentInput() {
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasText = value.trim().length > 0;
  const isExpanded = isFocused || hasText;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (!hasText) {
      textarea.style.height = "";
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [hasText, value]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValue("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/90 p-4"
    >
      {/* Current user avatar placeholder */}
      <Avatar className="mb-auto mt-0.5 size-10 shrink-0 border border-border">
        <AvatarFallback className="text-xs font-semibold text-foreground">ME</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Post your reply"
          className="pt-2.5 mt-0.5 min-h-6 w-full resize-none bg-transparent py-1 text-foreground leading-5 placeholder:text-muted-foreground outline-none"
        />

        {isExpanded ? (
          <div className="mt-2 flex justify-end">
            <Button
              type="submit"
              size="sm"
              className="h-9 rounded-full px-4 font-semibold disabled:opacity-100"
              disabled={!hasText}
            >
              Reply
            </Button>
          </div>
        ) : null}
      </div>

      {!isExpanded ? (
        <Button
          type="submit"
          size="sm"
          className="h-9 shrink-0 rounded-full px-4 font-semibold disabled:opacity-100"
          disabled={!hasText}
        >
          Reply
        </Button>
      ) : null}
    </form>
  );
}

export default function SinglePostPage() {
  const router = useRouter();
  const params = useParams<{ postId: string }>();
  const postId = params.postId;

  const managementContext = api.invite.getManagementContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const familyId = managementContext.data?.family?.id;

  const postQuery = api.post.getById.useQuery(
    {
      familyId: familyId ?? "",
      postId,
    },
    {
      enabled: Boolean(familyId && postId),
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const post = postQuery.data ? mapPostToPostCardData(postQuery.data) : undefined;
  const fullPostTimestamp = postQuery.data
    ? formatFullPostTimestamp(postQuery.data.createdAt)
    : undefined;
  const comments: PostComment[] = [];

  const isLoading = managementContext.isLoading || (Boolean(familyId) && postQuery.isLoading);
  const hasNoFamily = !managementContext.isLoading && !familyId;

  if (isLoading) {
    return (
      <section className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-9 w-20 rounded-2xl bg-muted" />
          <div className="rounded-3xl border border-border/80 bg-card/90 p-4 sm:p-5">
            <div className="h-5 w-40 rounded-full bg-muted" />
            <div className="mt-4 h-4 w-full rounded-full bg-muted" />
            <div className="mt-2 h-4 w-3/4 rounded-full bg-muted" />
            <div className="mt-4 aspect-video rounded-2xl bg-muted/80" />
          </div>
        </div>
      </section>
    );
  }

  if (hasNoFamily) {
    return (
      <section className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-6 -ml-1 rounded-2xl"
          onClick={() => router.back()}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div className="rounded-3xl border border-dashed border-border/80 bg-card/70 px-6 py-12 text-center">
          <p className="font-semibold text-lg">No family membership found</p>
          <p className="mt-1 text-muted-foreground text-sm">
            Join a family to view and comment on posts.
          </p>
        </div>
      </section>
    );
  }

  if (postQuery.error) {
    return (
      <section className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-6 -ml-1 rounded-2xl"
          onClick={() => router.back()}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div className="rounded-3xl border border-border/80 bg-card/70 px-6 py-12 text-center">
          <p className="font-semibold text-lg">Unable to load post</p>
          <p className="mt-1 text-muted-foreground text-sm">{postQuery.error.message}</p>
          <Button type="button" className="mt-4" onClick={() => postQuery.refetch()}>
            Retry
          </Button>
        </div>
      </section>
    );
  }

  if (!post) {
    return (
      <section className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-6 -ml-1 rounded-2xl"
          onClick={() => router.back()}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div className="rounded-3xl border border-dashed border-border/80 bg-card/70 px-6 py-12 text-center">
          <p className="font-semibold text-lg">Post not found</p>
          <p className="mt-1 text-muted-foreground text-sm">
            This post may have been removed or the link is incorrect.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      {/* Back */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mb-6 -ml-1 rounded-2xl"
        onClick={() => router.back()}
      >
        <ArrowLeft className="size-4" />
        Back
      </Button>

      {/* Post */}
      <PostCard post={post} showHeaderTimestamp={false} footerMeta={fullPostTimestamp} />
      
      {/* Comment input */}
      <div className="mt-6">
        <CommentInput />
      </div>

      {/* Comments */}
      <section className="mt-5" aria-label="Comments">
        <h2 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {comments.length} {comments.length === 1 ? "Comment" : "Comments"}
        </h2>

        {comments.length > 0 ? (
          <ul className="space-y-5">
            {comments.map((comment) => (
              <li key={comment.id}>
                <CommentCard comment={comment} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/80 bg-card/60 px-6 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No comments yet. Be the first to say something!
            </p>
          </div>
        )}
      </section>
    </section>
  );
}
