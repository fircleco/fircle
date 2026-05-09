"use client";

import { useState } from "react";

import { Heart, Comment, Share } from "~/components/ui/icons";

import { Button } from "~/components/ui/button";

import { PostMediaGrid } from "./post-media-grid";
import { TaggedMemberAvatarStack } from "./tagged-member-avatar-stack";
import { PostMixedMediaStack } from "./post-mixed-media-stack";
import { PostVideoCard } from "./post-video-card";
import { MediaViewerDialog } from "./media-viewer-dialog";

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
        {member?.avatarUrl ? (
          <img
            src={member.avatarUrl}
            alt={memberName}
            className="size-4 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-4 items-center justify-center rounded-full bg-border text-[8px] font-semibold text-foreground">
            {memberName[0]?.toUpperCase()}
          </span>
        )}
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

export function PostCard({ post }: PostCardProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStart, setViewerStart] = useState(0);

  function openViewer(index: number) {
    setViewerStart(index);
    setViewerOpen(true);
  }

  const imageItems = post.mediaItems.filter((item) => item.type === "image");
  const videoItems = post.mediaItems.filter((item) => item.type === "video");
  const shouldUseMixedMediaStack = post.type === "mixed" && post.mediaItems.length > 4;

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
        <div className="mt-3">
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
        <div className="mt-3 space-y-2">
          {videoItems.map((item) => (
            <PostVideoCard
              key={item.id}
              title={item.alt}
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
        <div className="mt-3 space-y-2">
          {shouldUseMixedMediaStack ? (
            <PostMixedMediaStack items={post.mediaItems} onItemClick={openViewer} />
          ) : (
            <PostMediaGrid items={post.mediaItems} onItemClick={openViewer} />
          )}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-border/70 pt-2">
        <Button type="button" variant="ghost" size="sm" className="rounded-2xl px-3">
          <Heart className="size-4" />
          Like
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
            {post.reactionCount}
          </span>
        </Button>
        <Button type="button" variant="ghost" size="sm" className="rounded-2xl px-3">
          <Comment className="size-4" />
          Comment
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
            {post.commentCount}
          </span>
        </Button>
        <Button type="button" variant="ghost" size="sm" className="ml-auto rounded-2xl px-3">
          <Share className="size-4" />
          Share
        </Button>
      </div>

      <MediaViewerDialog
        items={post.mediaItems}
        startIndex={viewerStart}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />
    </article>
  );
}
