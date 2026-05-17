import { PlayCircle } from "~/components/ui/icons";

type PostVideoCardProps = {
  title: string;
  caption?: string;
  url: string;
  durationLabel?: string;
  onClick?: () => void;
};

export function PostVideoCard({ title, caption, url, durationLabel, onClick }: PostVideoCardProps) {
  return (
    <article
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border border-border/80 bg-muted/50 ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="relative aspect-video">
        <video
          src={url}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
          aria-label={title}
        />

        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/35 to-transparent p-3 text-white">
          <p className="max-w-[75%] line-clamp-1 text-xs font-medium">{title}</p>
          {caption ? <p className="mt-0.5 line-clamp-2 text-[11px] text-white/80">{caption}</p> : null}
        </div>

        <PlayCircle
          className="pointer-events-none absolute left-1/2 top-1/2 size-9 -translate-x-1/2 -translate-y-1/2 text-white sm:size-12 fill-white/85"
          aria-hidden="true"
        />

        {durationLabel ? (
          <span className="absolute bottom-2 right-2 rounded-full border border-white/30 bg-black/65 px-2 py-0.5 text-[11px] text-white">
            {durationLabel}
          </span>
        ) : null}
      </div>
    </article>
  );
}
