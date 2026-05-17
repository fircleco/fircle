import { ImagePlus, Video } from "~/components/ui/icons";

import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";

export type ComposerOpenMode = "photo" | "video";

type ComposerEntryProps = {
  onOpenComposer?: (mode?: ComposerOpenMode) => void;
};

export function ComposerEntry({ onOpenComposer }: ComposerEntryProps) {
  return (
    <section className="rounded-3xl border border-border/80 bg-card/90 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar className="size-10 shrink-0 border border-border" aria-hidden>
          <AvatarFallback className="text-sm font-semibold text-foreground">Y</AvatarFallback>
        </Avatar>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full justify-start rounded-2xl px-4 text-muted-foreground"
            onClick={() => onOpenComposer?.()}
          >
            Share a memory...
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-2xl"
              onClick={() => onOpenComposer?.("photo")}
            >
              <ImagePlus className="size-4" />
              Photo
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-2xl"
              onClick={() => onOpenComposer?.("video")}
            >
              <Video className="size-4" />
              Video
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
