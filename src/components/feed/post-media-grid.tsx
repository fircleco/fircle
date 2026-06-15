import Image from "next/image";

import { PlayCircle } from "~/components/ui/icons";
import { getVideoThumbnailSrc } from "~/lib/video-thumbnail";

type PostMediaGridItem = {
  id: string;
  type?: "image" | "video";
  url: string;
  alt: string;
  caption?: string;
  durationLabel?: string;
};

type PostMediaGridProps = {
  items: PostMediaGridItem[];
  onItemClick?: (index: number) => void;
};

function getGridClass(count: number) {
  if (count <= 1) {
    return "grid-cols-1";
  }

  return "grid-cols-2";
}

function getTileRadiusClass(count: number, index: number) {
  if (count <= 1) {
    return "rounded-2xl";
  }

  if (count === 2) {
    return index === 0 ? "rounded-l-2xl" : "rounded-r-2xl";
  }

  if (count === 3) {
    if (index === 0) return "rounded-tl-2xl";
    if (index === 1) return "rounded-tr-2xl";
    return "rounded-b-2xl";
  }

  if (index === 0) return "rounded-tl-2xl";
  if (index === 1) return "rounded-tr-2xl";
  if (index === 2) return "rounded-bl-2xl";
  return "rounded-br-2xl";
}

function getTileAspectClass(count: number) {
  if (count === 2) {
    return "aspect-[4/3]";
  }

  return "aspect-video";
}

export function PostMediaGrid({ items, onItemClick }: PostMediaGridProps) {
  if (items.length === 0) {
    return null;
  }

  const visibleItems = items.slice(0, 4);
  const overflowCount = Math.max(items.length - visibleItems.length, 0);
  const tileAspectClass = getTileAspectClass(visibleItems.length);

  return (
    <div className={`grid gap-0.5 ${getGridClass(visibleItems.length)}`}>
      {visibleItems.map((item, index) => {
        const shouldSpanTwo = visibleItems.length === 3 && index === 2;
        const tileRadiusClass = getTileRadiusClass(visibleItems.length, index);
        const isVideo = item.type === "video";
        const isOverflowTile = overflowCount > 0 && index === visibleItems.length - 1;
        const videoThumbnailSrc = isVideo ? getVideoThumbnailSrc(item.url) : item.url;
        const overlayTitle = item.alt && item.alt !== item.caption ? item.alt : "";
        const mediaAriaLabel = item.alt ?? item.caption ?? "Post media";
        const hasOverlayText = Boolean(overlayTitle ?? item.caption);

        return (
          <article
            key={item.id}
            onClick={() => onItemClick?.(index)}
            className={`relative overflow-hidden rounded border border-border/80 bg-muted/40 ${tileRadiusClass} ${
              shouldSpanTwo ? "col-span-2" : ""
            } ${onItemClick ? "cursor-pointer" : ""}`}
          >
            <div className={`relative ${tileAspectClass}`}>
              {isVideo ? (
                <video
                  src={videoThumbnailSrc}
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                  aria-label={mediaAriaLabel}
                />
              ) : (
                <Image
                  src={item.url}
                  alt={mediaAriaLabel}
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="h-full w-full object-cover"
                />
              )}

              {hasOverlayText && !isOverflowTile ? (
                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/35 to-transparent p-3 text-white">
                  {overlayTitle ? (
                    <p
                      className={`text-xs ${isVideo ? "max-w-[75%]" : "max-w-full"} line-clamp-1 font-medium`}
                    >
                      {overlayTitle}
                    </p>
                  ) : null}
                  {item.caption ? <p className="mt-0.5 line-clamp-2 text-[11px] text-white/80">{item.caption}</p> : null}
                </div>
              ) : null}

              {isVideo && !isOverflowTile ? (
                <PlayCircle
                  className="pointer-events-none absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 text-white sm:size-10 fill-white/85"
                  aria-hidden="true"
                />
              ) : null}

              {isVideo && item.durationLabel && !isOverflowTile ? (
                <span className="absolute bottom-2 right-2 rounded-full border border-white/30 bg-black/65 px-2 py-0.5 text-[11px] text-white">
                  {item.durationLabel}
                </span>
              ) : null}

              {isOverflowTile ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-white">
                  <span className="rounded-full border border-white/35 bg-black/55 px-3 py-1 text-sm font-semibold">
                    +{overflowCount}
                  </span>
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
