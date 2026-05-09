import { CalendarDays, Clock3, ShieldCheck, UserRole, UserCheck } from "~/components/ui/icons";
import type { FamilyMemberProfile, MemberRole } from "~/lib/mocks/family-members";
import { cn } from "~/lib/utils";

type MemberAdminPanelProps = {
  member: FamilyMemberProfile;
};

const roleLabels: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

const roleBadgeClasses: Record<MemberRole, string> = {
  owner: "bg-violet-500/10 text-violet-600 border-violet-500/30 dark:text-violet-400",
  admin: "bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400",
  member: "bg-muted text-muted-foreground border-border",
};

export function MemberAdminPanel({ member }: MemberAdminPanelProps) {
  const isClaimed = member.status === "claimed";

  return (
    <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="font-medium text-sm uppercase tracking-wider text-muted-foreground">
          Admin info
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-2xl border bg-muted/20 p-3">
          <UserRole className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-xs text-muted-foreground">Role</p>
            <span
              className={cn(
                "mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                roleBadgeClasses[member.role],
              )}
            >
              {roleLabels[member.role]}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border bg-muted/20 p-3">
          <UserCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-xs text-muted-foreground">Account status</p>
            <p className="mt-0.5 text-sm font-medium">
              {isClaimed ? "Claimed" : "Unclaimed"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isClaimed
                ? "Member has signed in and owns this profile."
                : "Profile not yet claimed by the real member."}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border bg-muted/20 p-3">
          <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-xs text-muted-foreground">Added by</p>
            <p className="mt-0.5 text-sm font-medium">{member.addedByName}</p>
            <p className="text-xs text-muted-foreground">{member.addedAtLabel}</p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border bg-muted/20 p-3">
          <Clock3 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-xs text-muted-foreground">Location</p>
            <p className="mt-0.5 text-sm font-medium">{member.location ?? "Not specified"}</p>
          </div>
        </div>
      </div>

      {member.note ? (
        <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Note</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{member.note}</p>
        </div>
      ) : null}
    </section>
  );
}
