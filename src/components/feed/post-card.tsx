import { Heart, Comment, Share } from "~/components/ui/icons";

import { Button } from "~/components/ui/button";

import { PostMediaGrid } from "./post-media-grid";
import { PostMixedMediaStack } from "./post-mixed-media-stack";
import { PostVideoCard } from "./post-video-card";

type PostMediaItem = {
  id: string;
  type: "image" | "video";
  url: string;
  alt: string;
  durationLabel?: string;
};

export type PostCardData = {
  id: string;
  type: "text" | "photo" | "video" | "mixed";
  author: {
    name: string;
    avatarUrl: string;
  };
  createdAtLabel: string;
  body: string;
  mediaItems: PostMediaItem[];
  taggedMembers: { name: string; avatarUrl: string }[];
  reactionCount: number;
  commentCount: number;
};

type PostCardProps = {
  post: PostCardData;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function PostCard({ post }: PostCardProps) {
  const imageItems = post.mediaItems.filter((item) => item.type === "image");
  const videoItems = post.mediaItems.filter((item) => item.type === "video");
  const shouldUseMixedMediaStack = post.type === "mixed" && post.mediaItems.length > 4;
  const showSinglePhotoTaggedOverlay =
    post.type === "photo" && imageItems.length === 1 && post.taggedMembers.length > 0;
  const showSingleVideoTaggedOverlay =
    post.type === "video" && videoItems.length === 1 && post.taggedMembers.length > 0;
  const shouldShowTaggedChips =
    post.taggedMembers.length > 0 && !showSinglePhotoTaggedOverlay && !showSingleVideoTaggedOverlay;

  return (
    <article className="rounded-3xl border border-border/80 bg-card/90 p-4 shadow-sm sm:p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-foreground">
            {getInitials(post.author.name)}
          </div>
          <div>
            <p className="font-medium text-sm text-foreground">{post.author.name}</p>
            <p className="text-muted-foreground text-xs">{post.createdAtLabel}</p>
          </div>
        </div>

        <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          {post.type}
        </span>
      </header>

      {post.body ? (
        <p className="mt-3 text-foreground text-sm leading-6 sm:text-base">{post.body}</p>
      ) : null}

      {shouldShowTaggedChips ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {post.taggedMembers.map((member) => (
            <span
              key={`${post.id}-${member.name}`}
              className="rounded-full border border-border/80 bg-muted px-2.5 py-1 text-[11px] text-muted-foreground"
            >
              {member.name}
            </span>
          ))}
        </div>
      ) : null}

      {post.type === "photo" && imageItems.length > 0 ? (
        <div className="mt-3">
          <PostMediaGrid
            items={imageItems}
            taggedMembers={showSinglePhotoTaggedOverlay ? post.taggedMembers : undefined}
          />
        </div>
      ) : null}

      {post.type === "video" && videoItems.length > 0 ? (
        <div className="mt-3 space-y-2">
          {videoItems.map((item) => (
            <PostVideoCard
              key={item.id}
              title={item.alt}
              durationLabel={item.durationLabel}
              taggedMembers={showSingleVideoTaggedOverlay ? post.taggedMembers : undefined}
            />
          ))}
        </div>
      ) : null}

      {post.type === "mixed" ? (
        <div className="mt-3 space-y-2">
          {shouldUseMixedMediaStack ? (
            <PostMixedMediaStack items={post.mediaItems} />
          ) : (
            <PostMediaGrid items={post.mediaItems} />
          )}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
        <span>{post.reactionCount} reactions</span>
        <span aria-hidden>•</span>
        <span>{post.commentCount} comments</span>
      </div>

      <div className="mt-3 flex items-center gap-2 border-border/70 border-t pt-3">
        <Button type="button" variant="ghost" size="sm" className="rounded-2xl">
          <Heart className="size-4" />
          Like
        </Button>
        <Button type="button" variant="ghost" size="sm" className="rounded-2xl">
          <Comment className="size-4" />
          Comment
        </Button>
        <Button type="button" variant="ghost" size="sm" className="rounded-2xl">
          <Share className="size-4" />
          Share
        </Button>
      </div>
    </article>
  );
}
