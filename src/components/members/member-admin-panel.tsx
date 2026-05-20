"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck, UserRole, UserCheck } from "~/components/ui/icons";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import type { FamilyMemberProfile, MemberRole } from "~/lib/mocks/family-members";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

import { EditProfileDialog } from "./edit-profile-dialog";
import { GenerateClaimLinkDialog } from "./generate-claim-link-dialog";

type MemberAdminPanelProps = {
  member: FamilyMemberProfile;
  callerRole: MemberRole;
  familyId?: string;
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

export function MemberAdminActionsPanel({ member, callerRole, familyId }: MemberAdminPanelProps) {
  const isClaimed = member.status === "claimed";
  const isCallerOwner = callerRole === "owner";
  const pendingClaimInvite = member.pendingClaimInvite ?? null;
  const [isClaimLinkCopied, setIsClaimLinkCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [confirmTemporaryPassword, setConfirmTemporaryPassword] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState<string | null>(null);

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
  const updateRole = api.familyMember.updateMemberRole.useMutation({
    onSuccess: async () => {
      await Promise.all([
        trpcUtils.familyMember.getMemberProfileBySlug.invalidate(),
        trpcUtils.familyMember.listFamilyMembers.invalidate(),
      ]);
    },
  });
  const adminResetPassword = api.familyMember.adminResetMemberPassword.useMutation({
    onSuccess: async () => {
      setResetPasswordError(null);
      setResetPasswordSuccess("Temporary password was set successfully.");
      setTemporaryPassword("");
      setConfirmTemporaryPassword("");
      setShowResetConfirm(false);
      await Promise.all([
        trpcUtils.familyMember.getMemberProfileBySlug.invalidate(),
        trpcUtils.familyMember.listFamilyMembers.invalidate(),
      ]);
    },
    onError: (error) => {
      setResetPasswordSuccess(null);
      setResetPasswordError(error.message);
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

  const canManageRoleSection = isCallerOwner && member.role !== "owner";
  const canChangeRole = canManageRoleSection && !updateRole.isPending;

  const handleUpdateRole = (role: "MEMBER" | "ADMIN") => {
    if (!canChangeRole) return;
    updateRole.mutate({ memberId: member.id, role });
  };

  const canSubmitResetPassword =
    Boolean(familyId) &&
    isClaimed &&
    temporaryPassword.length >= 8 &&
    confirmTemporaryPassword.length >= 8 &&
    !adminResetPassword.isPending;

  const handleStartResetConfirmation = () => {
    setResetPasswordError(null);
    setResetPasswordSuccess(null);

    if (!familyId) {
      setResetPasswordError("No active family context found for this profile.");
      return;
    }

    if (!isClaimed) {
      setResetPasswordError("Only claimed members can have their password reset.");
      return;
    }

    if (temporaryPassword.length < 8) {
      setResetPasswordError("Temporary password must be at least 8 characters.");
      return;
    }

    if (temporaryPassword !== confirmTemporaryPassword) {
      setResetPasswordError("Temporary password and confirmation must match.");
      return;
    }

    setShowResetConfirm(true);
  };

  const handleConfirmResetPassword = async () => {
    if (!canSubmitResetPassword || !familyId) {
      return;
    }

    await adminResetPassword.mutateAsync({
      familyId,
      memberId: member.id,
      temporaryPassword,
    });
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
            Update this member&apos;s name and profile picture.
          </p>
          <EditProfileDialog
            member={member}
            familyId={familyId}
            triggerText="Edit member profile"
            triggerClassName="mt-3 w-full"
          />
        </div>

        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          data-caller-owner={isCallerOwner ? "true" : "false"}
        >
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
        
        <div
          className={cn(
            "grid grid-cols-1 gap-3",
            canManageRoleSection ? "sm:grid-cols-2" : undefined,
          )}
        >
          <div className="rounded-2xl border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Password reset</p>
            <p className="mt-1 text-sm font-medium">Set temporary password</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Admins and owners can set a temporary password for claimed members.
            </p>

            <div className="mt-3 space-y-2">
              <label className="space-y-1 text-xs text-muted-foreground" htmlFor={`temp-password-${member.id}`}>
                Temporary password
                <Input
                  id={`temp-password-${member.id}`}
                  type="password"
                  autoComplete="new-password"
                  value={temporaryPassword}
                  onChange={(event) => {
                    setTemporaryPassword(event.target.value);
                    setShowResetConfirm(false);
                  }}
                  disabled={!isClaimed || adminResetPassword.isPending}
                  placeholder="At least 8 characters"
                />
              </label>

              <label className="space-y-1 mb-1 text-xs text-muted-foreground" htmlFor={`temp-password-confirm-${member.id}`}>
                Confirm temporary password
                <Input
                  id={`temp-password-confirm-${member.id}`}
                  type="password"
                  autoComplete="new-password"
                  value={confirmTemporaryPassword}
                  onChange={(event) => {
                    setConfirmTemporaryPassword(event.target.value);
                    setShowResetConfirm(false);
                  }}
                  disabled={!isClaimed || adminResetPassword.isPending}
                  placeholder="Re-enter temporary password"
                />
              </label>

              {showResetConfirm ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  Confirm resetting this member&apos;s password now. They will need to sign in with the temporary password.
                </div>
              ) : null}

              {resetPasswordError ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs text-destructive">
                  {resetPasswordError}
                </p>
              ) : null}

              {resetPasswordSuccess ? (
                <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                  {resetPasswordSuccess}
                </p>
              ) : null}

              {!isClaimed ? (
                <p className="text-xs text-muted-foreground">
                  Password reset is unavailable for unclaimed members.
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  className="w-full sm:w-auto"
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={handleStartResetConfirmation}
                  disabled={!isClaimed || adminResetPassword.isPending}
                >
                  Review reset
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={handleConfirmResetPassword}
                  disabled={!showResetConfirm || !canSubmitResetPassword}
                >
                  {adminResetPassword.isPending ? "Resetting..." : "Confirm reset"}
                </Button>
              </div>
            </div>
          </div>
          {canManageRoleSection ? (
            <div className="rounded-2xl border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Role management</p>
              <p className="mt-1 text-sm font-medium">Promote or demote this member</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pick the role that best matches how much control this member should have.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  type="button"
                  variant={member.role === "member" ? "default" : "outline"}
                  onClick={() => handleUpdateRole("MEMBER")}
                  disabled={!canChangeRole}
                >
                  Member
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant={member.role === "admin" ? "default" : "outline"}
                  onClick={() => handleUpdateRole("ADMIN")}
                  disabled={!canChangeRole}
                >
                  Admin
                </Button>
              </div>
              {updateRole.error ? (
                <p className="mt-2 rounded-lg border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs text-destructive">
                  {updateRole.error.message}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

      </div>
    </details>
  );
}
