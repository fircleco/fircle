import Link from "next/link";
import { FileText, Image as ImageIcon, PlayCircle, Tag } from "lucide-react";

import { MemberStatusBadge } from "~/components/members/member-status-badge";
import { Button } from "~/components/ui/button";
import type { TaggedMemoryItem } from "~/lib/mocks/tagging";

type TaggedMemoryCardProps = {
  memory: TaggedMemoryItem;
  ctaHref?: string;
};

function getMediaLabel(type: TaggedMemoryItem["type"]) {
  if (type === "photo") {
    return "Photo";
  }

  if (type === "video") {
    return "Video";
  }

  return "Post";
}

function getMediaIcon(type: TaggedMemoryItem["type"]) {
  if (type === "photo") {
    return ImageIcon;
  }

  if (type === "video") {
    return PlayCircle;
  }

  return FileText;
}

export function TaggedMemoryCard({ memory, ctaHref = "#" }: TaggedMemoryCardProps) {
  const MediaIcon = getMediaIcon(memory.type);

  return (
    <article className="flex h-full flex-col rounded-3xl border bg-card p-4 shadow-sm transition hover:border-primary/30">
      {memory.thumbnailUrl ? (
        <div
          className="aspect-video rounded-2xl border bg-cover bg-center"
          style={{ backgroundImage: `url(${memory.thumbnailUrl})` }}
          aria-label={`${memory.title} preview`}
        />
      ) : (
        <div className="grid aspect-video place-items-center rounded-2xl border border-dashed bg-muted/20 text-muted-foreground">
          <span className="inline-flex items-center gap-2 text-sm">
            <MediaIcon className="size-4" aria-hidden="true" />
            {getMediaLabel(memory.type)} preview
          </span>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/20 px-2.5 py-1 text-xs text-muted-foreground">
          <MediaIcon className="size-3.5" aria-hidden="true" />
          {getMediaLabel(memory.type)}
        </span>
        <span className="text-xs text-muted-foreground">{memory.createdAtLabel}</span>
      </div>

      <h3 className="mt-3 font-medium text-base leading-tight">{memory.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{memory.caption}</p>

      <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">By {memory.authorName}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {memory.taggedPeople.map((person) => (
          <span
            key={`${memory.id}-${person.memberId}`}
            className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-1"
          >
            <Tag className="size-3 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs font-medium">{person.name}</span>
            <MemberStatusBadge status={person.status} className="px-1.5 py-0 text-[10px]" />
          </span>
        ))}
      </div>

      <div className="mt-4 pt-1">
        <Button asChild size="sm" variant="outline" className="w-full">
          <Link href={ctaHref}>View original post</Link>
        </Button>
      </div>
    </article>
  );
}