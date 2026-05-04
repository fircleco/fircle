import { Button } from "~/components/ui/button";
import type { FamilyMemberProfile } from "~/lib/mocks/family-members";
import { cn } from "~/lib/utils";

import { MemberStatusBadge } from "./member-status-badge";

type MemberProfileHeaderProps = {
  member: FamilyMemberProfile;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function MemberProfileHeader({ member }: MemberProfileHeaderProps) {
  const isClaimed = member.status === "claimed";
  const initials = getInitials(member.name);

  return (
    <header className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div
            aria-hidden="true"
            className={cn(
              "grid size-16 shrink-0 place-items-center rounded-full border text-base font-semibold text-foreground sm:size-20",
              member.avatarUrl ? "bg-cover bg-center text-transparent" : "bg-muted",
            )}
            style={
              member.avatarUrl
                ? {
                    backgroundImage: `url(${member.avatarUrl})`,
                  }
                : undefined
            }
          >
            {initials}
          </div>

          <div className="space-y-2">
            <h1 className="font-semibold text-2xl tracking-tight sm:text-3xl">{member.name}</h1>
            <p className="text-sm text-muted-foreground sm:text-base">{member.relationship}</p>
            <MemberStatusBadge status={member.status} className="w-fit" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button size="sm" variant="outline" type="button">
            Edit profile
          </Button>

          {isClaimed ? (
            <Button size="sm" variant="secondary" type="button">
              View account
            </Button>
          ) : (
            <Button size="sm" type="button">
              Send claim invite
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
