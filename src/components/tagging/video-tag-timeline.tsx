"use client";

import { Clock3 } from "lucide-react";

import type { VideoTagMoment } from "~/lib/mocks/tagging";
import { cn } from "~/lib/utils";

type VideoTagTimelineProps = {
  moments: VideoTagMoment[];
  selectedMomentId?: string | null;
  onSelectMoment?: (momentId: string) => void;
  durationSeconds: number;
  currentTimeLabel: string;
  durationLabel: string;
  emptyState?: boolean;
};

export function VideoTagTimeline({
  moments,
  selectedMomentId,
  onSelectMoment,
  durationSeconds,
  currentTimeLabel,
  durationLabel,
  emptyState = false,
}: VideoTagTimelineProps) {
  const safeDuration = Math.max(durationSeconds, 1);
  const visibleMoments = emptyState ? [] : moments;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground sm:text-sm">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="size-4" aria-hidden="true" />
          Current: {currentTimeLabel}
        </span>
        <span>Duration: {durationLabel}</span>
      </div>

      <div className="rounded-3xl border bg-muted/20 p-4">
        <div className="relative h-14 rounded-2xl border border-dashed bg-background/80">
          <div className="absolute inset-x-3 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted" />

          {visibleMoments.map((moment) => {
            const percent = Math.min((moment.atSeconds / safeDuration) * 100, 100);
            const isSelected = selectedMomentId === moment.id;

            return (
              <button
                key={moment.id}
                type="button"
                onClick={() => onSelectMoment?.(moment.id)}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 outline-none"
                style={{ left: `calc(${percent}% - 0.25rem)` }}
                aria-pressed={isSelected}
                aria-label={`Select timeline marker at ${moment.atLabel}`}
              >
                <span
                  className={cn(
                    "inline-flex h-8 min-w-8 items-center justify-center rounded-full border bg-background px-2 text-[11px] font-medium shadow-sm transition hover:border-primary/40",
                    isSelected && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {moment.atLabel}
                </span>
              </button>
            );
          })}

          {visibleMoments.length === 0 ? (
            <div className="absolute inset-0 grid place-items-center px-4 text-center text-xs text-muted-foreground sm:text-sm">
              No tag markers yet. Add a marker to map people to exact moments in the clip.
            </div>
          ) : null}
        </div>

        <p className="mt-3 text-xs text-muted-foreground sm:text-sm">
          Legend: each marker represents a timestamp where one or more family members appear in the
          video.
        </p>
      </div>
    </div>
  );
}