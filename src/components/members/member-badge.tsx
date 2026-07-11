import { Badge } from "~/components/ui/badge";
import { BadgeAlertIcon, Check, Clock3, ShieldAdmin } from "~/components/ui/icons";
import type { FamilyMemberStatus, MemberRole } from "~/lib/mocks/family-members";
import { cn } from "~/lib/utils";

type LabelVisibility = "visible" | "hover";

type MemberStatusBadgeProps = {
  status: FamilyMemberStatus;
  hasPendingClaimInvite?: boolean;
  className?: string;
  labelVisibility?: LabelVisibility;
};

type MemberRoleBadgeProps = {
  role: MemberRole;
  className?: string;
};

const roleLabels: Record<Exclude<MemberRole, "member">, string> = {
  owner: "Owner",
  admin: "Admin",
};

const roleBadgeClasses: Record<Exclude<MemberRole, "member">, string> = {
  owner: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  admin: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

function StatusLabel({
  children,
  labelVisibility = "visible",
}: {
  children: string;
  labelVisibility?: LabelVisibility;
}) {
  if (labelVisibility === "hover") {
    return (
      <span className="sr-only group-hover/badge:not-sr-only group-hover/badge:ml-1">
        {children}
      </span>
    );
  }

  return <span>{children}</span>;
}

export function MemberStatusBadge({
  status,
  hasPendingClaimInvite = false,
  className,
  labelVisibility = "visible",
}: MemberStatusBadgeProps) {
  const isClaimed = status === "claimed";
  const showClaimPending = !isClaimed && hasPendingClaimInvite;

  if (showClaimPending) {
    return <ClaimPendingBadge className={className} labelVisibility={labelVisibility} />;
  }

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
      <StatusLabel labelVisibility={labelVisibility}>
        {isClaimed ? "Claimed" : "Unclaimed"}
      </StatusLabel>
    </Badge>
  );
}

export function ClaimPendingBadge({
  className,
  labelVisibility = "visible",
}: {
  className?: string;
  labelVisibility?: LabelVisibility;
}) {
  return (
    <Badge className={className} variant="secondary">
      <Clock3 data-icon="inline-start" aria-hidden="true" />
      <StatusLabel labelVisibility={labelVisibility}>Claim pending</StatusLabel>
    </Badge>
  );
}

export function MemberRoleBadge({ role, className }: MemberRoleBadgeProps) {
  if (role === "member") {
    return null;
  }

  return (
    <Badge
      className={cn("shrink-0", roleBadgeClasses[role], className)}
      variant="outline"
    >
      <ShieldAdmin data-icon="inline-start" aria-hidden="true" />
      {roleLabels[role]}
    </Badge>
  );
}
