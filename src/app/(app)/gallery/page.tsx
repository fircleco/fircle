"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { GalleryBentoGrid } from "~/components/gallery/gallery-bento-grid";
import {
  type FamilyGalleryItem,
} from "~/components/gallery/gallery-types";
import {
  GalleryEmptyState,
  GalleryErrorState,
  GalleryLoadingState,
} from "~/components/gallery/gallery-states";
import { MediaViewerDialog } from "~/components/feed/media-viewer-dialog";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

type FamilyGalleryInput = {
  familyId: string;
  limit: number;
  cursor?: string;
};

const mediaGalleryApi = api as unknown as {
  media: {
    getFamilyGallery: {
      useQuery: (
        input: FamilyGalleryInput,
        options: {
          enabled: boolean;
          retry: boolean;
          refetchOnWindowFocus: boolean;
        },
      ) => {
        data?: unknown;
        isLoading: boolean;
        error: { message: string } | null;
        refetch: () => Promise<unknown>;
      };
    };
  };
};

export default function GalleryPage() {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStart, setViewerStart] = useState(0);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<FamilyGalleryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const lastAppliedCursorRef = useRef<string | null>(null);

  const managementContext = api.invite.getManagementContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const familyId = managementContext.data?.family?.id;
  const familyName = managementContext.data?.family?.name;
  const isAdmin = managementContext.data?.role === "OWNER" || managementContext.data?.role === "ADMIN";

  const currentMemberQuery = api.familyMember.getCurrentUserMemberProfile.useQuery(
    { familyId: familyId ?? "" },
    { enabled: Boolean(familyId), retry: false, refetchOnWindowFocus: false },
  );
  const currentMemberId = currentMemberQuery.data?.id;

  const familyGalleryQuery = mediaGalleryApi.media.getFamilyGallery.useQuery(
    {
      familyId: familyId ?? "",
      limit: 30,
      cursor,
    },
    {
      enabled: Boolean(familyId),
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  useEffect(() => {
    setCursor(undefined);
    setItems([]);
    setNextCursor(null);
    setIsLoadingMore(false);
    lastAppliedCursorRef.current = null;
  }, [familyId]);

  useEffect(() => {
    const rawResponse = familyGalleryQuery.data;
    if (!rawResponse || typeof rawResponse !== "object") {
      return;
    }

    const candidate = rawResponse as {
      items?: FamilyGalleryItem[];
      nextCursor?: string | null;
    };

    if (!Array.isArray(candidate.items)) {
      return;
    }

    if (!(typeof candidate.nextCursor === "string" || candidate.nextCursor === null)) {
      return;
    }

    const responseData = {
      items: candidate.items,
      nextCursor: candidate.nextCursor,
    };

    const cursorKey = cursor ?? "__initial__";
    if (lastAppliedCursorRef.current === cursorKey) {
      return;
    }

    lastAppliedCursorRef.current = cursorKey;

    setItems((previousItems) => {
      if (!cursor) {
        return responseData.items;
      }

      const merged = [...previousItems, ...responseData.items];
      const seen = new Set<string>();

      return merged.filter((item) => {
        if (seen.has(item.id)) {
          return false;
        }
        seen.add(item.id);
        return true;
      });
    });

    setNextCursor(responseData.nextCursor);
    setIsLoadingMore(false);
  }, [cursor, familyGalleryQuery.data]);

  const galleryItems = items;

  const viewerItems = useMemo(
    () => galleryItems.map((item) => item.mediaItem),
    [galleryItems],
  );

  const taggableMediaIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of galleryItems) {
      if (isAdmin || (currentMemberId && item.post.author.id === currentMemberId)) {
        ids.add(item.mediaItem.id);
      }
    }
    return ids;
  }, [currentMemberId, galleryItems, isAdmin]);

  const isLoadingGallery =
    managementContext.isLoading || (Boolean(familyId) && familyGalleryQuery.isLoading && !items.length);
  const hasNoFamily = !managementContext.isLoading && !familyId;

  function openViewer(index: number) {
    setViewerStart(index);
    setViewerOpen(true);
  }

  function handleLoadMore() {
    if (!nextCursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    setCursor(nextCursor);
  }

  return (
    <section className="w-full px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className="space-y-1 mx-auto w-full max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight">Gallery</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse your family photo and video moments in a media-first timeline.
          </p>
        </header>

        {hasNoFamily ? (
          <section className="rounded-3xl border border-dashed border-border/80 bg-card/70 px-6 py-12 text-center">
            <h2 className="font-semibold text-lg tracking-tight">No family membership found</h2>
            <p className="mx-auto mt-2 max-w-sm text-muted-foreground text-sm sm:text-base">
              Join a family to start browsing shared memories.
            </p>
          </section>
        ) : isLoadingGallery ? (
          <GalleryLoadingState />
        ) : familyGalleryQuery.error ? (
          <GalleryErrorState
            message={familyGalleryQuery.error.message}
            onRetry={() => void familyGalleryQuery.refetch()}
          />
        ) : galleryItems.length === 0 ? (
          <GalleryEmptyState familyName={familyName} />
        ) : (
          <>
            <GalleryBentoGrid items={galleryItems} onTileClick={openViewer} />

            {nextCursor ? (
              <div className="flex justify-center pb-20 pt-2 md:pb-6">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? "Loading more" : "Load more"}
                </Button>
              </div>
            ) : null}
          </>
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
    </section>
  );
}
