import { cn } from "~/lib/utils";
import type { FamilyMemberStatus } from "~/lib/mocks/family-members";
import { Check } from "~/components/ui/icons";

type MemberStatusBadgeProps = {
  status: FamilyMemberStatus;
  className?: string;
};

export function MemberStatusBadge({ status, className }: MemberStatusBadgeProps) {
  const isClaimed = status === "claimed";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        isClaimed
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        className,
      )}
    >
      {isClaimed ? <Check className="mr-1 size-3.5" aria-hidden="true" /> : null}
      {isClaimed ? "Claimed" : "Unclaimed"}
    </span>
  );
}
