"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck, UserRole, UserCheck } from "~/components/ui/icons";
import { Button } from "~/components/ui/button";
import type { FamilyMemberProfile, MemberRole } from "~/lib/mocks/family-members";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

import { EditProfileDialog } from "./edit-profile-dialog";
import { GenerateClaimLinkDialog } from "./generate-claim-link-dialog";

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

export function MemberAdminActionsPanel({ member }: MemberAdminPanelProps) {
  const isClaimed = member.status === "claimed";
  const pendingClaimInvite = member.pendingClaimInvite ?? null;
  const [isClaimLinkCopied, setIsClaimLinkCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const trpcUtils = api.useUtils();
  const revokeInvite = api.invite.revokeInvite.useMutation({
    onSuccess: async () => {
      await Promise.all([
        trpcUtils.familyMember.getMemberProfileBySlug.invalidate(),
        trpcUtils.familyMember.listFamilyMembers.invalidate(),
      ]);
    },
  });

  const pendingClaimPath = pendingClaimInvite
    ? `/auth/claim/${pendingClaimInvite.code}`
    : null;
  const pendingClaimUrl = pendingClaimPath && origin
    ? `${origin}${pendingClaimPath}`
    : pendingClaimPath;

  const handleCopyClaimLink = async () => {
    if (!pendingClaimUrl) return;
    await navigator.clipboard.writeText(pendingClaimUrl);
    setIsClaimLinkCopied(true);
    setTimeout(() => setIsClaimLinkCopied(false), 2000);
  };

  const handleRevokeInvite = async () => {
    if (!pendingClaimInvite) return;
    await revokeInvite.mutateAsync({ inviteId: pendingClaimInvite.id });
  };

  return (
    <details className="group rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
      <summary className="flex cursor-pointer list-none items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="font-medium text-sm uppercase tracking-wider text-muted-foreground">
            Admin actions
          </h2>
        </div>
        <ArrowRight
          className="size-4 text-muted-foreground transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
      </summary>

      <div className="mt-4 space-y-4">
        <div className="rounded-2xl border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">Profile management</p>
          <p className="mt-1 text-sm font-medium">Edit member basics</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Update this member&apos;s name, profile picture, date of birth, and related profile details.
          </p>
          <EditProfileDialog member={member} triggerText="Edit member profile" triggerClassName="mt-3 w-full" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border bg-muted/20 p-3">
            <div className="flex items-start gap-3">
              <UserCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-xs text-muted-foreground">Account status</p>
                <p className="mt-0.5 text-sm font-medium">
                  {isClaimed ? "Claimed" : "Unclaimed"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isClaimed
                    ? "This member is signed in and owns this profile."
                    : "This profile can be claimed by the real member."}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-muted/20 p-3">
            <div className="flex items-start gap-3">
              <UserRole className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-xs text-muted-foreground">Current role</p>
                <span
                  className={cn(
                    "mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                    roleBadgeClasses[member.role],
                  )}
                >
                  {roleLabels[member.role]}
                </span>
                <p className="mt-1 text-xs text-muted-foreground">
                  Update access level or assign elevated permissions.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">Claim management</p>
          <p className="mt-1 text-sm font-medium">
            {isClaimed ? "Claim handled" : "Invite this user to claim"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
                {isClaimed
                  ? "No claim invite is needed for this profile."
                  : "Send a claim invite so this person can take ownership."}
          </p>
          {isClaimed ? (
            <Button className="mt-3 w-full" size="sm" type="button" variant="outline" disabled>
              Claim already complete
            </Button>
          ) : pendingClaimInvite && pendingClaimUrl ? (
            <div className="mt-3 space-y-2">
              <div className="rounded-xl border bg-background/80 px-2 py-2">
                <p className="truncate font-mono text-xs">{pendingClaimUrl}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {pendingClaimInvite.invitedEmail ? (
                  <p className="text-xs text-muted-foreground">
                    Email-bound to {pendingClaimInvite.invitedEmail} ▪ 
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Expires {new Date(pendingClaimInvite.expiresAt).toLocaleString()}
                </p>
              </div>
              {revokeInvite.error ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs text-destructive">
                  {revokeInvite.error.message}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={handleCopyClaimLink}>
                  {isClaimLinkCopied ? "Copied!" : "Copy link"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={handleRevokeInvite}
                  disabled={revokeInvite.isPending}
                >
                  {revokeInvite.isPending ? "Revoking..." : "Revoke invite"}
                </Button>
              </div>
            </div>
          ) : (
            <GenerateClaimLinkDialog memberId={member.id} memberName={member.name} />
          )}
        </div>
        
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Password reset</p>
            <p className="mt-1 text-sm font-medium">Reset sign-in credentials</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Trigger a reset email or recovery flow for the claimed member.
            </p>
            <Button className="mt-3 w-full" size="sm" type="button" variant="secondary">
              Reset password
            </Button>
          </div>
          <div className="rounded-2xl border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Role management</p>
            <p className="mt-1 text-sm font-medium">Promote or demote this member</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pick the role that best matches how much control this member should have.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" type="button" variant={member.role === "member" ? "default" : "outline"}>
                Member
              </Button>
              <Button size="sm" type="button" variant={member.role === "admin" ? "default" : "outline"}>
                Admin
              </Button>
              <Button size="sm" type="button" variant={member.role === "owner" ? "default" : "outline"}>
                Owner
              </Button>
            </div>
          </div>
        </div>

      </div>
    </details>
  );
}
