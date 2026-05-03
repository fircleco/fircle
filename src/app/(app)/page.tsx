"use client";

import { ImageOff } from "lucide-react";
import { useEffect, useState } from "react";

import { ComposerEntry } from "~/components/feed/composer-entry";
import { PostCard } from "~/components/feed/post-card";
import type { PostCardData } from "~/components/feed/post-card";
import { PostComposerDialog } from "~/components/feed/post-composer-dialog";
import { Button } from "~/components/ui/button";
import { feedPosts } from "~/lib/mocks/feed";

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

function FeedList({ posts }: { posts: PostCardData[] }) {
  return (
    <ul className="space-y-3 pb-20 md:pb-8">
      {posts.map((post) => (
        <li key={post.id}>
          <PostCard post={post} />
        </li>
      ))}
    </ul>
  );
}

function FeedSkeletonList() {
  return (
    <ul className="space-y-3 pb-20 md:pb-8" aria-hidden>
      {Array.from({ length: 3 }).map((_, index) => (
        <li key={`skeleton-${index}`}>
          <article className="animate-pulse rounded-3xl border border-border/80 bg-card/90 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-muted" />
              <div className="space-y-2">
                <div className="h-3.5 w-28 rounded-full bg-muted" />
                <div className="h-3 w-16 rounded-full bg-muted" />
              </div>
            </div>
            <div className="mt-4 h-3.5 w-11/12 rounded-full bg-muted" />
            <div className="mt-2 h-3.5 w-9/12 rounded-full bg-muted" />
            <div className="mt-4 aspect-video rounded-2xl bg-muted/80" />
            <div className="mt-4 h-3.5 w-36 rounded-full bg-muted" />
          </article>
        </li>
      ))}
    </ul>
  );
}

export default function FeedPage() {
  const posts = feedPosts as unknown as PostCardData[];
  const [composerOpen, setComposerOpen] = useState(false);
  const [showSkeletons, setShowSkeletons] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setShowSkeletons(false);
    }, 700);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <>
      <section className="px-4 pb-6 pt-5 sm:px-6 md:px-8">
        <div className="mx-auto w-full max-w-2xl space-y-4">
          <header className="space-y-1.5">
            <h1 className="font-semibold text-2xl tracking-tight">Family Feed</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Recent memories from your family circle.
            </p>
          </header>

          <div className="supports-backdrop-filter:bg-background/80 sticky top-0 z-20 -mx-1 rounded-3xl bg-background/95 px-1 pb-2 pt-1 backdrop-blur">
            <ComposerEntry onOpenComposer={() => setComposerOpen(true)} />
          </div>

          {showSkeletons ? (
            <FeedSkeletonList />
          ) : posts.length > 0 ? (
            <FeedList posts={posts} />
          ) : (
            <FeedEmptyState />
          )}
        </div>
      </section>

      <PostComposerDialog open={composerOpen} onOpenChange={setComposerOpen} />
    </>
  );
}