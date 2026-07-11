import Link from "next/link";
import type { FamilyMemberSummary } from "~/lib/mocks/family-members";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

import { MemberRoleBadge, MemberStatusBadge } from "./member-badge";

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
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate font-medium text-sm sm:text-base">{member.name}</p>
            <div className="flex min-w-0 shrink-0 items-center gap-2">
              <MemberRoleBadge role={member.role} />
              <MemberStatusBadge
                status={member.status}
                hasPendingClaimInvite={hasPendingInvite}
                labelVisibility="hover"
                className="shrink-0"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{member.addedAtLabel}</p>
        </div>
      </article>
    </Link>
  );
}
