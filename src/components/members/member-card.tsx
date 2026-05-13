import Link from "next/link";
import { Clock3 } from "~/components/ui/icons";

import type { FamilyMemberSummary } from "~/lib/mocks/family-members";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

import { MemberStatusBadge } from "./member-status-badge";

type MemberCardProps = {
  member: FamilyMemberSummary;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function MemberCard({ member }: MemberCardProps) {
  const hasPendingInvite = member.status === "unclaimed" && member.hasPendingClaimInvite === true;
  const initials = getInitials(member.name);

  return (
    <Link
      href={`/member/${member.slug}`}
      className="block rounded-3xl border bg-card p-4 shadow-sm transition hover:border-primary/30"
    >
      <article className="flex items-start gap-3">
        <Avatar className="size-12 shrink-0 border">
          <AvatarImage src={member.avatarUrl} alt={member.name} />
          <AvatarFallback className="text-sm font-semibold text-foreground">{initials}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="truncate font-medium text-sm sm:text-base">{member.name}</p>
            <MemberStatusBadge status={member.status} />
          </div>

          <p className="text-xs text-muted-foreground">
            Added by {member.addedByName} · {member.addedAtLabel}
          </p>

          {hasPendingInvite ? (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
              <Clock3 className="size-3.5" aria-hidden="true" />
              Invite/claim pending
            </p>
          ) : null}
        </div>
      </article>
    </Link>
  );
}
