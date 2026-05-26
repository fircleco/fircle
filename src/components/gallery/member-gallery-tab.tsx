"use client";

import { useMemo, useState } from "react";

import { MediaViewerDialog } from "~/components/feed/media-viewer-dialog";
import { Button } from "~/components/ui/button";
import { Film } from "~/components/ui/icons";
import { api } from "~/trpc/react";

import { GalleryBentoGrid } from "./gallery-bento-grid";
import { GalleryLoadingState } from "./gallery-states";
import type { FamilyGalleryItem } from "./gallery-types";

type MemberGalleryTabProps = {
  familyId?: string;
  memberId?: string;
  memberName: string;
};

function SectionEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Film;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/80 bg-card/70 px-4 py-10 text-center">
      <div className="mx-auto flex size-10 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <p className="mt-3 font-medium text-sm">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function MemberGalleryTab({ familyId, memberId, memberName }: MemberGalleryTabProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStart, setViewerStart] = useState(0);
  const [viewerItems, setViewerItems] = useState<
    Array<{
      id: string;
      type: "image" | "video";
      url: string;
      alt: string;
      caption?: string;
      durationLabel?: string;
      taggedMembers?: Array<{ name: string; avatarUrl: string }>;
      tags?: Array<{
        id: string;
        postMediaId: string;
        taggedMemberId: string;
        xPercent: number | null;
        yPercent: number | null;
        createdAt: Date | string;
        updatedAt: Date | string;
        taggedMember: {
          id: string;
          name: string;
          slug: string;
          avatarUrl: string;
          status: "claimed" | "unclaimed";
        };
      }>;
    }>
  >([]);

  const memberGalleryQuery = api.media.getMemberGallery.useQuery(
    {
      familyId: familyId ?? "",
      memberId: memberId ?? "",
      limit: 40,
    },
    {
      enabled: Boolean(familyId && memberId),
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const managementContext = api.invite.getManagementContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const isAdmin = managementContext.data?.role === "OWNER" || managementContext.data?.role === "ADMIN";

  const currentMemberQuery = api.familyMember.getCurrentUserMemberProfile.useQuery(
    { familyId: familyId ?? "" },
    { enabled: Boolean(familyId), retry: false, refetchOnWindowFocus: false },
  );
  const currentMemberId = currentMemberQuery.data?.id;

  const publishedItems = useMemo<FamilyGalleryItem[]>(() => {
    return memberGalleryQuery.data?.publishedMedia ?? [];
  }, [memberGalleryQuery.data?.publishedMedia]);

  const taggedItems = useMemo<FamilyGalleryItem[]>(() => {
    return memberGalleryQuery.data?.taggedMedia ?? [];
  }, [memberGalleryQuery.data?.taggedMedia]);

  const allItems = useMemo<FamilyGalleryItem[]>(() => {
    const combined = [...publishedItems, ...taggedItems];
    const dedupedById = new Map<string, FamilyGalleryItem>();

    combined.forEach((item) => {
      if (!dedupedById.has(item.id)) {
        dedupedById.set(item.id, item);
      }
    });

    return Array.from(dedupedById.values()).sort((a, b) => {
      const timeDiff = new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return b.id.localeCompare(a.id);
    });
  }, [publishedItems, taggedItems]);

  const taggableMediaIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of allItems) {
      if (isAdmin || (currentMemberId && item.post.author.id === currentMemberId)) {
        ids.add(item.mediaItem.id);
      }
    }
    return ids;
  }, [allItems, currentMemberId, isAdmin]);

  function openViewer(index: number) {
    setViewerItems(allItems.map((item) => item.mediaItem));
    setViewerStart(index);
    setViewerOpen(true);
  }

  if (!familyId || !memberId) {
    return (
      <SectionEmptyState
        icon={Film}
        title="Gallery unavailable"
        description="Open this profile from an active family context to view media."
      />
    );
  }

  if (memberGalleryQuery.isLoading) {
    return <GalleryLoadingState />;
  }

  if (memberGalleryQuery.error) {
    return (
      <div className="rounded-2xl border border-border/80 bg-card/70 px-4 py-8 text-center">
        <p className="font-medium">Unable to load gallery</p>
        <p className="mt-1 text-sm text-muted-foreground">{memberGalleryQuery.error.message}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => void memberGalleryQuery.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {allItems.length > 0 ? (
        <GalleryBentoGrid items={allItems} onTileClick={openViewer} />
      ) : (
        <SectionEmptyState
          icon={Film}
          title="No media yet"
          description={`${memberName.split(" ")[0]} has no published or tagged photo/video memories yet.`}
        />
      )}

      <MediaViewerDialog
        items={viewerItems}
        startIndex={viewerStart}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        familyId={familyId}
        canManageTags={taggableMediaIds.size > 0}
        canManageTagsForItem={(item) => taggableMediaIds.has(item.id)}
      />
    </div>
  );
}
