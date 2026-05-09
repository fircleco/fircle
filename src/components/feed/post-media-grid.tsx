import { PlayCircle } from "~/components/ui/icons";

type PostMediaGridItem = {
  id: string;
  type?: "image" | "video";
  url: string;
  alt: string;
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
              shouldSpanTwo ? "sm:col-span-2" : ""
            } ${onItemClick ? "cursor-pointer" : ""}`}
          >
            <div className="aspect-video p-1.5 sm:p-3">
              <div className="relative flex h-full items-end justify-between rounded-xl border border-border/70 bg-background p-3">
                {isVideo ? (
                  <PlayCircle
                    className="pointer-events-none absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 text-muted-foreground sm:size-10 fill-accent-foreground"
                    aria-hidden="true"
                  />
                ) : null}

                <p
                  className={`text-xs text-muted-foreground ${
                    isVideo ? "max-w-[75%] truncate" : "max-w-full truncate"
                  }`}
                >
                  {item.alt}
                </p>

                {isVideo && item.durationLabel ? (
                  <span className="absolute bottom-2 right-2 rounded-full border border-border bg-background/90 px-2 py-0.5 text-[11px] text-foreground">
                    {item.durationLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
