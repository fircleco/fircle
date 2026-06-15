import Image from "next/image";

import { PlayCircle } from "~/components/ui/icons";
import { getVideoThumbnailSrc } from "~/lib/video-thumbnail";

type MixedMediaItem = {
  id: string;
  type: "image" | "video";
  url: string;
  alt: string;
  caption?: string;
  durationLabel?: string;
};

type PostMixedMediaStackProps = {
  items: MixedMediaItem[];
  onItemClick?: (index: number) => void;
};

export function PostMixedMediaStack({ items, onItemClick }: PostMixedMediaStackProps) {
  if (items.length <= 4) {
    return null;
  }

  const visibleItems = items.slice(0, 4);
  const overflowCount = items.length - visibleItems.length;
  const stackOffset = 24;
  const frameInset = 3;
  const maxOffset = (visibleItems.length - 1) * stackOffset;
  const cardWidth = `calc(100% - ${maxOffset + frameInset * 2}px)`;

  return (
    <div className="relative h-72 overflow-hidden rounded-2xl">
      {visibleItems.map((item, index) => {
        const horizontalOffset = index * stackOffset;
        const isTopCard = index === visibleItems.length - 1;
        const videoThumbnailSrc = item.type === "video" ? getVideoThumbnailSrc(item.url) : item.url;
        const overlayTitle = item.alt && item.alt !== item.caption ? item.alt : "";
        const mediaAriaLabel = item.alt ?? item.caption ?? "Post media";
        const hasOverlayText = Boolean(overlayTitle ?? item.caption);

        return (
          <article
            key={item.id}
            onClick={() => onItemClick?.(index)}
            className={`absolute overflow-hidden rounded-2xl border border-border/80 bg-muted/40 shadow-sm transition-shadow duration-200 hover:z-50! hover:shadow-md ${onItemClick ? "cursor-pointer" : ""}`}
            style={{
              top: frameInset,
              bottom: frameInset,
              left: frameInset + horizontalOffset,
              width: cardWidth,
              zIndex: index + 1,
            }}
          >
            <div className="relative h-full">
              {item.type === "video" ? (
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

              {hasOverlayText ? (
                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/35 to-transparent p-3 text-white">
                  {overlayTitle ? (
                    <p
                      className={`text-xs ${item.type === "video" ? "max-w-[75%]" : "max-w-full"} line-clamp-1 font-medium`}
                    >
                      {overlayTitle}
                    </p>
                  ) : null}
                  {item.caption ? <p className="mt-0.5 line-clamp-2 text-[11px] text-white/80">{item.caption}</p> : null}
                </div>
              ) : null}

              {item.type === "video" ? (
                <PlayCircle
                  className="pointer-events-none absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 text-white sm:size-10 fill-white/85"
                  aria-hidden="true"
                />
              ) : null}

              {item.type === "video" && item.durationLabel ? (
                <span className="absolute bottom-2 right-2 rounded-full border border-white/30 bg-black/65 px-2 py-0.5 text-[11px] text-white">
                  {item.durationLabel}
                </span>
              ) : null}

              {isTopCard && overflowCount > 0 ? (
                <span className="absolute right-2 top-2 rounded-full border border-white/30 bg-black/65 px-2.5 py-1 text-[11px] font-medium text-white">
                  +{overflowCount} more
                </span>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}