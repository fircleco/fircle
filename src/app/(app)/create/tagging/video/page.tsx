"use client";

import Link from "next/link";
import { ArrowLeft, Film, ListVideo, Sparkles } from "lucide-react";
import { useState } from "react";

import { VideoTagMomentCard } from "~/components/tagging/video-tag-moment-card";
import { VideoTagTimeline } from "~/components/tagging/video-tag-timeline";
import { Button } from "~/components/ui/button";
import { videoTaggingExamples } from "~/lib/mocks/tagging";

function parseDurationToSeconds(durationLabel: string) {
  const [minutesPart, secondsPart] = durationLabel.split(":");
  const minutes = Number(minutesPart ?? 0);
  const seconds = Number(secondsPart ?? 0);

  return minutes * 60 + seconds;
}

export default function VideoTaggingPage() {
  const primaryExample = videoTaggingExamples[0];
  const secondaryExample = videoTaggingExamples[1];

  const [view, setView] = useState<"timeline" | "group" | "empty">("timeline");
  const [selectedMomentId, setSelectedMomentId] = useState(primaryExample?.moments[0]?.id ?? null);

  if (!primaryExample || !secondaryExample) {
    return null;
  }

  const currentExample = view === "group" ? secondaryExample : primaryExample;
  const selectedMoment = currentExample.moments.find((moment) => moment.id === selectedMomentId) ?? null;
  const durationSeconds = parseDurationToSeconds(currentExample.durationLabel);

  const handleViewChange = (nextView: "timeline" | "group" | "empty") => {
    setView(nextView);

    if (nextView === "empty") {
      setSelectedMomentId(null);
      return;
    }

    const nextExample = nextView === "group" ? secondaryExample : primaryExample;
    setSelectedMomentId(nextExample.moments[0]?.id ?? null);
  };

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="font-medium text-muted-foreground text-sm">Create / Tagging</p>
          <h1 className="font-semibold text-3xl tracking-tight sm:text-4xl">Tag people in a video</h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            Mark when relatives appear in a clip using timeline points, then review member assignments
            in a dedicated detail panel before saving.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: "timeline", label: "Timeline moments", icon: Sparkles },
            { id: "group", label: "Group moments", icon: ListVideo },
            { id: "empty", label: "Empty state", icon: Film },
          ].map((option) => {
            const Icon = option.icon;

            return (
              <Button
                key={option.id}
                type="button"
                variant={view === option.id ? "default" : "outline"}
                size="sm"
                onClick={() => handleViewChange(option.id as "timeline" | "group" | "empty")}
              >
                <Icon className="size-4" aria-hidden="true" />
                {option.label}
              </Button>
            );
          })}
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(22rem,26rem)]">
        <div className="space-y-4">
          <section className="overflow-hidden rounded-[2rem] border bg-card shadow-sm">
            <div
              className="relative aspect-video bg-cover bg-center"
              style={{
                backgroundImage: `linear-gradient(to bottom, rgba(9, 9, 11, 0.15), rgba(9, 9, 11, 0.6)), url(${currentExample.posterUrl})`,
              }}
            >
              <div className="absolute inset-0 bg-black/5" aria-hidden="true" />

              <div className="absolute left-4 top-4 max-w-xs rounded-2xl border border-white/20 bg-black/35 px-4 py-3 text-white shadow-lg backdrop-blur-sm">
                <p className="font-medium text-sm sm:text-base">{currentExample.title}</p>
                <p className="mt-1 text-xs text-white/80 sm:text-sm">{currentExample.helperText}</p>
              </div>

              <div className="absolute bottom-4 right-4 rounded-full border border-white/25 bg-black/40 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm">
                {currentExample.currentTimeLabel} / {currentExample.durationLabel}
              </div>
            </div>

            <div className="p-5">
              <VideoTagTimeline
                moments={currentExample.moments}
                selectedMomentId={selectedMomentId}
                onSelectMoment={setSelectedMomentId}
                durationSeconds={durationSeconds}
                currentTimeLabel={currentExample.currentTimeLabel}
                durationLabel={currentExample.durationLabel}
                emptyState={view === "empty"}
              />
            </div>
          </section>

          <section className="rounded-3xl border bg-card p-5">
            <h2 className="font-medium text-lg">Moment list</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Timeline-linked cards preview each timestamp and tagged members in one scannable list.
            </p>

            <div className="mt-4 space-y-3">
              {(view === "empty" ? [] : currentExample.moments).length > 0 ? (
                currentExample.moments.map((moment) => <VideoTagMomentCard key={moment.id} moment={moment} />)
              ) : (
                <div className="rounded-3xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  No timeline tags yet. Add a moment marker to start assigning people to this video.
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="rounded-[2rem] border bg-card p-5 shadow-sm">
          <h2 className="font-medium text-lg">Selected timestamp</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Right-side detail panel for the active timeline marker.
          </p>

          {selectedMoment && view !== "empty" ? (
            <div className="mt-4 rounded-3xl border bg-muted/20 p-4">
              <VideoTagMomentCard moment={selectedMoment} />
            </div>
          ) : (
            <div className="mt-4 rounded-3xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              Select a timeline marker to review who appears at that timestamp.
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:justify-end">
            <Button asChild type="button" variant="ghost">
              <Link href="/create">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back to composer
              </Link>
            </Button>
            <Button type="button">Save video tags</Button>
          </div>
        </aside>
      </div>
    </section>
  );
}