"use client";

import Link from "next/link";
import { CalendarDays, Filter, UserRoundX } from "lucide-react";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { TaggedMemoryCard } from "~/components/memories/tagged-memory-card";
import { MemberProfileHeader } from "~/components/members/member-profile-header";
import { Button } from "~/components/ui/button";
import { getFamilyMemberProfileById } from "~/lib/mocks/family-members";
import { getTaggedMemoriesByMemberId } from "~/lib/mocks/tagging";

type MemoryFilter = "all" | "photos" | "videos" | "posts";

const FILTERS: Array<{ id: MemoryFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "photos", label: "Photos" },
  { id: "videos", label: "Videos" },
  { id: "posts", label: "Posts" },
];

function getDateGroupLabel(createdAtLabel: string) {
  if (createdAtLabel.includes("day") || createdAtLabel.includes("week")) {
    return "This month";
  }

  if (createdAtLabel.includes("month")) {
    return "2025";
  }

  return "Earlier";
}

export default function MemberMemoriesPage() {
  const params = useParams<{ memberId: string }>();
  const [filter, setFilter] = useState<MemoryFilter>("all");

  const memberId = params.memberId;
  const member = getFamilyMemberProfileById(memberId);
  const allMemories = getTaggedMemoriesByMemberId(memberId);

  const filteredMemories = useMemo(() => {
    if (filter === "all") {
      return allMemories;
    }

    if (filter === "photos") {
      return allMemories.filter((memory) => memory.type === "photo");
    }

    if (filter === "videos") {
      return allMemories.filter((memory) => memory.type === "video");
    }

    return allMemories.filter((memory) => memory.type === "post");
  }, [allMemories, filter]);

  const groupedMemories = useMemo(() => {
    const order: string[] = [];
    const groups = new Map<string, typeof filteredMemories>();

    filteredMemories.forEach((memory) => {
      const label = getDateGroupLabel(memory.createdAtLabel);

      if (!groups.has(label)) {
        groups.set(label, []);
        order.push(label);
      }

      const currentGroup = groups.get(label);

      if (currentGroup) {
        currentGroup.push(memory);
      }
    });

    return order.map((label) => ({ label, items: groups.get(label) ?? [] }));
  }, [filteredMemories]);

  if (!member) {
    return (
      <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-dashed p-8 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <UserRoundX className="size-5" aria-hidden="true" />
          </div>
          <h1 className="mt-3 font-semibold text-xl tracking-tight">Member not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">No family member exists with id: {memberId}</p>
          <Button asChild className="mt-4">
            <Link href="/members">Back to members</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <MemberProfileHeader member={member} />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="font-medium text-muted-foreground text-sm">Members / Memories</p>
          <h1 className="font-semibold text-3xl tracking-tight">Memories with {member.name}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            Browse photos, videos, and posts where this member is tagged. Filters and date groups are
            static previews for the future memory archive UX.
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href={`/members/${member.id}`}>Back to profile</Link>
        </Button>
      </header>

      <section className="rounded-3xl border bg-card p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="size-4" aria-hidden="true" />
            Filter memories
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((option) => (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant={filter === option.id ? "default" : "outline"}
                onClick={() => setFilter(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {groupedMemories.length > 0 ? (
        groupedMemories.map((group) => (
          <section key={group.label} className="space-y-3">
            <h2 className="inline-flex items-center gap-2 rounded-full border bg-muted/20 px-3 py-1 text-sm text-muted-foreground">
              <CalendarDays className="size-4" aria-hidden="true" />
              {group.label}
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {group.items.map((memory) => (
                <TaggedMemoryCard key={memory.id} memory={memory} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <section className="rounded-3xl border border-dashed px-4 py-12 text-center sm:px-8">
          <h2 className="font-medium text-lg">No tagged memories yet</h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            This member does not have memories for the selected filter yet. Try another filter or check
            back after new posts are tagged.
          </p>
        </section>
      )}
    </section>
  );
}