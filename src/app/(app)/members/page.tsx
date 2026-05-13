"use client";

import Link from "next/link";
import { Users } from "~/components/ui/icons";
import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";

import { MemberCard } from "~/components/members/member-card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
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
  const [showEmptyPreview, setShowEmptyPreview] = useState(false);

  const managementContext = api.invite.getManagementContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const familyId = managementContext.data?.family?.id;

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
    return (membersQuery.data ?? []).map((member) => ({
      id: member.id,
      slug: member.slug,
      name: member.name,
      nickname: member.nickname ?? undefined,
      status: member.status,
      hasPendingClaimInvite: member.hasPendingClaimInvite,
      role: member.role.toLowerCase() as "owner" | "admin" | "member",
      avatarUrl: member.image ?? undefined,
      addedByName: managementContext.data?.family?.name ?? "Family",
      addedAtLabel: `Added ${formatDistanceToNow(new Date(member.createdAt), { addSuffix: true })}`,
    }));
  }, [managementContext.data?.family?.name, membersQuery.data]);

  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return members.filter((member) => {
      const matchesFilter = filter === "all" ? true : member.status === filter;
      const matchesQuery =
        normalizedQuery.length === 0
          ? true
          : `${member.name} ${member.addedByName}`
              .toLowerCase()
              .includes(normalizedQuery);

      return matchesFilter && matchesQuery;
    });
  }, [filter, members, query]);

  const visibleMembers = showEmptyPreview ? [] : filteredMembers;
  const isLoading = managementContext.isLoading || membersQuery.isLoading;

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="font-semibold text-2xl tracking-tight">Family Members</h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            Keep your family circle complete by managing claimed and unclaimed member profiles.
          </p>
        </div>

        <Button asChild>
          <Link href="/members/new">Add family member</Link>
        </Button>
      </header>

      <section className="space-y-4 rounded-3xl border bg-card/80 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or who added them"
            aria-label="Search family members"
            className="sm:max-w-md"
          />

          <Button
            variant="ghost"
            onClick={() => setShowEmptyPreview((current) => !current)}
            type="button"
          >
            {showEmptyPreview ? "Hide empty-state preview" : "Preview empty state"}
          </Button>
        </div>

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

        {isLoading ? (
          <div className="rounded-2xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
            Loading family members...
          </div>
        ) : null}

        {!isLoading && visibleMembers.length === 0 ? (
          <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed px-6 py-10 text-center">
            <div className="max-w-md space-y-3">
              <div className="mx-auto grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
                <Users className="size-5" aria-hidden="true" />
              </div>
              <h2 className="font-medium text-base sm:text-lg">No members match this view</h2>
              <p className="text-sm text-muted-foreground">
                Try clearing search/filter settings or add a new family member profile.
              </p>
              <Button asChild size="sm">
                <Link href="/members/new">Add family member</Link>
              </Button>
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
