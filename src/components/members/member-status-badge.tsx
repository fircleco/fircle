import { Badge } from "~/components/ui/badge";
import { BadgeAlertIcon, Check, Clock3 } from "~/components/ui/icons";
import type { FamilyMemberStatus } from "~/lib/mocks/family-members";

type MemberStatusBadgeProps = {
  status: FamilyMemberStatus;
  className?: string;
};

export function MemberStatusBadge({ status, className }: MemberStatusBadgeProps) {
  const isClaimed = status === "claimed";

  return (
    <Badge
      className={className}
      variant={isClaimed ? "default" : "outline"}
    >
      {isClaimed ? (
        <Check data-icon="inline-start" aria-hidden="true" />
      ) : (
        <BadgeAlertIcon data-icon="inline-start" aria-hidden="true" />
      )}
      {isClaimed ? "Claimed" : "Unclaimed"}
    </Badge>
  );
}

export function ClaimPendingBadge() {
  return (
    <Badge variant="secondary">
      <Clock3 data-icon="inline-start" aria-hidden="true" />
      Claim pending
    </Badge>
  );
}
