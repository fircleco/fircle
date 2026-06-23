"use client";

import Link from "next/link";
import { ImageOff } from "~/components/ui/icons";
import { useMemo } from "react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { ComposerEntry } from "~/components/feed/composer-entry";
import { PostCard } from "~/components/feed/post-card";
import type { PostCardData } from "~/components/feed/post-card";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";

function formatCreatedAtLabel(dateInput: Date | string) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

function mapFeedItemToPostCardData(item: {
  id: string;
  type: "TEXT" | "PHOTO" | "VIDEO" | "MIXED";
  author: { name: string; slug: string; avatarUrl: string };
  createdAt: Date | string;
  caption: string | null;
  mentions?: Array<{
    id: string;
    start: number;
    end: number;
    member: {
      id: string;
      name: string;
      slug: string;
      avatarUrl: string;
    };
  }>;
  likedByCurrentUser?: boolean;
  reactionCount?: number;
  commentCount?: number;
  taggedMembers?: Array<{ name: string; avatarUrl: string }>;
  mediaItems: Array<{
    id: string;
    type: string;
    url: string;
    alt: string;
    durationLabel?: string;
    caption?: string | null;
    taggedMembers?: Array<{ name: string; avatarUrl: string }>;
    tags?: Array<{
      id: string;
      postMediaId: string;
      taggedMemberId: string;
      xPercent: number | null;
      yPercent: number | null;
      taggedMember: {
        id: string;
        name: string;
        avatarUrl: string;
      };
    }>;
  }>;
}): PostCardData {
  return {
    id: item.id,
    type: item.type.toLowerCase() as PostCardData["type"],
    author: {
      name: item.author.name,
      slug: item.author.slug,
      avatarUrl: item.author.avatarUrl,
    },
    createdAtLabel: formatCreatedAtLabel(item.createdAt),
    body: item.caption ?? "",
    mentions: item.mentions ?? [],
    mediaItems: item.mediaItems.map((media) => ({
      id: media.id,
      type: media.type === "video" ? "video" : "image",
      url: media.url,
      alt: media.alt,
      caption: media.caption ?? undefined,
      durationLabel: media.durationLabel,
      taggedMembers: media.taggedMembers,
      tags: media.tags,
    })),
    taggedMembers: item.taggedMembers ?? [],
    likedByCurrentUser: item.likedByCurrentUser ?? false,
    reactionCount: item.reactionCount ?? 0,
    commentCount: item.commentCount ?? 0,
  };
}

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

function FeedList({
  posts,
  currentMemberSlug,
  familyId,
  isAdmin,
}: {
  posts: PostCardData[];
  currentMemberSlug?: string;
  familyId?: string;
  isAdmin?: boolean;
}) {
  return (
    <ul className="space-y-3 pb-20 md:pb-8">
      {posts.map((post) => (
        <li key={post.id}>
          <PostCard
            post={post}
            currentMemberSlug={currentMemberSlug}
            familyId={familyId}
            isAdmin={isAdmin}
          />
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
          <article className="rounded-3xl border border-border/80 bg-card/90 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-28 rounded-full" />
                <Skeleton className="h-3 w-16 rounded-full" />
              </div>
            </div>
            <Skeleton className="mt-4 h-3.5 w-11/12 rounded-full" />
            <Skeleton className="mt-2 h-3.5 w-9/12 rounded-full" />
            <Skeleton className="mt-4 aspect-video rounded-2xl" />
            <Skeleton className="mt-4 h-3.5 w-36 rounded-full" />
          </article>
        </li>
      ))}
    </ul>
  );
}

