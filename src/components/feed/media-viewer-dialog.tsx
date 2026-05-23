"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { X } from "~/components/ui/icons";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "~/components/ui/carousel";
import type { CarouselApi } from "~/components/ui/carousel";
import { api } from "~/trpc/react";

type TaggedMember = {
  id?: string;
  name: string;
  avatarUrl: string;
};

type MediaTagRecord = {
  id: string;
  postMediaId: string;
  taggedMemberId: string;
  xPercent: number | null;
  yPercent: number | null;
  taggedMember: {
    id: string;
    name: string;
    avatarUrl: string;
  };
};

export type MediaViewerItem = {
  id: string;
  type: "image" | "video";
  url: string;
  alt: string;
  caption?: string;
  taggedMembers?: TaggedMember[];
  tags?: MediaTagRecord[];
};

type MediaViewerDialogProps = {
  items: MediaViewerItem[];
  startIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyId?: string;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getTagAnchorStyle(tag: MediaTagRecord) {
  if (tag.xPercent === null || tag.yPercent === null) {
    return null;
  }

  return {
    left: `${tag.xPercent}%`,
    top: `${tag.yPercent}%`,
  } as const;
}

function MediaSlide({
  item,
  tags,
  taggedMembers,
  editorEnabled,
  onImageClick,
}: {
  item: MediaViewerItem;
  tags: MediaTagRecord[];
  taggedMembers: TaggedMember[];
  editorEnabled: boolean;
  onImageClick?: (event: React.MouseEvent<HTMLImageElement>) => void;
}) {
  if (item.type === "video") {
    return (
      <div className="relative flex h-full w-full items-center justify-center">
        <video
          src={item.url}
          controls
          className="max-h-full w-full max-w-full rounded-lg object-contain"
          aria-label={item.alt}
        />

        {taggedMembers.length ? <TaggedMembersOverlay members={taggedMembers} /> : null}

        {item.caption ? (
          <p className="absolute bottom-2 left-2 max-w-[min(92vw,28rem)] rounded-xl border border-black/10 bg-white/75 px-3 py-2 text-sm text-foreground shadow-lg backdrop-blur-sm dark:border-white/10 dark:bg-black/60 dark:text-white">
            {item.caption}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div className="relative inline-flex max-h-full max-w-full">
        <img
          src={item.url}
          alt={item.alt}
          className={`max-h-full max-w-full rounded-lg object-contain ${editorEnabled ? "cursor-crosshair" : ""}`}
          onClick={onImageClick}
        />

        {tags.map((tag) => {
          const style = getTagAnchorStyle(tag);
          if (!style) return null;

          return (
            <span
              key={tag.id}
              className="pointer-events-none absolute inline-flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/90 bg-black/65 text-[10px] font-semibold text-white shadow"
              style={style}
              title={`${tag.taggedMember.name}`}
            >
              •
            </span>
          );
        })}
      </div>

      {taggedMembers.length ? <TaggedMembersOverlay members={taggedMembers} /> : null}

      {item.caption ? (
        <p className="absolute bottom-2 left-2 max-w-[min(92vw,28rem)] rounded-xl border border-black/10 bg-white/75 px-3 py-2 text-sm text-foreground shadow-lg backdrop-blur-sm dark:border-white/10 dark:bg-black/60 dark:text-white">
          {item.caption}
        </p>
      ) : null}
    </div>
  );
}

function TaggedMembersOverlay({ members }: { members: TaggedMember[] }) {
  return (
    <div className="absolute bottom-16 left-2 max-w-[min(92vw,28rem)] rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/55 px-3 py-2 text-foreground dark:text-white shadow-xl backdrop-blur-sm">
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground dark:text-white/60">
        Tagged in this media
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {members.map((member) => (
          <div
            key={member.name}
            className="inline-flex items-center gap-2 rounded-full bg-black/10 dark:bg-white/10 text-foreground dark:text-white px-2.5 py-1"
            title={member.name}
          >
            <Avatar className="size-5">
              <AvatarImage src={member.avatarUrl} alt={member.name} />
              <AvatarFallback className="text-[10px] font-semibold text-foreground dark:text-white">
                {getInitials(member.name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs font-medium">{member.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MediaViewerDialog({
  items,
  startIndex = 0,
  open,
  onOpenChange,
  familyId,
}: MediaViewerDialogProps) {
  const [current, setCurrent] = React.useState(startIndex);
  const [carouselApi, setCarouselApi] = React.useState<CarouselApi>();
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [selectedMemberId, setSelectedMemberId] = React.useState<string>("");
  const [editingTagId, setEditingTagId] = React.useState<string | null>(null);
  const [pendingPoint, setPendingPoint] = React.useState<{ xPercent: number; yPercent: number } | null>(null);
  const trpcUtils = api.useUtils();
  const mediaViewportClass = "w-full max-w-7xl";
  const mediaFrameClass = "flex h-[calc(100vh-8rem)] w-full items-center justify-center";
  const currentItem = items[current] ?? null;

  const familyMembersQuery = api.familyMember.listFamilyMembers.useQuery(
    { familyId: familyId ?? "" },
    {
      enabled: open && Boolean(familyId),
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const tagsQuery = api.tag.listTagsByMedia.useQuery(
    { familyId: familyId ?? "", postMediaId: currentItem?.id ?? "" },
    {
      enabled: open && Boolean(familyId && currentItem?.id),
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const createPhotoTagMutation = api.tag.createPhotoTag.useMutation();
  const updatePhotoTagMutation = api.tag.updatePhotoTag.useMutation();
  const createVideoTagMutation = api.tag.createVideoTag.useMutation();
  const updateVideoTagMutation = api.tag.updateVideoTag.useMutation();
  const deleteTagMutation = api.tag.deleteTag.useMutation();

  const currentTags: MediaTagRecord[] = React.useMemo(
    () => (tagsQuery.data?.items as MediaTagRecord[] | undefined) ?? (currentItem?.tags ?? []),
    [currentItem?.tags, tagsQuery.data?.items],
  );

  const taggedMembers = React.useMemo(() => {
    if (currentTags.length > 0) {
      const byMemberId = new Map<string, TaggedMember>();
      for (const tag of currentTags) {
        byMemberId.set(tag.taggedMemberId, {
          id: tag.taggedMember.id,
          name: tag.taggedMember.name,
          avatarUrl: tag.taggedMember.avatarUrl,
        });
      }
      return Array.from(byMemberId.values());
    }
    return currentItem?.taggedMembers ?? [];
  }, [currentItem?.taggedMembers, currentTags]);

  const activeMutationPending =
    createPhotoTagMutation.isPending ||
    updatePhotoTagMutation.isPending ||
    createVideoTagMutation.isPending ||
    updateVideoTagMutation.isPending ||
    deleteTagMutation.isPending;

  const editorError =
    createPhotoTagMutation.error?.message ??
    updatePhotoTagMutation.error?.message ??
    createVideoTagMutation.error?.message ??
    updateVideoTagMutation.error?.message ??
    deleteTagMutation.error?.message ??
    null;

  async function invalidatePostSurfaces() {
    await Promise.all([
      trpcUtils.post.getFeed.invalidate(),
      trpcUtils.post.getById.invalidate(),
      trpcUtils.post.getPostsByMember.invalidate(),
      trpcUtils.post.getLikedPostsByMember.invalidate(),
      trpcUtils.post.getTaggedPostsByMember.invalidate(),
    ]);
  }

  async function refetchCurrentTags() {
    await tagsQuery.refetch();
    await invalidatePostSurfaces();
  }

  function startEditing(tag: MediaTagRecord) {
    setEditingTagId(tag.id);
    setSelectedMemberId(tag.taggedMemberId);
    if (tag.xPercent !== null && tag.yPercent !== null) {
      setPendingPoint({
        xPercent: tag.xPercent,
        yPercent: tag.yPercent,
      });
    } else {
      setPendingPoint(null);
    }
  }

  async function handleDeleteTag(tagId: string) {
    if (!familyId) return;
    await deleteTagMutation.mutateAsync({
      familyId,
      tagId,
    });
    if (editingTagId === tagId) {
      setEditingTagId(null);
    }
    await refetchCurrentTags();
  }

  async function handleSaveTag() {
    if (!familyId || !currentItem || !selectedMemberId) {
      return;
    }

    if (currentItem.type === "video") {
      if (editingTagId) {
        await updateVideoTagMutation.mutateAsync({
          familyId,
          tagId: editingTagId,
          taggedMemberId: selectedMemberId,
        });
      } else {
        await createVideoTagMutation.mutateAsync({
          familyId,
          postMediaId: currentItem.id,
          taggedMemberId: selectedMemberId,
        });
      }
    } else {
      if (editingTagId) {
        const existing = currentTags.find((tag) => tag.id === editingTagId);
        const xPercent = pendingPoint?.xPercent ?? existing?.xPercent;
        const yPercent = pendingPoint?.yPercent ?? existing?.yPercent;

        if (xPercent === null || xPercent === undefined || yPercent === null || yPercent === undefined) {
          return;
        }

        await updatePhotoTagMutation.mutateAsync({
          familyId,
          tagId: editingTagId,
          taggedMemberId: selectedMemberId,
          xPercent,
          yPercent,
        });
      } else {
        if (!pendingPoint) {
          return;
        }

        await createPhotoTagMutation.mutateAsync({
          familyId,
          postMediaId: currentItem.id,
          taggedMemberId: selectedMemberId,
          xPercent: pendingPoint.xPercent,
          yPercent: pendingPoint.yPercent,
        });
      }
    }

    setEditingTagId(null);
    setPendingPoint(null);
    await refetchCurrentTags();
  }

  function handleImageClick(event: React.MouseEvent<HTMLImageElement>) {
    if (!editorOpen || !currentItem || currentItem.type !== "image") {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setPendingPoint({
      xPercent: Math.max(0, Math.min(100, Number(x.toFixed(2)))),
      yPercent: Math.max(0, Math.min(100, Number(y.toFixed(2)))),
    });
  }

  // Sync current slide index when the dialog opens or startIndex changes
  React.useEffect(() => {
    if (open) {
      setCurrent(startIndex);
      carouselApi?.scrollTo(startIndex, true);
      setEditingTagId(null);
      setPendingPoint(null);
    }
  }, [open, startIndex, carouselApi]);

  React.useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => setCurrent(carouselApi.selectedScrollSnap());
    carouselApi.on("select", onSelect);
    return () => {
      carouselApi.off("select", onSelect);
    };
  }, [carouselApi]);

  React.useEffect(() => {
    if (!open) return;
    setEditingTagId(null);
    setPendingPoint(null);
  }, [current, open]);

  React.useEffect(() => {
    if (!selectedMemberId) {
      const firstMemberId = familyMembersQuery.data?.[0]?.id;
      if (firstMemberId) {
        setSelectedMemberId(firstMemberId);
      }
    }
  }, [familyMembersQuery.data, selectedMemberId]);

  const isSingle = items.length === 1;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 dark:bg-black/92 bg-white/95 backdrop-blur-sm" />

        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col outline-none"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <DialogPrimitive.Title className="sr-only">
            Media viewer
          </DialogPrimitive.Title>

          {/* Top bar */}
          <div className="flex shrink-0 items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              {!isSingle ? (
                <span className="text-sm font-medium dark:text-white/60 text-muted-foreground">
                  {current + 1} / {items.length}
                </span>
              ) : null}
              {familyId && currentItem ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => setEditorOpen((value) => !value)}
                >
                  {editorOpen ? "Close tag editor" : "Manage tags"}
                </Button>
              ) : null}
            </div>

            <DialogPrimitive.Close className="flex size-10 items-center justify-center rounded-full dark:bg-white/10 dark:text-white dark:hover:bg-white/20 bg-black/10 text-foreground hover:bg-black/20 transition-colors active:translate-y-0 active:scale-100">
              <X className="size-5" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          {editorOpen && currentItem && familyId ? (
            <div className="mx-4 mb-3 rounded-2xl border border-border/70 bg-card/90 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="media-tag-member">
                  Member
                </label>
                <select
                  id="media-tag-member"
                  className="min-w-48 rounded-xl border border-border bg-background px-2.5 py-1.5 text-sm"
                  value={selectedMemberId}
                  onChange={(event) => setSelectedMemberId(event.target.value)}
                >
                  {(familyMembersQuery.data ?? []).map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>

                {currentItem.type === "image" ? (
                  <span className="text-xs text-muted-foreground">
                    {pendingPoint
                      ? `Anchor: ${pendingPoint.xPercent.toFixed(2)}%, ${pendingPoint.yPercent.toFixed(2)}%`
                      : "Click the image to place an anchor"}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Video tags use member assignment only</span>
                )}

                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleSaveTag()}
                  disabled={
                    activeMutationPending ||
                    !selectedMemberId ||
                    familyMembersQuery.isLoading ||
                    (currentItem.type === "image" && !editingTagId && !pendingPoint)
                  }
                >
                  {editingTagId ? "Update tag" : "Add tag"}
                </Button>

                {editingTagId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingTagId(null);
                      setPendingPoint(null);
                    }}
                    disabled={activeMutationPending}
                  >
                    Cancel edit
                  </Button>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {currentTags.map((tag) => (
                  <div key={tag.id} className="inline-flex items-center gap-2 rounded-full border border-border px-2 py-1 text-xs">
                    <span>{tag.taggedMember.name}</span>
                    {tag.xPercent !== null && tag.yPercent !== null ? (
                      <span className="text-muted-foreground">({tag.xPercent.toFixed(1)}%, {tag.yPercent.toFixed(1)}%)</span>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 rounded-full px-2 text-xs"
                      onClick={() => startEditing(tag)}
                      disabled={activeMutationPending}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 rounded-full px-2 text-xs text-destructive"
                      onClick={() => void handleDeleteTag(tag.id)}
                      disabled={activeMutationPending}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              {editorError ? <p className="mt-2 text-xs text-destructive">{editorError}</p> : null}
            </div>
          ) : null}

          {/* Media area */}
          <div className="flex flex-1 items-center justify-center overflow-hidden px-2 pb-3 sm:px-4 sm:pb-4">
            {isSingle ? (
              <div className={mediaViewportClass}>
                <div className={mediaFrameClass}>
                  <MediaSlide
                    item={items[0]!}
                    tags={currentItem?.id === items[0]!.id ? currentTags : (items[0]!.tags ?? [])}
                    taggedMembers={
                      currentItem?.id === items[0]!.id
                        ? taggedMembers
                        : (items[0]!.taggedMembers ?? [])
                    }
                    editorEnabled={editorOpen && currentItem?.id === items[0]!.id && items[0]!.type === "image"}
                    onImageClick={(event) => {
                      if (currentItem?.id === items[0]!.id) {
                        handleImageClick(event);
                      }
                    }}
                  />
                </div>
              </div>
            ) : (
              <Carousel
                className={mediaViewportClass}
                opts={{ startIndex, loop: false }}
                setApi={setCarouselApi}
              >
                <CarouselContent>
                  {items.map((item, index) => (
                    <CarouselItem key={item.id}>
                      <div className={mediaFrameClass}>
                        <MediaSlide
                          item={item}
                          tags={current === index ? currentTags : (item.tags ?? [])}
                          taggedMembers={current === index ? taggedMembers : (item.taggedMembers ?? [])}
                          editorEnabled={editorOpen && current === index && item.type === "image"}
                          onImageClick={(event) => {
                            if (current === index) {
                              handleImageClick(event);
                            }
                          }}
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 border-black/20 bg-black/10 text-foreground hover:bg-black/20 active:translate-y-0 active:scale-100 disabled:opacity-30" />
                <CarouselNext className="dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 border-black/20 bg-black/10 text-foreground hover:bg-black/20 active:translate-y-0 active:scale-100 disabled:opacity-30" />
              </Carousel>
            )}
          </div>

          {/* Dot indicators */}
          {!isSingle && (
            <div className="flex shrink-0 justify-center gap-1.5 pb-4 sm:pb-6">
              {items.map((item, i) => (
                <div
                  key={item.id}
                  className={`size-1.5 rounded-full transition-colors ${
                    i === current ? "dark:bg-white bg-black" : "dark:bg-white/25 bg-black/25"
                  }`}
                />
              ))}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
