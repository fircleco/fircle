import { Clock3, Tag } from "lucide-react";

import { MemberStatusBadge } from "~/components/members/member-status-badge";
import type { VideoTagMoment } from "~/lib/mocks/tagging";

type VideoTagMomentCardProps = {
  moment: VideoTagMoment;
};

export function VideoTagMomentCard({ moment }: VideoTagMomentCardProps) {
  return (
    <article className="rounded-3xl border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs font-medium">
          <Clock3 className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {moment.atLabel}
        </span>
        <span className="text-xs text-muted-foreground">{moment.people.length} tagged</span>
      </div>

      {moment.note ? <p className="mt-2 text-sm text-muted-foreground">{moment.note}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {moment.people.map((person) => (
          <span
            key={`${moment.id}-${person.memberId}`}
            className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1"
          >
            <Tag className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs font-medium">{person.name}</span>
            <MemberStatusBadge status={person.status} className="px-2 py-0.5 text-[10px]" />
          </span>
        ))}
      </div>
    </article>
  );
}