export default function FeedPage() {
  const managementContext = api.invite.getManagementContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const bootstrapStatus = api.setup.getBootstrapStatus.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const familyId = managementContext.data?.family?.id;
  const isOwner = managementContext.data?.role === "OWNER";
  const isAdmin = managementContext.data?.role === "OWNER" || managementContext.data?.role === "ADMIN";

  const storageCredentialQuery = api.integration.getIntegrationCredential.useQuery(
    {
      familyId: familyId ?? "",
      category: "storage",
    },
    {
      enabled: Boolean(familyId) && isOwner,
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const memberQuery = api.familyMember.getCurrentUserMemberProfile.useQuery(
    { familyId: familyId ?? "" },
    { enabled: Boolean(familyId), retry: false, refetchOnWindowFocus: false },
  );

  const currentUser = memberQuery.data
    ? {
        name: memberQuery.data.name,
        avatarUrl: memberQuery.data.image ?? undefined,
      }
    : undefined;

  const feedQuery = api.post.getFeed.useQuery(
    {
      familyId: familyId ?? "",
      limit: 20,
    },
    {
      enabled: Boolean(familyId),
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const posts = useMemo(() => {
    const items = feedQuery.data?.items ?? [];
    return items.map(mapFeedItemToPostCardData);
  }, [feedQuery.data?.items]);

  const shouldShowStorageConfigNotice =
    isOwner &&
    bootstrapStatus.data?.selfHosted === false &&
    !storageCredentialQuery.isLoading &&
    !storageCredentialQuery.error &&
    !storageCredentialQuery.data?.isEnabled;

  const isLoading = managementContext.isLoading || (Boolean(familyId) && feedQuery.isLoading);
  const hasNoFamily = !managementContext.isLoading && !familyId;

  return (
    <>
      <section className="px-4 pb-6 pt-5 sm:px-6 md:px-8">
        <div className="mx-auto w-full max-w-2xl space-y-4">
          <header className="space-y-1 mx-auto w-full max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight">Feed</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Recent memories from your family circle.
            </p>
          </header>

          <div className="supports-backdrop-filter:bg-background/80 sticky top-0 z-20 -mx-1 hidden rounded-3xl bg-background/95 px-1 pb-2 pt-1 backdrop-blur md:block">
            <ComposerEntry user={currentUser} familyId={familyId} />
          </div>

          {shouldShowStorageConfigNotice ? (
            <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100">
              <AlertTitle>Storage setup required for media uploads</AlertTitle>
              <AlertDescription className="mt-1">
                This cloud instance has no storage integration configured yet. Photos and videos
                require storage credentials before uploads can work.
              </AlertDescription>
              <div className="mt-3">
                <Button asChild size="sm" variant="outline" className="border-amber-500/40 bg-transparent">
                  <Link href="/settings/integrations">Configure storage integration</Link>
                </Button>
              </div>
            </Alert>
          ) : null}

          {hasNoFamily ? (
            <section className="rounded-3xl border border-dashed border-border/80 bg-card/70 px-6 py-10 text-center">
              <h2 className="font-semibold text-lg tracking-tight">No family membership found</h2>
              <p className="mx-auto mt-2 max-w-sm text-muted-foreground text-sm sm:text-base">
                Join a family to start posting memories.
              </p>
            </section>
          ) : isLoading ? (
            <FeedSkeletonList />
          ) : feedQuery.error ? (
            <section className="rounded-3xl border border-border/80 bg-card/70 px-6 py-10 text-center">
              <h2 className="font-semibold text-lg tracking-tight">Unable to load feed</h2>
              <p className="mx-auto mt-2 max-w-sm text-muted-foreground text-sm sm:text-base">
                {feedQuery.error.message}
              </p>
              <Button type="button" className="mt-5" size="lg" onClick={() => feedQuery.refetch()}>
                Retry
              </Button>
            </section>
          ) : posts.length > 0 ? (
            <FeedList
              posts={posts}
              currentMemberSlug={memberQuery.data?.slug}
              familyId={familyId}
              isAdmin={isAdmin}
            />
          ) : (
            <FeedEmptyState />
          )}
        </div>
      </section>
    </>
  );
}
