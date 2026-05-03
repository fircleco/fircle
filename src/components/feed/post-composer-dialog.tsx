"use client";

import { ImagePlus, Loader2, Video, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "~/components/ui/button";

type PostComposerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PostComposerDialog({ open, onOpenChange }: PostComposerDialogProps) {
  const [caption, setCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const canPublish = useMemo(() => caption.trim().length > 0, [caption]);

  if (!open) {
    return null;
  }

  const closeDialog = () => {
    if (isUploading) {
      return;
    }

    onOpenChange(false);
  };

  const handlePublish = () => {
    if (!canPublish || isUploading) {
      return;
    }

    setIsUploading(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/55 p-3 sm:items-center sm:justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Create memory"
    >
      <div className="w-full max-w-xl rounded-3xl border border-border/80 bg-card p-4 shadow-2xl sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-xl tracking-tight">Create memory</h2>
            <p className="mt-1 text-muted-foreground text-sm">
              Share a photo, video, or moment with your family.
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={closeDialog}
            aria-label="Close composer"
          >
            <X className="size-4" />
          </Button>
        </header>

        <div className="mt-4 space-y-4">
          <textarea
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Write a caption for this memory..."
            rows={5}
            className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="flex h-24 items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/40 text-sm text-muted-foreground transition hover:bg-muted"
            >
              <ImagePlus className="size-4" />
              Add photos
            </button>

            <button
              type="button"
              className="flex h-24 items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/40 text-sm text-muted-foreground transition hover:bg-muted"
            >
              <Video className="size-4" />
              Add videos
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              Family-only
            </span>

            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="button" onClick={handlePublish} disabled={!canPublish || isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Publish"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
