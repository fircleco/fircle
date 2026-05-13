"use client";

import { Check, Search, Tag } from "~/components/ui/icons";
import { useMemo, useState } from "react";

import { MemberStatusBadge } from "~/components/members/member-status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Input } from "~/components/ui/input";
import type { FamilyMemberSummary } from "~/lib/mocks/family-members";
import { cn } from "~/lib/utils";

type TaggedMemberPickerProps = {
  members: FamilyMemberSummary[];
  selectedMemberIds: string[];
  onToggleMember: (memberId: string) => void;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function TaggedMemberPicker({
  members,
  selectedMemberIds,
  onToggleMember,
}: TaggedMemberPickerProps) {
  const [query, setQuery] = useState("");

  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return members;
    }

    return members.filter((member) => {
      return (
        member.name.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [members, query]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="font-medium text-lg">Tagged members</p>
        <p className="text-sm text-muted-foreground">
          Search the family list and toggle who should be attached to this photo.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search members"
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {selectedMemberIds.length > 0 ? (
          members
            .filter((member) => selectedMemberIds.includes(member.id))
            .map((member) => (
              <span
                key={member.id}
                className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs text-foreground"
              >
                <Tag className="size-3.5 text-muted-foreground" aria-hidden="true" />
                {member.name}
              </span>
            ))
        ) : (
          <span className="rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground">
            No members selected
          </span>
        )}
      </div>

      <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
        {filteredMembers.map((member) => {
          const isSelected = selectedMemberIds.includes(member.id);
          const initials = getInitials(member.name);

          return (
            <button
              key={member.id}
              type="button"
              onClick={() => onToggleMember(member.id)}
              className={cn(
                "flex w-full items-start gap-3 rounded-3xl border p-3 text-left transition outline-none hover:border-primary/30 hover:bg-muted/20 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
                isSelected && "border-primary/40 bg-primary/5",
              )}
            >
              <Avatar className="size-11 shrink-0 border">
                <AvatarImage src={member.avatarUrl} alt={member.name} />
                <AvatarFallback className="text-sm font-semibold text-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-sm sm:text-base">{member.name}</p>
                  <div className="flex items-center gap-2">
                    <MemberStatusBadge status={member.status} />
                    {isSelected ? (
                      <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3.5" aria-hidden="true" />
                      </span>
                    ) : null}
                  </div>
                </div>

              </div>
            </button>
          );
        })}

        {filteredMembers.length === 0 ? (
          <div className="rounded-3xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            No family members match that search yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
