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

export type MediaViewerItem = {
  id: string;
  type: "image" | "video";
  url: string;
  alt: string;
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
      <video
        src={item.url}
        controls
        className="max-h-full max-w-full rounded-lg"
        aria-label={item.alt}
      />
    );
  }

  return (
    <img
      src={item.url}
      alt={item.alt}
      className="max-h-full max-w-full rounded-lg object-contain"
    />
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
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/92 backdrop-blur-sm" />

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
              <span className="text-sm font-medium text-white/60">
                {current + 1} / {items.length}
              </span>
            ) : null}
            <DialogPrimitive.Close className="ml-auto flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 active:translate-y-0 active:scale-100">
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
                <CarouselPrevious className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white active:translate-y-0 active:scale-100 disabled:opacity-30" />
                <CarouselNext className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white active:translate-y-0 active:scale-100 disabled:opacity-30" />
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
                    i === current ? "bg-white" : "bg-white/25"
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
