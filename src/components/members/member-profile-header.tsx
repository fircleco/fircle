import type { FamilyMemberProfile } from "~/lib/mocks/family-members";
import { cn } from "~/lib/utils";

import { MemberStatusBadge } from "./member-status-badge";

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

  return (
    <header className="flex flex-col items-center gap-3 pb-2 pt-6 text-center">
      <div
        aria-hidden="true"
        className={cn(
          "grid size-24 shrink-0 place-items-center rounded-full border-2 text-2xl font-bold text-foreground shadow-sm sm:size-28",
          member.avatarUrl ? "bg-cover bg-center text-transparent" : "bg-muted",
        )}
        style={
          member.avatarUrl
            ? { backgroundImage: `url(${member.avatarUrl})` }
            : undefined
        }
      >
        {initials}
      </div>

      <div className="space-y-1.5">
        <h1 className="font-semibold text-2xl tracking-tight sm:text-3xl">{member.name}</h1>
        <p className="text-sm text-muted-foreground">{member.relationship}</p>
        {showStatus ? (
          <div className="flex justify-center">
            <MemberStatusBadge status={member.status} />
          </div>
        ) : null}
      </div>
    </header>
  );
}
