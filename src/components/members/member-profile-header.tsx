import type { FamilyMemberProfile } from "~/lib/mocks/family-members";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

import { MemberRoleBadge, MemberStatusBadge } from "./member-badge";

type MemberProfileHeaderProps = {
  member: FamilyMemberProfile;
  showStatus?: boolean;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function MemberProfileHeader({ member, showStatus = true }: MemberProfileHeaderProps) {
  const initials = getInitials(member.name);
  const hasPendingClaimInvite = member.status === "unclaimed" && !!member.pendingClaimInvite;

  return (
    <header className="flex flex-col items-center gap-3 pb-2 pt-6 text-center">
      <Avatar className="size-24 shrink-0 border-2 shadow-sm sm:size-28">
        <AvatarImage src={member.avatarUrl} alt={member.name} />
        <AvatarFallback className="text-2xl font-bold text-foreground">{initials}</AvatarFallback>
      </Avatar>

      <div className="space-y-1.5">
        <h1 className="font-semibold text-2xl tracking-tight sm:text-3xl">{member.name}</h1>
        {showStatus ? (
          <div className="flex flex-wrap justify-center gap-2">
            <MemberRoleBadge role={member.role} />
            <MemberStatusBadge
              status={member.status}
              hasPendingClaimInvite={hasPendingClaimInvite}
            />
          </div>
        ) : null}
      </div>
    </header>
  );
}
