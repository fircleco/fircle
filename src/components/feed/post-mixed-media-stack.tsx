import { PlayCircle } from "~/components/ui/icons";

type MixedMediaItem = {
  id: string;
  type: "image" | "video";
  alt: string;
  durationLabel?: string;
};

type PostMixedMediaStackProps = {
  items: MixedMediaItem[];
};

export function PostMixedMediaStack({ items }: PostMixedMediaStackProps) {
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

        return (
          <article
            key={item.id}
            className="absolute overflow-hidden rounded-2xl border border-border/80 bg-muted/40 shadow-sm transition-shadow duration-200 hover:z-50! hover:shadow-md"
            style={{
              top: frameInset,
              bottom: frameInset,
              left: frameInset + horizontalOffset,
              width: cardWidth,
              zIndex: index + 1,
            }}
          >
            <div className="h-full p-3">
              <div className="relative flex h-full items-end justify-between rounded-xl border border-border/70 bg-background p-3">
                {item.type === "video" ? (
                  <PlayCircle
                    className="pointer-events-none absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                ) : null}

                <p
                  className={`text-xs text-muted-foreground ${
                    item.type === "video" ? "max-w-[75%] truncate" : "max-w-full truncate"
                  }`}
                >
                  {item.alt}
                </p>

                {item.type === "video" && item.durationLabel ? (
                  <span className="absolute bottom-2 right-2 rounded-full border border-border bg-background/90 px-2 py-0.5 text-[11px] text-foreground">
                    {item.durationLabel}
                  </span>
                ) : null}

                {isTopCard && overflowCount > 0 ? (
                  <span className="absolute right-2 top-2 rounded-full border border-border bg-background/90 px-2.5 py-1 text-[11px] font-medium text-foreground">
                    +{overflowCount} more
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