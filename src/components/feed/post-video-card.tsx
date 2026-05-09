import { PlayCircle } from "~/components/ui/icons";

import { TaggedMemberAvatarStack } from "./tagged-member-avatar-stack";

type PostVideoCardProps = {
  title: string;
  durationLabel?: string;
  taggedMembers?: { name: string; avatarUrl: string }[];
};

export function PostVideoCard({
  title,
  durationLabel,
  taggedMembers = [],
}: PostVideoCardProps) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-border/80 bg-muted/50">
      {taggedMembers.length > 0 ? <TaggedMemberAvatarStack members={taggedMembers} /> : null}
      <div className="aspect-video p-3">
        <div className="relative flex h-full items-center justify-center rounded-xl border border-border/70 bg-background">
          <PlayCircle className="size-12 text-muted-foreground" aria-hidden="true" />

          {durationLabel ? (
            <span className="absolute bottom-2 right-2 rounded-full border border-border bg-background/90 px-2 py-0.5 text-[11px] text-foreground">
              {durationLabel}
            </span>
          ) : null}
        </div>
      </div>
      <p className="px-3 pb-3 text-xs text-muted-foreground">{title}</p>
    </article>
  );
}
