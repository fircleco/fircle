"use client";

import Image from "next/image";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { PlayCircle } from "~/components/ui/icons";
import { getVideoThumbnailSrc } from "~/lib/video-thumbnail";
import { cn } from "~/lib/utils";

import type { FamilyGalleryItem } from "./gallery-types";

type GalleryMediaTileProps = {
  item: FamilyGalleryItem;
  onClick?: () => void;
  className?: string;
  priority?: boolean;
  sizes?: string;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function GalleryMediaTile({
  item,
  onClick,
  className,
  priority = false,
  sizes,
}: GalleryMediaTileProps) {
  const media = item.mediaItem;
  const isVideo = media.type === "video";
  const videoThumbnailSrc = isVideo ? getVideoThumbnailSrc(media.url) : media.url;
  const caption = media.caption?.trim();
  const authorName = item.post.author.name;
  const authorAvatarUrl = item.post.author.avatarUrl;
  const mediaLabel = media.alt ?? caption ?? `${authorName} shared media`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative h-full w-full overflow-hidden rounded-2xl border border-border/80 bg-muted/50 text-left",
        "outline-none transition duration-200 hover:border-border hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      aria-label={`Open media from ${authorName}`}
    >
      <div className="relative h-full w-full">
        {isVideo ? (
          <video
            src={videoThumbnailSrc}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            aria-label={mediaLabel}
          />
        ) : (
          <Image
            src={media.url}
            alt={mediaLabel}
            fill
            unoptimized
            sizes={sizes ?? "(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 20vw"}
            priority={priority}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        )}

        <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/20 to-transparent" />

        {isVideo ? (
          <PlayCircle
            className="pointer-events-none absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 fill-white/85 text-white sm:size-12"
            aria-hidden="true"
          />
        ) : null}

        {media.durationLabel ? (
          <span className="absolute right-2 top-2 rounded-full border border-white/30 bg-black/65 px-2 py-0.5 text-[11px] font-medium text-white">
            {media.durationLabel}
          </span>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 p-1.5 text-white sm:p-1.5">
          <div
            className="inline-flex max-w-full items-center rounded-full border border-white/25 bg-black/45 px-1 py-1 backdrop-blur-sm"
            title={authorName}
          >
            <Avatar className="size-6 shrink-0 border border-white/35">
              <AvatarImage src={authorAvatarUrl} alt={authorName} />
              <AvatarFallback className="bg-white/20 text-[10px] font-semibold text-white">
                {getInitials(authorName)}
              </AvatarFallback>
            </Avatar>
            <p className="max-w-0 overflow-hidden whitespace-nowrap text-xs font-semibold tracking-wide text-white opacity-0 transition-all duration-200 group-hover:max-w-40 group-hover:ml-2 group-hover:pr-2 group-hover:opacity-100">
              {authorName}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}
