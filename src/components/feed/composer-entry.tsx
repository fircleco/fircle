import { ImagePlus, Video } from "lucide-react";

import { Button } from "~/components/ui/button";

type ComposerEntryProps = {
  onOpenComposer?: () => void;
};

export function ComposerEntry({ onOpenComposer }: ComposerEntryProps) {
  return (
    <section className="rounded-3xl border border-border/80 bg-card/90 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold text-foreground"
        >
          Y
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full justify-start rounded-2xl px-4 text-muted-foreground"
            onClick={onOpenComposer}
          >
            Share a memory...
          </Button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" className="rounded-2xl">
              <ImagePlus className="size-4" />
              Photo
            </Button>
            <Button type="button" variant="ghost" size="sm" className="rounded-2xl">
              <Video className="size-4" />
              Video
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
