"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { Heart, Comment, Share } from "~/components/ui/icons";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

import { PostMediaGrid } from "./post-media-grid";
import { TaggedMemberAvatarStack } from "./tagged-member-avatar-stack";
import { PostVideoCard } from "./post-video-card";
import { MediaViewerDialog } from "./media-viewer-dialog";

type PostMediaItem = {
  id: string;
  type: "image" | "video";
  url: string;
  alt: string;
  caption?: string;
  durationLabel?: string;
  tags?: Array<{
    id: string;
    postMediaId: string;
    taggedMemberId: string;
    xPercent: number | null;
    yPercent: number | null;
    taggedMember: {
      id: string;
      name: string;
      avatarUrl: string;
    };
  }>;
  taggedMembers?: { name: string; avatarUrl: string }[];
};

export type PostCardData = {
  id: string;
  type: "text" | "photo" | "video" | "mixed";
  author: {
    name: string;
    slug?: string;
    avatarUrl: string;
  };
  createdAtLabel: string;
  body: string;
  mediaItems: PostMediaItem[];
  taggedMembers: { name: string; avatarUrl: string }[];
  likedByCurrentUser?: boolean;
  reactionCount: number;
  commentCount: number;
};

type PostCardProps = {
  post: PostCardData;
  showHeaderTimestamp?: boolean;
  footerMeta?: string;
  showActionsSeparator?: boolean;
  currentMemberSlug?: string;
  familyId?: string;
};

