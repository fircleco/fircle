import { Crosshair, Tag } from "lucide-react";

import { cn } from "~/lib/utils";
import type { PhotoTaggingExample } from "~/lib/mocks/tagging";

type PhotoTagEditorProps = {
  example: PhotoTaggingExample;
  selectedAnchorId?: string | null;
  onSelectAnchor?: (anchorId: string) => void;
  maxVisibleAnchors?: number;
  emptyState?: boolean;
};

export function PhotoTagEditor({
  example,
  selectedAnchorId,
  onSelectAnchor,
  maxVisibleAnchors,
  emptyState = false,
}: PhotoTagEditorProps) {
  const anchors = emptyState ? [] : example.anchors;
  const visibleAnchors = typeof maxVisibleAnchors === "number" ? anchors.slice(0, maxVisibleAnchors) : anchors;
  const overflowCount = Math.max(anchors.length - visibleAnchors.length, 0);

  return (
    <div className="overflow-hidden rounded-[2rem] border bg-card shadow-sm">
      <div
        className="relative aspect-[4/3] overflow-hidden bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(9, 9, 11, 0.12), rgba(9, 9, 11, 0.55)), url(${example.imageUrl})`,
        }}
      >
        <div className="absolute inset-0 bg-black/5" aria-hidden="true" />

        <div className="absolute left-4 top-4 max-w-xs rounded-2xl border border-white/20 bg-black/35 px-4 py-3 text-white shadow-lg backdrop-blur-sm">
          <p className="font-medium text-sm sm:text-base">{example.title}</p>
          <p className="mt-1 text-xs text-white/80 sm:text-sm">{example.helperText}</p>
        </div>

        {anchors.length === 0 ? (
          <div className="absolute inset-0 grid place-items-center px-6 text-center text-white">
            <div className="max-w-sm rounded-[1.75rem] border border-dashed border-white/35 bg-black/25 px-6 py-8 backdrop-blur-sm">
              <div className="mx-auto grid size-12 place-items-center rounded-full border border-white/30 bg-white/10">
                <Crosshair className="size-5" aria-hidden="true" />
              </div>
              <p className="mt-4 font-medium text-base">No tags yet</p>
              <p className="mt-2 text-sm text-white/80">
                Tap anywhere on the image to place a tag and connect this memory to a family member.
              </p>
            </div>
          </div>
        ) : null}

        {visibleAnchors.map((anchor) => {
          const isSelected = anchor.id === selectedAnchorId;

          return (
            <button
              key={anchor.id}
              type="button"
              onClick={() => onSelectAnchor?.(anchor.id)}
              className="absolute -translate-x-1/2 -translate-y-1/2 outline-none"
              style={{ left: `${anchor.xPercent}%`, top: `${anchor.yPercent}%` }}
              aria-pressed={isSelected}
              aria-label={`Select tag for ${anchor.person.name}`}
            >
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-full border border-white/30 bg-white/20 text-white shadow-lg backdrop-blur-sm transition hover:scale-105",
                  isSelected && "scale-105 border-primary/70 bg-primary text-primary-foreground",
                )}
              >
                <Tag className="size-4" aria-hidden="true" />
              </span>
            </button>
          );
        })}

        {overflowCount > 0 ? (
          <div className="absolute bottom-4 right-4 rounded-full border border-white/25 bg-black/40 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm">
            +{overflowCount} more tags hidden in crowded view
          </div>
        ) : null}
      </div>
    </div>
  );
}