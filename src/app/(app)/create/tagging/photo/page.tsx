"use client";

import Link from "next/link";
import { ArrowRight, ImagePlus, Layers3, Sparkles } from "~/components/ui/icons";
import { useMemo, useState } from "react";

import { MemberStatusBadge } from "~/components/members/member-status-badge";
import { PhotoTagEditor } from "~/components/tagging/photo-tag-editor";
import { TaggedMemberPicker } from "~/components/tagging/tagged-member-picker";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { familyMembers } from "~/lib/mocks/family-members";
import { photoTaggingExamples } from "~/lib/mocks/tagging";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function PhotoTaggingPage() {
  const primaryExample = photoTaggingExamples[0];
  const denseExample = photoTaggingExamples[1];

  const [view, setView] = useState<"tagged" | "dense" | "empty">("tagged");
  const [selectedAnchorId, setSelectedAnchorId] = useState(primaryExample?.anchors[0]?.id ?? null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    primaryExample ? Array.from(new Set(primaryExample.anchors.map((anchor) => anchor.person.memberId))) : [],
  );

  const taggedMembers = useMemo(() => {
    return familyMembers.filter((member) => selectedMemberIds.includes(member.id));
  }, [selectedMemberIds]);

  if (!primaryExample || !denseExample) {
    return null;
  }

  const currentExample = view === "dense" ? denseExample : primaryExample;
  const selectedAnchor = currentExample.anchors.find((anchor) => anchor.id === selectedAnchorId) ?? null;

  const handleViewChange = (nextView: "tagged" | "dense" | "empty") => {
    setView(nextView);

    if (nextView === "empty") {
      setSelectedAnchorId(null);
      setSelectedMemberIds([]);
      return;
    }

    const nextExample = nextView === "dense" ? denseExample : primaryExample;
    setSelectedAnchorId(nextExample.anchors[0]?.id ?? null);
    setSelectedMemberIds(Array.from(new Set(nextExample.anchors.map((anchor) => anchor.person.memberId))));
  };

  const handleToggleMember = (memberId: string) => {
    setSelectedMemberIds((currentIds) =>
      currentIds.includes(memberId)
        ? currentIds.filter((currentId) => currentId !== memberId)
        : [...currentIds, memberId],
    );
  };

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="font-medium text-muted-foreground text-sm">Create / Tagging</p>
          <h1 className="font-semibold text-3xl tracking-tight sm:text-4xl">Tag people in a photo</h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            Place tags directly on the image, review who is attached to the memory, and preview how
            empty and crowded states will behave before any backend logic exists.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: "tagged", label: "Tagged photo", icon: Sparkles },
            { id: "dense", label: "Crowded scene", icon: Layers3 },
            { id: "empty", label: "Empty state", icon: ImagePlus },
          ].map((option) => {
            const Icon = option.icon;

            return (
              <Button
                key={option.id}
                type="button"
                variant={view === option.id ? "default" : "outline"}
                size="sm"
                onClick={() => handleViewChange(option.id as "tagged" | "dense" | "empty")}
              >
                <Icon className="size-4" aria-hidden="true" />
                {option.label}
              </Button>
            );
          })}
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(22rem,26rem)]">
        <div className="space-y-4">
          <PhotoTagEditor
            example={currentExample}
            selectedAnchorId={selectedAnchorId}
            onSelectAnchor={setSelectedAnchorId}
            emptyState={view === "empty"}
            maxVisibleAnchors={view === "dense" ? 3 : undefined}
          />

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-3xl border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium text-lg">Selected tag</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Preview the detail state for the active marker before saving tags.
                  </p>
                </div>

                {selectedAnchor ? <MemberStatusBadge status={selectedAnchor.person.status} /> : null}
              </div>

              {selectedAnchor ? (
                <div className="mt-4 flex flex-col gap-4 rounded-[1.75rem] border bg-muted/20 p-4 sm:flex-row sm:items-center">
                  <Avatar className="size-14 shrink-0 border">
                    <AvatarImage src={selectedAnchor.person.avatarUrl} alt={selectedAnchor.person.name} />
                    <AvatarFallback className="text-sm font-semibold text-foreground">
                      {getInitials(selectedAnchor.person.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-medium text-base">{selectedAnchor.person.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedAnchor.label ?? "Photo tag"}</p>

                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-[1.75rem] border border-dashed bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
                  Select a marker to preview its member details, or switch to the empty state to see
                  how an untagged photo looks.
                </div>
              )}
            </section>

            <section className="rounded-3xl border bg-card p-5">
              <h2 className="font-medium text-lg">Tagged members at a glance</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Visual summary of everyone currently attached to this photo mock.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {taggedMembers.length > 0 ? (
                  taggedMembers.map((member) => (
                    <span
                      key={member.id}
                      className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs"
                    >
                      <span className="font-medium">{member.name}</span>
                      <MemberStatusBadge status={member.status} className="px-2 py-0.5 text-[10px]" />
                    </span>
                  ))
                ) : (
                  <span className="rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground">
                    No one tagged yet
                  </span>
                )}
              </div>
            </section>
          </div>
        </div>

        <aside className="rounded-[2rem] border bg-card p-5 shadow-sm">
          <TaggedMemberPicker
            members={familyMembers}
            selectedMemberIds={selectedMemberIds}
            onToggleMember={handleToggleMember}
          />

          <div className="mt-6 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost">
              Skip for now
            </Button>
            <Button asChild>
              <Link href="/create/tagging/video">
                Save tags
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </aside>
      </div>
    </section>
  );
}
