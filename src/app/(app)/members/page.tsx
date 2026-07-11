"use client";

import Link from "next/link";
import { Users } from "~/components/ui/icons";
import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";

import { MemberCard } from "~/components/members/member-card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import type { FamilyMemberStatus } from "~/lib/mocks/family-members";
import { api } from "~/trpc/react";

type MemberFilter = "all" | FamilyMemberStatus;

const memberFilters: Array<{ label: string; value: MemberFilter }> = [
  { label: "All", value: "all" },
  { label: "Claimed", value: "claimed" },
  { label: "Unclaimed", value: "unclaimed" },
];

export default function MembersPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MemberFilter>("all");

  const managementContext = api.family.getManagementContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const familyId = managementContext.data?.family?.id;
  const canManageMembers =
    managementContext.data?.role === "OWNER" || managementContext.data?.role === "ADMIN";

  const membersQuery = api.familyMember.listFamilyMembers.useQuery(
    {
      familyId: familyId ?? "",
    },
    {
      enabled: Boolean(familyId),
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const members = useMemo(() => {
    return (membersQuery.data ?? []).map((member) => {
      const joinedAt = member.acceptedInviteAt
        ? new Date(member.acceptedInviteAt)
        : new Date(member.createdAt);
      const invitedAt = member.latestPendingInviteAt
        ? new Date(member.latestPendingInviteAt)
        : null;
      const addedAt = new Date(member.createdAt);

      return {
        id: member.id,
        slug: member.slug,
        name: member.name,
        nickname: member.nickname ?? undefined,
        status: member.status,
        hasPendingClaimInvite: member.hasPendingClaimInvite,
        role: member.role.toLowerCase() as "owner" | "admin" | "member",
        avatarUrl: member.image ?? undefined,
        addedAtLabel:
          member.status === "claimed"
            ? `Joined ${formatDistanceToNow(joinedAt, { addSuffix: true })}`
            : member.hasPendingClaimInvite && invitedAt
              ? `Invited ${formatDistanceToNow(invitedAt, { addSuffix: true })}`
              : `Added ${formatDistanceToNow(addedAt, { addSuffix: true })}`,
      }
    });
  }, [membersQuery.data]);

  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return members.filter((member) => {
      const matchesFilter = filter === "all" ? true : member.status === filter;
      const matchesQuery =
        normalizedQuery.length === 0
          ? true
          : member.name.toLowerCase().includes(normalizedQuery);

      return matchesFilter && matchesQuery;
    });
  }, [filter, members, query]);

  const visibleMembers = filteredMembers;
  const isLoading = managementContext.isLoading || membersQuery.isLoading;

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="mx-auto w-full max-w-2xl flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Family Members</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep your family circle complete by managing member profiles.
          </p>
        </div>

        {canManageMembers ? (
          <Button asChild>
            <Link href="/members/new">Add family member</Link>
          </Button>
        ) : null}
      </header>

      <section className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {memberFilters.map((item) => (
              <Button
                key={item.value}
                type="button"
                size="sm"
                variant={filter === item.value ? "default" : "outline"}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>

          <div className="w-full sm:w-auto">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search family members by name"
              aria-label="Search family members"
              className="w-full sm:w-80"
            />
          </div>
        </div>

        {isLoading ? (
          <MembersGridSkeleton />
        ) : visibleMembers.length === 0 ? (
          <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed px-6 py-10 text-center">
            <div className="max-w-md space-y-3">
              <div className="mx-auto grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
                <Users className="size-5" aria-hidden="true" />
              </div>
              <h2 className="font-medium text-base sm:text-lg">No members match this view</h2>
              <p className="text-sm text-muted-foreground">
                Try clearing search/filter settings or add a new family member profile.
              </p>
              {canManageMembers ? (
                <Button asChild size="sm">
                  <Link href="/members/new">Add family member</Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleMembers.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function MembersGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }).map((_, index) => (
        <article key={`member-skeleton-${index}`} className="rounded-3xl border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Skeleton className="size-12 shrink-0 rounded-full border" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-28 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full rounded-full" />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
