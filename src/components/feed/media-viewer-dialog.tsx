"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Dialog as DialogPrimitive } from "radix-ui";

import { Tag, X } from "~/components/ui/icons";
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
  slug?: string;
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
    slug?: string;
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
  highlightedTagId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  familyId?: string;
  canManageTags?: boolean;
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

function MemberPickerPopover({
  pendingPoint,
  members,
  onSelect,
  onDismiss,
  isPending,
  error,
}: {
  pendingPoint: { xPercent: number; yPercent: number };
  members: { id: string; name: string; avatarUrl: string }[];
  onSelect: (memberId: string) => void;
  onDismiss: () => void;
  isPending: boolean;
  error: string | null;
}) {
  const [search, setSearch] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, []);

  const filtered = search.trim()
    ? members.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
    : members;

  const above = pendingPoint.yPercent > 55;
  const fromRight = pendingPoint.xPercent > 65;

  return (
    <div
      className={`absolute z-20 w-56 rounded-2xl border border-border/70 bg-card shadow-2xl backdrop-blur-sm ${
        above ? "bottom-full mb-3" : "top-full mt-3"
      } ${fromRight ? "right-0" : "left-0"}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 pb-1.5 pt-3">
        <span className="text-xs font-semibold text-foreground">Tag a member</span>
        <button
          type="button"
          onClick={onDismiss}
          className="flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="px-2 pb-1.5">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search members…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="max-h-48 overflow-y-auto p-1 scrollbar">
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">No members found</p>
        ) : (
          filtered.map((member) => (
            <button
              key={member.id}
              type="button"
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-muted/60 disabled:opacity-50 rounded-xl"
              onClick={() => onSelect(member.id)}
              disabled={isPending}
            >
              <Avatar className="size-6 shrink-0">
                <AvatarImage src={member.avatarUrl} alt={member.name} />
                <AvatarFallback className="text-[10px]">{getInitials(member.name)}</AvatarFallback>
              </Avatar>
              <span className="truncate font-medium">{member.name}</span>
            </button>
          ))
        )}
      </div>
      {error ? (
        <p className="border-t border-border px-3 py-2 text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

function VideoTagEditorPanel({
  tags,
  familyMembers,
  onTagCreate,
  onTagDelete,
  onEditorClose,
  activeMutationPending,
  editorError,
}: {
  tags: MediaTagRecord[];
  familyMembers: { id: string; name: string; avatarUrl: string }[];
  onTagCreate?: (memberId: string) => void;
  onTagDelete?: (tagId: string) => void;
  onEditorClose?: () => void;
  activeMutationPending?: boolean;
  editorError?: string | null;
}) {
  const [search, setSearch] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, []);

  const filtered = search.trim()
    ? familyMembers.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
    : familyMembers;

  const taggedMemberIds = new Set(tags.map((t) => t.taggedMemberId));
  const availableMembers = filtered.filter((m) => !taggedMemberIds.has(m.id));

  return (
    <div className="absolute bottom-4 left-1/2 z-10 w-72 -translate-x-1/2 rounded-2xl border border-border/70 bg-card/95 shadow-2xl backdrop-blur-sm">
      <div className="flex items-center justify-between px-3 pb-1.5 pt-3">
        <span className="text-xs font-semibold text-foreground">Tag members</span>
        <button
          type="button"
          onClick={onEditorClose}
          className="flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {tags.length > 0 && (
        <div className="border-t border-border px-3 py-2">
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <div key={tag.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs">
                <span className="font-medium">{tag.taggedMember.name}</span>
                <button
                  type="button"
                  className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                  onClick={() => void onTagDelete?.(tag.id)}
                  disabled={activeMutationPending}
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-2 pb-1.5 pt-2">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search members…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="max-h-48 overflow-y-auto py-1">
        {availableMembers.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">
            {filtered.length === 0 ? "No members found" : "All members tagged"}
          </p>
        ) : (
          availableMembers.map((member) => (
            <button
              key={member.id}
              type="button"
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-muted/60 disabled:opacity-50"
              onClick={() => onTagCreate?.(member.id)}
              disabled={activeMutationPending}
            >
              <Avatar className="size-6 shrink-0">
                <AvatarImage src={member.avatarUrl} alt={member.name} />
                <AvatarFallback className="text-[10px]">{getInitials(member.name)}</AvatarFallback>
              </Avatar>
              <span className="truncate font-medium">{member.name}</span>
            </button>
          ))
        )}
      </div>

      {editorError ? (
        <p className="border-t border-border px-3 py-2 text-xs text-destructive">{editorError}</p>
      ) : null}
    </div>
  );
}

function MediaSlide({
  item,
  tags,
  taggedMembers,
  editorEnabled,
  onImageClick,
  pendingPoint,
  familyMembers,
  onTagCreate,
  onTagDelete,
  onPickerDismiss,
  onEditorClose,
  activeMutationPending,
  editorError,
  highlightedTagId,
}: {
  item: MediaViewerItem;
  tags: MediaTagRecord[];
  taggedMembers: TaggedMember[];
  editorEnabled: boolean;
  onImageClick?: (event: React.MouseEvent<HTMLImageElement>) => void;
  pendingPoint?: { xPercent: number; yPercent: number } | null;
  familyMembers?: { id: string; name: string; avatarUrl: string }[];
  onTagCreate?: (memberId: string) => void;
  onTagDelete?: (tagId: string) => void;
  onPickerDismiss?: () => void;
  onEditorClose?: () => void;
  activeMutationPending?: boolean;
  editorError?: string | null;
  highlightedTagId?: string | null;
}) {
  const [hoveredTagId, setHoveredTagId] = React.useState<string | null>(null);
  const [pinnedTagId, setPinnedTagId] = React.useState<string | null>(null);

  const clearActiveTag = React.useCallback(() => {
    setHoveredTagId(null);
    setPinnedTagId(null);
  }, []);

  const activeTagId = pinnedTagId ?? hoveredTagId;

  React.useEffect(() => {
    if (!pinnedTagId) return;
    if (!tags.some((tag) => tag.id === pinnedTagId)) {
      setPinnedTagId(null);
    }
  }, [tags, pinnedTagId]);

  React.useEffect(() => {
    if (!highlightedTagId) {
      return;
    }

    if (!tags.some((tag) => tag.id === highlightedTagId)) {
      return;
    }

    setPinnedTagId(highlightedTagId);
  }, [highlightedTagId, tags]);

  if (item.type === "video") {
    return (
      <div className="relative flex h-full w-full items-center justify-center">
        <video
          src={item.url}
          controls
          className="max-h-full w-full max-w-full rounded-lg object-contain"
          aria-label={item.alt}
        />

        {!editorEnabled && taggedMembers.length ? <TaggedMembersOverlay members={taggedMembers} /> : null}

        {editorEnabled && familyMembers ? (
          <VideoTagEditorPanel
            tags={tags}
            familyMembers={familyMembers}
            onTagCreate={onTagCreate}
            onTagDelete={onTagDelete}
            onEditorClose={onEditorClose}
            activeMutationPending={activeMutationPending}
            editorError={editorError}
          />
        ) : null}

        {item.caption && !editorEnabled ? (
          <p className="absolute bottom-2 left-2 max-w-[min(92vw,28rem)] rounded-xl border border-black/10 bg-white/75 px-3 py-2 text-sm text-foreground shadow-lg backdrop-blur-sm dark:border-white/10 dark:bg-black/60 dark:text-white">
            {item.caption}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full w-full items-center justify-center"
      onClick={clearActiveTag}
    >
      <div className="relative inline-flex max-h-full max-w-full">
        <Image
          src={item.url}
          alt={item.alt}
          width={1600}
          height={1600}
          unoptimized
          className={`max-h-full max-w-full rounded-lg object-contain ${editorEnabled ? "cursor-crosshair" : ""}`}
          onClick={(e) => {
            clearActiveTag();
            onImageClick?.(e);
          }}
        />

        {/* Existing tag markers */}
        {tags.map((tag) => {
          const style = getTagAnchorStyle(tag);
          if (!style) return null;
          const isActive = activeTagId === tag.id;
          const tagYPct = tag.yPercent ?? 50;
          const tagXPct = tag.xPercent ?? 50;

          return (
            <div
              key={tag.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={style}
            >
              <button
                type="button"
                className={`pointer-events-auto flex size-10 items-center justify-center rounded-full border ${editorEnabled ? "border-white/20 bg-black/20" : "border-white/10 bg-black/10"} text-[10px] font-semibold text-white shadow transition-transform hover:scale-110 active:scale-95 ${highlightedTagId === tag.id ? "ring-2 ring-primary ring-offset-2 ring-offset-black/60" : ""}`}
                onMouseEnter={() => setHoveredTagId(tag.id)}
                onMouseLeave={() => setHoveredTagId(null)}
                onClick={(event) => {
                  event.stopPropagation();
                  setPinnedTagId((currentPinnedTagId) =>
                    currentPinnedTagId === tag.id ? null : tag.id,
                  );
                }}
                title={tag.taggedMember.name}
              >
                •
              </button>

              {isActive && (
                <div
                  className={`absolute z-10 ${tagYPct > 50 ? "bottom-full mb-2" : "top-full mt-2"} ${tagXPct > 65 ? "right-0" : tagXPct < 35 ? "left-0" : "left-1/2 -translate-x-1/2"}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2 whitespace-nowrap rounded-xl border border-border/60 bg-card px-3 py-1 shadow-lg backdrop-blur-sm">
                    {tag.taggedMember.slug ? (
                      <Link
                        href={`/member/${tag.taggedMember.slug}`}
                        className="text-sm font-medium transition-colors hover:underline"
                      >
                        {tag.taggedMember.name}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium">{tag.taggedMember.name}</span>
                    )}
                    {editorEnabled && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-xs -mr-2 text-destructive transition-colors hover:text-destructive/80 disabled:opacity-50"
                        onClick={(event) => {
                          event.stopPropagation();
                          void onTagDelete?.(tag.id);
                          clearActiveTag();
                        }}
                        disabled={activeMutationPending}
                      >
                        <X />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Pending point marker + member picker */}
        {editorEnabled && pendingPoint ? (
          <div
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pendingPoint.xPercent}%`, top: `${pendingPoint.yPercent}%` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="size-10 rounded border-2 border-white shadow-lg" />
            {familyMembers ? (
              <MemberPickerPopover
                pendingPoint={pendingPoint}
                members={familyMembers}
                onSelect={(memberId) => onTagCreate?.(memberId)}
                onDismiss={() => onPickerDismiss?.()}
                isPending={activeMutationPending ?? false}
                error={editorError ?? null}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {!editorEnabled && taggedMembers.length ? <TaggedMembersOverlay members={taggedMembers} /> : null}

      {item.caption && !editorEnabled ? (
        <p className="absolute bottom-2 left-2 max-w-[min(92vw,28rem)] rounded-xl border border-black/10 bg-white/75 px-3 py-2 text-sm text-foreground shadow-lg backdrop-blur-sm dark:border-white/10 dark:bg-black/60 dark:text-white">
          {item.caption}
        </p>
      ) : null}

      {editorEnabled ? (
        <div className="absolute bottom-0 left-1/2 space-y-3 -translate-x-1/2 bg-linear-to-b from-background/0 via-background/60 to-background w-full text-center pt-10 pb-6 px-2">
          <p className="text-sm">Click on the photo to start tagging. Click on a tag to remove it.</p>
          <Button
            variant="default"
            onClick={onEditorClose}
            className="rounded-full px-6 shadow-xl w-full md:w-1/3"
          >
            Done Tagging
          </Button>
        </div>
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
        {members.map((member) => {
          const href = member.slug ? `/member/${member.slug}` : undefined;
          const content = (
            <>
              <Avatar className="size-5">
                <AvatarImage src={member.avatarUrl} alt={member.name} />
                <AvatarFallback className="text-[10px] font-semibold text-foreground dark:text-white">
                  {getInitials(member.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium">{member.name}</span>
            </>
          );

          if (href) {
            return (
              <Link
                key={member.name}
                href={href}
                className="inline-flex items-center gap-2 rounded-full bg-black/10 dark:bg-white/10 text-foreground dark:text-white px-2.5 py-1 transition-colors hover:bg-black/20 dark:hover:bg-white/20"
                title={member.name}
              >
                {content}
              </Link>
            );
          }

          return (
            <div
              key={member.name}
              className="inline-flex items-center gap-2 rounded-full bg-black/10 dark:bg-white/10 text-foreground dark:text-white px-2.5 py-1"
              title={member.name}
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MediaViewerDialog({
  items,
  startIndex = 0,
  highlightedTagId,
  open,
  onOpenChange,
  familyId,
  canManageTags = false,
}: MediaViewerDialogProps) {
  const [current, setCurrent] = React.useState(startIndex);
  const [carouselApi, setCarouselApi] = React.useState<CarouselApi>();
  const [editorOpen, setEditorOpen] = React.useState(false);
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
  const createVideoTagMutation = api.tag.createVideoTag.useMutation();
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
          slug: tag.taggedMember.slug,
        });
      }
      return Array.from(byMemberId.values());
    }
    return currentItem?.taggedMembers ?? [];
  }, [currentItem?.taggedMembers, currentTags]);

  const activeMutationPending =
    createPhotoTagMutation.isPending ||
    createVideoTagMutation.isPending ||
    deleteTagMutation.isPending;

  const editorError =
    createPhotoTagMutation.error?.message ??
    createVideoTagMutation.error?.message ??
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

  async function handleDeleteTag(tagId: string) {
    if (!familyId) return;
    await deleteTagMutation.mutateAsync({
      familyId,
      tagId,
    });
    await refetchCurrentTags();
  }

  async function handleCreatePhotoTag(memberId: string) {
    if (!familyId || !currentItem || !pendingPoint) return;
    await createPhotoTagMutation.mutateAsync({
      familyId,
      postMediaId: currentItem.id,
      taggedMemberId: memberId,
      xPercent: pendingPoint.xPercent,
      yPercent: pendingPoint.yPercent,
    });
    setPendingPoint(null);
    await refetchCurrentTags();
  }

  async function handleCreateVideoTag(memberId: string) {
    if (!familyId || !currentItem) return;
    await createVideoTagMutation.mutateAsync({
      familyId,
      postMediaId: currentItem.id,
      taggedMemberId: memberId,
    });
    await refetchCurrentTags();
  }

  async function handleCreateTag(memberId: string) {
    if (!currentItem) return;
    if (currentItem.type === "image") {
      await handleCreatePhotoTag(memberId);
    } else {
      await handleCreateVideoTag(memberId);
    }
  }

  function handleImageClick(event: React.MouseEvent<HTMLImageElement>) {
    if (!editorOpen || currentItem?.type !== "image") {
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

  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setEditorOpen(false);
      setPendingPoint(null);
    }
    onOpenChange(nextOpen);
  }

  // Sync current slide index when the dialog opens or startIndex changes
  React.useEffect(() => {
    if (open) {
      setCurrent(startIndex);
      carouselApi?.scrollTo(startIndex, true);
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
    setPendingPoint(null);
  }, [current, open]);

  const isSingle = items.length === 1;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleDialogOpenChange}>
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
          <div className="absolute w-full flex shrink-0 items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              {!isSingle ? (
                <span className="text-sm font-medium dark:text-white/60 text-muted-foreground">
                  {current + 1} / {items.length}
                </span>
              ) : null}
              {familyId && currentItem && canManageTags ? (
                <Button
                  className="flex size-10 items-center justify-center rounded-full dark:bg-white/10 dark:text-white dark:hover:bg-white/20 bg-black/10 text-foreground hover:bg-black/20 transition-colors active:translate-y-0 active:scale-100"
                  aria-label={editorOpen ? "Done tagging" : "Tag people"}
                  title={editorOpen ? "Done tagging" : "Tag people"}
                  onClick={() => setEditorOpen((value) => !value)}
                >
                  <Tag className="size-5" />
                  <span className="sr-only">
                    {editorOpen ? "Done tagging" : "Tag people"}
                  </span>
                </Button>
              ) : null}
            </div>

            <DialogPrimitive.Close className="flex size-10 items-center justify-center rounded-full dark:bg-white/10 dark:text-white dark:hover:bg-white/20 bg-black/10 text-foreground hover:bg-black/20 transition-colors active:translate-y-0 active:scale-100">
              <X className="size-5" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

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
                    editorEnabled={editorOpen && currentItem?.id === items[0]!.id}
                    pendingPoint={currentItem?.id === items[0]!.id ? pendingPoint : null}
                    familyMembers={(familyMembersQuery.data ?? []).map((m) => ({ id: m.id, name: m.name, avatarUrl: m.image ?? "" }))}
                    onTagCreate={(memberId) => void handleCreateTag(memberId)}
                    onTagDelete={(tagId) => void handleDeleteTag(tagId)}
                    onPickerDismiss={() => setPendingPoint(null)}
                    onEditorClose={() => { setEditorOpen(false); setPendingPoint(null); }}
                    activeMutationPending={activeMutationPending}
                    editorError={editorError}
                    highlightedTagId={highlightedTagId}
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
                          editorEnabled={editorOpen && current === index}
                          pendingPoint={current === index ? pendingPoint : null}
                          familyMembers={(familyMembersQuery.data ?? []).map((m) => ({ id: m.id, name: m.name, avatarUrl: m.image ?? "" }))}
                          onTagCreate={(memberId) => void handleCreateTag(memberId)}
                          onTagDelete={(tagId) => void handleDeleteTag(tagId)}
                          onPickerDismiss={() => setPendingPoint(null)}
                          onEditorClose={() => { setEditorOpen(false); setPendingPoint(null); }}
                          activeMutationPending={activeMutationPending}
                          editorError={editorError}
                          highlightedTagId={current === index ? highlightedTagId : null}
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
