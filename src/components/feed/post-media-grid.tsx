import { PlayCircle } from "~/components/ui/icons";

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

export function PostMediaGrid({ items, onItemClick }: PostMediaGridProps) {
  if (items.length === 0) {
    return null;
  }

  const visibleItems = items.slice(0, 4);

  return (
    <div className={`grid gap-2 ${getGridClass(visibleItems.length)}`}>
      {visibleItems.map((item, index) => {
        const shouldSpanTwo = visibleItems.length === 3 && index === 2;
        const isVideo = item.type === "video";

        return (
          <article
            key={item.id}
            onClick={() => onItemClick?.(index)}
            className={`relative overflow-hidden rounded-2xl border border-border/80 bg-muted/40 ${
              shouldSpanTwo ? "col-span-2" : ""
            } ${onItemClick ? "cursor-pointer" : ""}`}
          >
            <div className="relative aspect-video">
              {isVideo ? (
                <video
                  src={item.url}
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                  aria-label={item.alt}
                />
              ) : (
                <img src={item.url} alt={item.alt} className="h-full w-full object-cover" />
              )}

              <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/35 to-transparent p-3 text-white">
                <p
                  className={`text-xs ${isVideo ? "max-w-[75%]" : "max-w-full"} line-clamp-1 font-medium`}
                >
                  {item.alt}
                </p>
                {item.caption ? <p className="mt-0.5 line-clamp-2 text-[11px] text-white/80">{item.caption}</p> : null}
              </div>

              {isVideo ? (
                <PlayCircle
                  className="pointer-events-none absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 text-white sm:size-10 fill-white/85"
                  aria-hidden="true"
                />
              ) : null}

              {isVideo && item.durationLabel ? (
                <span className="absolute bottom-2 right-2 rounded-full border border-white/30 bg-black/65 px-2 py-0.5 text-[11px] text-white">
                  {item.durationLabel}
                </span>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