function renderBody(
  body: string,
  taggedMembers: { name: string; avatarUrl: string }[],
): React.ReactNode {
  if (taggedMembers.length === 0) return body;

  // Build a regex that matches any @MemberName token
  const names = taggedMembers.map((m) => m.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`@(${names.join("|")})`, "g");

  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(body)) !== null) {
    if (match.index > last) parts.push(body.slice(last, match.index));
    const memberName = match[1]!;
    const member = taggedMembers.find((m) => m.name === memberName);
    parts.push(
      <a
        href="#"
        key={`${memberName}-${match.index}`}
        className="mx-0.5 inline-flex items-center gap-1 align-middle whitespace-nowrap"
      >
        <Avatar className="size-4">
          <AvatarImage src={member?.avatarUrl} alt={memberName} />
          <AvatarFallback className="bg-border text-[8px] font-semibold text-foreground">
            {memberName[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="font-medium leading-none text-foreground">{memberName}</span>
      </a>,
    );
    last = match.index + match[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return parts;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function PostCard({
  post,
  showHeaderTimestamp = true,
  footerMeta,
  showActionsSeparator = false,
  currentMemberSlug,
  familyId,
}: PostCardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const trpcUtils = api.useUtils();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStart, setViewerStart] = useState(0);
  const likeIconRef = useRef<HTMLSpanElement>(null);
  const [optimisticLikedByCurrentUser, setOptimisticLikedByCurrentUser] = useState<
    boolean | undefined
  >(undefined);
  const [optimisticReactionCount, setOptimisticReactionCount] = useState<number | undefined>(
    undefined,
  );

  const toggleLikeMutation = api.post.toggleLike.useMutation({
    onSuccess: async () => {
      await Promise.all([
        trpcUtils.post.getFeed.invalidate(),
        trpcUtils.post.getById.invalidate(),
        trpcUtils.post.getPostsByMember.invalidate(),
      ]);
    },
  });

  useEffect(() => {
    setOptimisticLikedByCurrentUser(undefined);
    setOptimisticReactionCount(undefined);
  }, [post.id, post.likedByCurrentUser, post.reactionCount]);

  const likedByCurrentUser = optimisticLikedByCurrentUser ?? post.likedByCurrentUser ?? false;
  const reactionCount = optimisticReactionCount ?? post.reactionCount;
  const canToggleLike = Boolean(familyId) && !toggleLikeMutation.isPending;

  function handleToggleLike() {
    if (!familyId || toggleLikeMutation.isPending) {
      return;
    }

    const previousLikedByCurrentUser = likedByCurrentUser;
    const previousReactionCount = reactionCount;
    const nextLikedByCurrentUser = !previousLikedByCurrentUser;
    const nextReactionCount = nextLikedByCurrentUser
      ? previousReactionCount + 1
      : Math.max(previousReactionCount - 1, 0);

    const likeIcon = likeIconRef.current;
    if (
      likeIcon &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      likeIcon.getAnimations().forEach((animation) => animation.cancel());
      likeIcon.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(1.5)" },
          { transform: "scale(1)" },
        ],
        {
          duration: 540,
          easing: "cubic-bezier(0.2, 0.9, 0.2, 1)",
          iterations: 1,
        },
      );
    }

    setOptimisticLikedByCurrentUser(nextLikedByCurrentUser);
    setOptimisticReactionCount(nextReactionCount);

    toggleLikeMutation.mutate(
      {
        familyId,
        postId: post.id,
      },
      {
        onSuccess: (result) => {
          setOptimisticLikedByCurrentUser(result.likedByCurrentUser);
          setOptimisticReactionCount(result.reactionCount);
        },
        onError: () => {
          setOptimisticLikedByCurrentUser(previousLikedByCurrentUser);
          setOptimisticReactionCount(previousReactionCount);
        },
      },
    );
  }

  function openViewer(index: number) {
    setViewerStart(index);
    setViewerOpen(true);
  }

  const imageItems = post.mediaItems.filter((item) => item.type === "image");
  const videoItems = post.mediaItems.filter((item) => item.type === "video");
  const isClickable = !pathname?.startsWith("/post/");
  const authorHref = post.author.slug
    ? post.author.slug === currentMemberSlug
      ? "/profile"
      : `/member/${post.author.slug}`
    : undefined;

  function navigateToPost() {
    router.push(`/post/${post.id}`);
  }

  function handleOpenComments() {
    router.push(`/post/${post.id}`);
  }

  return (
    <article
      role={isClickable ? "link" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={isClickable ? `Open post by ${post.author.name}` : undefined}
      className={`rounded-3xl border border-border/80 bg-card/90 p-4 shadow-sm sm:p-5 ${
        isClickable
          ? "cursor-pointer outline-none transition-colors hover:border-border hover:bg-card"
          : "cursor-default"
      }`}
      onClick={isClickable ? navigateToPost : undefined}
      onKeyDown={
        isClickable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                navigateToPost();
              }
            }
          : undefined
      }
    >
      <header className="flex items-start justify-between gap-3">
        {authorHref ? (
          <Link
            href={authorHref}
            className="flex items-center gap-3 rounded-2xl outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={(event) => event.stopPropagation()}
          >
            <Avatar className="size-10 border border-border">
              <AvatarImage src={post.author.avatarUrl} alt={post.author.name} />
              <AvatarFallback className="text-xs font-semibold text-foreground">
                {getInitials(post.author.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm text-foreground">{post.author.name}</p>
              {showHeaderTimestamp ? (
                <p className="text-muted-foreground text-xs">{post.createdAtLabel}</p>
              ) : null}
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <Avatar className="size-10 border border-border">
              <AvatarImage src={post.author.avatarUrl} alt={post.author.name} />
              <AvatarFallback className="text-xs font-semibold text-foreground">
                {getInitials(post.author.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm text-foreground">{post.author.name}</p>
              {showHeaderTimestamp ? (
                <p className="text-muted-foreground text-xs">{post.createdAtLabel}</p>
              ) : null}
            </div>
          </div>
        )}

        {post.taggedMembers.length > 0 && post.type !== "text" ? (
          <TaggedMemberAvatarStack members={post.taggedMembers} />
        ) : null}
      </header>

      {post.body ? (
        <p className="mt-3 text-foreground text-sm leading-6 sm:text-base">
          {renderBody(post.body, post.type === "text" ? post.taggedMembers : [])}
        </p>
      ) : null}

      {post.type === "photo" && imageItems.length > 0 ? (
        <div className="mt-3" onClick={(event) => event.stopPropagation()}>
          <PostMediaGrid
            items={imageItems}
            onItemClick={(localIdx) => {
              const globalIdx = post.mediaItems.findIndex((m) => m.id === imageItems[localIdx]?.id);
              openViewer(globalIdx >= 0 ? globalIdx : localIdx);
            }}
          />
        </div>
      ) : null}

      {post.type === "video" && videoItems.length > 0 ? (
        <div className="mt-3 space-y-2" onClick={(event) => event.stopPropagation()}>
          {videoItems.map((item) => (
            <PostVideoCard
              key={item.id}
              title={item.alt}
              caption={item.caption}
              url={item.url}
              durationLabel={item.durationLabel}
              onClick={() => {
                const globalIdx = post.mediaItems.findIndex((m) => m.id === item.id);
                openViewer(globalIdx >= 0 ? globalIdx : 0);
              }}
            />
          ))}
        </div>
      ) : null}

      {post.type === "mixed" ? (
        <div className="mt-3 space-y-2" onClick={(event) => event.stopPropagation()}>
          <PostMediaGrid items={post.mediaItems} onItemClick={openViewer} />
        </div>
      ) : null}

      {footerMeta ? (
        <p className="mt-4 text-muted-foreground text-sm">{footerMeta}</p>
      ) : null}

      <div
        className={`mt-4 flex flex-wrap items-center gap-2 pt-2 ${
          showActionsSeparator ? "border-t border-border/70" : ""
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-2xl px-3"
          onClick={handleToggleLike}
          disabled={!canToggleLike}
          aria-pressed={likedByCurrentUser}
          aria-label={likedByCurrentUser ? "Unlike this post" : "Like this post"}
        >
          <span ref={likeIconRef} className="inline-flex items-center justify-center">
            <Heart className={`size-5 ${likedByCurrentUser ? "text-red-500 fill-red-500" : ""}`} />
          </span>
          Like
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
            {reactionCount}
          </span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-2xl px-3"
          onClick={handleOpenComments}
          aria-label={`Open comments for this post (${post.commentCount})`}
        >
          <Comment className="size-5" />
          Comment
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
            {post.commentCount}
          </span>
        </Button>
        <Button type="button" variant="ghost" size="sm" className="ml-auto rounded-2xl px-3">
          <Share className="size-5" />
          Share
        </Button>
      </div>

      {toggleLikeMutation.error ? (
        <p className="mt-2 text-xs text-destructive" role="status" aria-live="polite">
          {toggleLikeMutation.error.message}
        </p>
      ) : null}

      <MediaViewerDialog
        items={post.mediaItems}
        startIndex={viewerStart}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        familyId={familyId}
      />
    </article>
  );
}
