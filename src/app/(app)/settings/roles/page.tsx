"use client";

import { useMemo } from "react";
import { MemberStatusBadge } from "~/components/members/member-status-badge";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { AlertCircle } from "~/components/ui/icons";
import type { FamilyMemberSummary, MemberRole } from "~/lib/mocks/family-members";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

const roleSortOrder: Record<MemberRole, number> = {
  owner: 0,
  admin: 1,
  member: 2,
};

const roleBadgeStyles: Record<MemberRole, string> = {
  owner: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  admin: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  member: "border-muted-foreground/20 bg-muted text-muted-foreground",
};

const roleLabel: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

const permissionRows = [
  { action: "Post photos and videos", owner: true, admin: true, member: true },
  { action: "Tag family members", owner: true, admin: true, member: true },
  { action: "Add unclaimed members", owner: true, admin: true, member: false },
  { action: "Create invites", owner: true, admin: true, member: false },
  { action: "Revoke invites", owner: true, admin: true, member: false },
  { action: "Edit family settings", owner: true, admin: true, member: false },
  { action: "Change member roles", owner: true, admin: false, member: false },
  { action: "Delete family data", owner: true, admin: false, member: false },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function sortMembersByRole(members: FamilyMemberSummary[]) {
  return [...members].sort((a, b) => {
    const roleOrderDiff = roleSortOrder[a.role] - roleSortOrder[b.role];
    if (roleOrderDiff !== 0) {
      return roleOrderDiff;
    }
    return a.name.localeCompare(b.name);
  });
}

function PermissionCell({ value }: { value: boolean }) {
  return <span className="text-sm">{value ? "✓" : "—"}</span>;
}

export default function RolesPage() {
  const managementContext = api.invite.getManagementContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const familyId = managementContext.data?.family?.id;

  const listMembersQuery = api.familyMember.listFamilyMembers.useQuery(
    {
      familyId: familyId ?? "",
    },
    {
      enabled: Boolean(familyId),
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const members = useMemo<FamilyMemberSummary[]>(() => {
    if (!listMembersQuery.data) {
      return [];
    }

    return listMembersQuery.data.map((member) => ({
      id: member.id,
      name: member.name,
      nickname: member.nickname ?? undefined,
      slug: member.slug,
      status: member.status,
      hasPendingClaimInvite: member.hasPendingClaimInvite,
      role: member.role.toLowerCase() as MemberRole,
      avatarUrl: member.image ?? undefined,
      addedByName: "",
      addedAtLabel: "",
    }));
  }, [listMembersQuery.data]);

  const sortedMembers = sortMembersByRole(members);
  const isLoading = managementContext.isLoading || listMembersQuery.isLoading;
  const hasNoFamily = !managementContext.isLoading && !familyId;
  const hasError = listMembersQuery.error != null;

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h2 className="font-semibold text-xl tracking-tight">Roles & Permissions</h2>
        <p className="text-muted-foreground text-sm">
          View role assignments and the permissions each role can access.
        </p>
      </header>

      <section className="space-y-3 rounded-2xl border bg-card/60 p-5">
        <h3 className="font-medium text-base">Member roles</h3>

        {isLoading ? (
          <Alert>
            <AlertCircle className="size-5" aria-hidden="true" />
            <AlertTitle>Loading family roles</AlertTitle>
            <AlertDescription>
              We&apos;re fetching role assignments for your active family.
            </AlertDescription>
          </Alert>
        ) : hasNoFamily ? (
          <Alert>
            <AlertCircle className="size-5" aria-hidden="true" />
            <AlertTitle>No active family found</AlertTitle>
            <AlertDescription>
              Join a family first or switch into a family context to view role assignments.
            </AlertDescription>
          </Alert>
        ) : hasError ? (
          <Alert>
            <AlertCircle className="size-5" aria-hidden="true" />
            <AlertTitle>Unable to load member roles</AlertTitle>
            <AlertDescription>
              {listMembersQuery.error?.message ?? "An unexpected error occurred."}
            </AlertDescription>
          </Alert>
        ) : (
          <ul className="space-y-2">
            {sortedMembers.map((member) => {
              const initials = getInitials(member.name);

              return (
                <li
                  key={member.id}
                  className="flex flex-col gap-3 rounded-xl border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="size-10 shrink-0 border">
                      <AvatarImage src={member.avatarUrl} alt={member.name} />
                      <AvatarFallback className="text-xs font-semibold text-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0">
                      <p className="truncate font-medium text-sm">{member.name}</p>

                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(roleBadgeStyles[member.role])}
                    >
                      {roleLabel[member.role]}
                    </Badge>

                    <MemberStatusBadge
                      status={member.status}
                      hasPendingClaimInvite={member.hasPendingClaimInvite}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Future PRD: add role editing controls (dropdowns/actions) for owner/admin. */}
      </section>

      <section className="space-y-3 rounded-2xl border bg-card/60 p-5">
        <h3 className="font-medium text-base">What each role can do</h3>

        <div className="overflow-x-auto">
          <table className="w-full min-w-140 border-collapse text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Owner</th>
                <th className="px-3 py-2 font-medium">Admin</th>
                <th className="px-3 py-2 font-medium">Member</th>
              </tr>
            </thead>
            <tbody>
              {permissionRows.map((row) => (
                <tr key={row.action} className="border-b last:border-0">
                  <td className="px-3 py-2">{row.action}</td>
                  <td className="px-3 py-2">
                    <PermissionCell value={row.owner} />
                  </td>
                  <td className="px-3 py-2">
                    <PermissionCell value={row.admin} />
                  </td>
                  <td className="px-3 py-2">
                    <PermissionCell value={row.member} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
