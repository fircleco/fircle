"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { X } from "~/components/ui/icons";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "~/components/ui/carousel";
import type { CarouselApi } from "~/components/ui/carousel";

type TaggedMember = {
  name: string;
  avatarUrl: string;
};

export type MediaViewerItem = {
  id: string;
  type: "image" | "video";
  url: string;
  alt: string;
  taggedMembers?: TaggedMember[];
};

type MediaViewerDialogProps = {
  items: MediaViewerItem[];
  startIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function MediaSlide({ item }: { item: MediaViewerItem }) {
  if (item.type === "video") {
    return (
      <div className="relative flex h-full w-full items-center justify-center">
        <video
          src={item.url}
          controls
          className="max-h-full max-w-full rounded-lg"
          aria-label={item.alt}
        />

        {item.taggedMembers?.length ? <TaggedMembersOverlay members={item.taggedMembers} /> : null}
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <img
        src={item.url}
        alt={item.alt}
        className="max-h-full max-w-full rounded-lg object-contain"
      />

      {item.taggedMembers?.length ? <TaggedMembersOverlay members={item.taggedMembers} /> : null}
    </div>
  );
}

function TaggedMembersOverlay({ members }: { members: TaggedMember[] }) {
  return (
    <div className="absolute bottom-14 left-2 max-w-[min(92vw,28rem)] rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/55 px-3 py-2 text-foreground dark:text-white shadow-xl backdrop-blur-sm">
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
            <img
              src={member.avatarUrl}
              alt={member.name}
              className="size-5 rounded-full object-cover"
            />
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
}: MediaViewerDialogProps) {
  const [current, setCurrent] = React.useState(startIndex);
  const [api, setApi] = React.useState<CarouselApi>();

  // Sync current slide index when the dialog opens or startIndex changes
  React.useEffect(() => {
    if (open) {
      setCurrent(startIndex);
      api?.scrollTo(startIndex, true);
    }
  }, [open, startIndex, api]);

  React.useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => { api.off("select", onSelect); };
  }, [api]);

  const isSingle = items.length <= 1;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 dark:bg-black/92 bg-white/95 backdrop-blur-sm" />

        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col outline-none"
        >
          <DialogPrimitive.Title className="sr-only">
            Media viewer
          </DialogPrimitive.Title>

          {/* Top bar */}
          <div className="flex shrink-0 items-center justify-between px-4 py-3">
            {!isSingle ? (
              <span className="text-sm font-medium dark:text-white/60 text-muted-foreground">
                {current + 1} / {items.length}
              </span>
            ) : null}
            <DialogPrimitive.Close className="ml-auto flex size-10 items-center justify-center rounded-full dark:bg-white/10 dark:text-white dark:hover:bg-white/20 bg-black/10 text-foreground hover:bg-black/20 transition-colors active:translate-y-0 active:scale-100">
              <X className="size-5" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          {/* Media area */}
          <div className="flex flex-1 items-center justify-center overflow-hidden px-2 pb-3 sm:px-4 sm:pb-4">
            {isSingle ? (
              <div className="flex h-[calc(100vh-6rem)] w-full items-center justify-center">
                <MediaSlide item={items[0]!} />
              </div>
            ) : (
              <Carousel
                className="w-full max-w-6xl"
                opts={{ startIndex, loop: false }}
                setApi={setApi}
              >
                <CarouselContent>
                  {items.map((item) => (
                    <CarouselItem key={item.id}>
                      <div className="flex h-[calc(100vh-9rem)] items-center justify-center">
                        <MediaSlide item={item} />
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
