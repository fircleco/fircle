import { PlayCircle } from "~/components/ui/icons";

type PostVideoCardProps = {
  title: string;
  durationLabel?: string;
  onClick?: () => void;
};

export function PostVideoCard({ title, durationLabel, onClick }: PostVideoCardProps) {
  return (
    <article
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border border-border/80 bg-muted/50 ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="aspect-video p-1.5 sm:p-3">
        <div className="relative flex h-full items-end justify-between rounded-xl border border-border/70 bg-background p-3">
          <PlayCircle
            className="pointer-events-none absolute left-1/2 top-1/2 size-9 -translate-x-1/2 -translate-y-1/2 text-muted-foreground sm:size-12 fill-accent-foreground"
            aria-hidden="true"
          />

          <p className="max-w-[75%] truncate text-xs text-muted-foreground">{title}</p>

          {durationLabel ? (
            <span className="absolute bottom-2 right-2 rounded-full border border-border bg-background/90 px-2 py-0.5 text-[11px] text-foreground">
              {durationLabel}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
