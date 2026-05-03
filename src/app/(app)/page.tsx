import { ImageOff } from "lucide-react";

import { ComposerEntry } from "~/components/feed/composer-entry";
import { Button } from "~/components/ui/button";
import { feedPosts } from "~/lib/mocks/feed";

type FeedPostPreview = {
  id: string;
  type: "text" | "photo" | "video" | "mixed";
  author: {
    name: string;
  };
  createdAtLabel: string;
  body: string;
  mediaItems: Array<unknown>;
  taggedMembers: string[];
  reactionCount: number;
  commentCount: number;
};

function FeedEmptyState() {
  return (
    <section className="rounded-3xl border border-dashed border-border/80 bg-card/70 px-6 py-10 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-border bg-muted">
        <ImageOff className="size-5 text-muted-foreground" />
      </div>
      <h2 className="mt-4 font-semibold text-lg tracking-tight">No memories yet</h2>
      <p className="mx-auto mt-2 max-w-sm text-muted-foreground text-sm sm:text-base">
        Start your family timeline by creating the first memory post.
      </p>
      <Button type="button" className="mt-5" size="lg">
        Create first memory
      </Button>
    </section>
  );
}

function FeedList({ posts }: { posts: FeedPostPreview[] }) {
  return (
    <ul className="space-y-3 pb-20 md:pb-8">
      {posts.map((post) => (
        <li key={post.id}>
          <article className="rounded-3xl border border-border/80 bg-card/90 p-4 shadow-sm sm:p-5">
            <header className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-sm text-foreground">{post.author.name}</p>
                <p className="text-muted-foreground text-xs">{post.createdAtLabel}</p>
              </div>
              <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                {post.type}
              </span>
            </header>

            <p className="mt-3 text-foreground text-sm leading-6 sm:text-base">{post.body}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
              <span>{post.mediaItems.length} media item(s)</span>
              <span aria-hidden>•</span>
              <span>{post.reactionCount} reactions</span>
              <span aria-hidden>•</span>
              <span>{post.commentCount} comments</span>
            </div>

            {post.taggedMembers.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {post.taggedMembers.map((member) => (
                  <span
                    key={`${post.id}-${member}`}
                    className="rounded-full border border-border/80 bg-muted px-2.5 py-1 text-[11px] text-muted-foreground"
                  >
                    {member}
                  </span>
                ))}
              </div>
            ) : null}
          </article>
        </li>
      ))}
    </ul>
  );
}

export default function FeedPage() {
  const posts = feedPosts as unknown as FeedPostPreview[];

  return (
    <section className="px-4 pb-6 pt-5 sm:px-6 md:px-8">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <header className="space-y-1.5">
          <h1 className="font-semibold text-2xl tracking-tight">Family Feed</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Recent memories from your family circle.
          </p>
        </header>

        <div className="supports-backdrop-filter:bg-background/80 sticky top-0 z-20 -mx-1 rounded-3xl bg-background/95 px-1 pb-2 pt-1 backdrop-blur">
          <ComposerEntry />
        </div>

        {posts.length > 0 ? <FeedList posts={posts} /> : <FeedEmptyState />}
      </div>
    </section>
  );
}