import { TaggedMemberAvatarStack } from "./tagged-member-avatar-stack";

type PostMediaGridItem = {
  id: string;
  url: string;
  alt: string;
};

type PostMediaGridProps = {
  items: PostMediaGridItem[];
  taggedMembers?: { name: string; avatarUrl: string }[];
};

function getGridClass(count: number) {
  if (count <= 1) {
    return "grid-cols-1";
  }

  return "grid-cols-2";
}

export function PostMediaGrid({ items, taggedMembers = [] }: PostMediaGridProps) {
  if (items.length === 0) {
    return null;
  }

  const visibleItems = items.slice(0, 4);

  return (
    <div className={`grid gap-2 ${getGridClass(visibleItems.length)}`}>
      {visibleItems.map((item, index) => {
        const shouldSpanTwo = visibleItems.length === 3 && index === 0;

        return (
          <article
            key={item.id}
            className={`relative overflow-hidden rounded-2xl border border-border/80 bg-muted/40 ${
              shouldSpanTwo ? "sm:col-span-2" : ""
            }`}
          >
            <div className="aspect-video p-3">
              {visibleItems.length === 1 && taggedMembers.length > 0 ? (
                <TaggedMemberAvatarStack members={taggedMembers} />
              ) : null}
              <div className="flex h-full items-end justify-between rounded-xl border border-border/70 bg-background p-3">
                <p className="line-clamp-2 text-xs text-muted-foreground">{item.alt}</p>
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  Photo
                </span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
