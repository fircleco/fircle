import { Button } from "~/components/ui/button";
import { Film, ImageOff } from "~/components/ui/icons";
import { Skeleton } from "~/components/ui/skeleton";
import { formatFamilyDisplayName } from "~/lib/family-name";

export function GalleryLoadingState() {
  return (
    <section className="space-y-4" aria-hidden>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton
            key={`gallery-loading-${index}`}
            className="aspect-4/5 rounded-2xl border border-border/70"
          />
        ))}
      </div>
    </section>
  );
}

export function GalleryEmptyState({ familyName }: { familyName?: string }) {
  return (
    <section className="mx-auto w-full max-w-2xl rounded-3xl border border-dashed border-border/80 bg-card/70 px-6 py-12 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-border bg-muted">
        <ImageOff className="size-5 text-muted-foreground" />
      </div>
      <h2 className="mt-4 font-semibold text-lg tracking-tight">No media yet</h2>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm sm:text-base">
        {familyName
          ? `${formatFamilyDisplayName(familyName)} has not shared any photo or video memories yet.`
          : "Your family has not shared any photo or video memories yet."}
      </p>
      <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
        <Film className="size-4" aria-hidden="true" />
        New uploads from posts will appear here automatically.
      </div>
    </section>
  );
}

export function GalleryErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className="rounded-3xl border border-border/80 bg-card/70 px-6 py-12 text-center">
      <h2 className="font-semibold text-lg tracking-tight">Unable to load gallery</h2>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm sm:text-base">{message}</p>
      <Button type="button" size="lg" className="mt-5" onClick={onRetry}>
        Retry
      </Button>
    </section>
  );
}
