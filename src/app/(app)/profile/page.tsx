"use client";

import Link from "next/link";
import { useState } from "react";

import { PostCard } from "~/components/feed/post-card";
import { MemberGalleryTab } from "~/components/gallery/member-gallery-tab";
import { EditProfileDialog } from "~/components/members/edit-profile-dialog";
import { MemberProfileHeader } from "~/components/members/member-profile-header";
import { Button } from "~/components/ui/button";
import { Dash, Heart, Image, UserSquare, UserRoundX } from "~/components/ui/icons";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import type { FamilyMemberProfile } from "~/lib/mocks/family-members";
import type { PostCardData } from "~/components/feed/post-card";

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

function mapApiPostToPostCardData(item: {
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
    author: { name: item.author.name, slug: item.author.slug, avatarUrl: item.author.avatarUrl },
    createdAtLabel: formatCreatedAtLabel(item.createdAt),
    body: item.caption ?? "",
    mentions: item.mentions ?? [],
    mediaItems: item.mediaItems.map((m) => ({
      id: m.id,
      type: m.type === "video" ? "video" : "image",
      url: m.url,
      alt: m.alt,
      caption: m.caption ?? undefined,
      durationLabel: m.durationLabel,
      taggedMembers: m.taggedMembers,
      tags: m.tags,
    })),
    taggedMembers: item.taggedMembers ?? [],
    likedByCurrentUser: item.likedByCurrentUser,
    reactionCount: item.reactionCount ?? 0,
    commentCount: item.commentCount ?? 0,
  };
}

type ProfileTab = "posts" | "tagged" | "liked" | "gallery";

const tabs: { id: ProfileTab; label: string; icon: typeof Dash }[] = [
  { id: "posts", label: "Posts", icon: Dash },
  { id: "gallery", label: "Gallery", icon: Image },
  { id: "tagged", label: "Mentions & Tags", icon: UserSquare },
  { id: "liked", label: "Liked", icon: Heart },
];

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");

  // Get the authenticated user's family context
  const managementContext = api.invite.getManagementContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const familyId = managementContext.data?.family?.id

  // Get the current user's member profile in their family
  const memberQuery = api.familyMember.getCurrentUserMemberProfile.useQuery(
    { familyId: familyId ?? "" },
    { enabled: !!familyId }
  )

  // Transform member query data to FamilyMemberProfile type
  const member = memberQuery.data
    ? ({
        id: memberQuery.data.id,
        name: memberQuery.data.name,
        nickname: memberQuery.data.nickname ?? undefined,
        slug: memberQuery.data.slug,
        status: memberQuery.data.status,
        role: memberQuery.data.role.toLowerCase() as "owner" | "admin" | "member",
        avatarUrl: memberQuery.data.image ?? undefined,
        addedByName: "Family organizer",
        addedAtLabel: "Profile in family",
        recentActivity: [],
      } satisfies FamilyMemberProfile)
    : undefined

  const memberPostsQuery = api.post.getPostsByMember.useQuery(
    { familyId: familyId ?? "", memberId: member?.id ?? "", limit: 20 },
    { enabled: Boolean(familyId && member?.id), retry: false, refetchOnWindowFocus: false },
  );

  const likedPostsQuery = api.post.getLikedPostsByMember.useQuery(
    { familyId: familyId ?? "", memberId: member?.id ?? "", limit: 20 },
    { enabled: Boolean(familyId && member?.id), retry: false, refetchOnWindowFocus: false },
  );

  const taggedPostsQuery = api.post.getTaggedPostsByMember.useQuery(
    { familyId: familyId ?? "", memberId: member?.id ?? "", limit: 20 },
    { enabled: Boolean(familyId && member?.id), retry: false, refetchOnWindowFocus: false },
  );

  const memberPosts: PostCardData[] = (memberPostsQuery.data?.items ?? []).map(mapApiPostToPostCardData);
  const taggedPosts: PostCardData[] = (taggedPostsQuery.data?.items ?? []).map(mapApiPostToPostCardData);
  const likedPosts: PostCardData[] = (likedPostsQuery.data?.items ?? []).map(mapApiPostToPostCardData);
  const isAdmin = managementContext.data?.role === "OWNER" || managementContext.data?.role === "ADMIN";
  const isPostsLoading = memberPostsQuery.isLoading || (memberPostsQuery.isFetching && !memberPostsQuery.data);
  const isTaggedLoading = taggedPostsQuery.isLoading || (taggedPostsQuery.isFetching && !taggedPostsQuery.data);
  const isLikedLoading = likedPostsQuery.isLoading || (likedPostsQuery.isFetching && !likedPostsQuery.data);

  const isLoading = managementContext.isLoading || memberQuery.isLoading

  return (
    <section className="px-4 py-8 sm:px-6">
      {isLoading ? (
        <ProfilePageSkeleton />
      ) : member ? (
        <div className="space-y-5">
          <MemberProfileHeader member={member} showStatus={false} />
          <div className="flex justify-center">
            <EditProfileDialog member={member} familyId={familyId} triggerText="Edit my profile" />
          </div>

          <section>
            <div className="flex w-full max-w-2xl mx-auto border-b">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  aria-label={label}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-0 px-2 py-3.5 text-sm font-medium transition-colors first:rounded-tl-3xl last:rounded-tr-3xl sm:gap-2 sm:px-4",
                    activeTab === id
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-5 md:size-4 shrink-0" aria-hidden="true" />
                  <span className="hidden max-w-32 truncate sm:block">{label}</span>
                </button>
              ))}
            </div>

            <div className="pt-4">
              {activeTab === "posts" && (
                <>
                  {isPostsLoading ? (
                    <PostListSkeleton />
                  ) : memberPosts.length > 0 ? (
                    <div className="space-y-4 mx-auto max-w-2xl">
                      {memberPosts.map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          currentMemberSlug={member?.slug}
                          familyId={familyId}
                          isAdmin={isAdmin}
                        />
                      ))}
                    </div>
                  ) : memberPostsQuery.isSuccess ? (
                    <EmptyState
                      icon={Dash}
                      title="No posts yet"
                      description={`${member.name.split(" ")[0]} hasn't posted anything yet.`}
                    />
                  ) : null}
                </>
              )}

              {activeTab === "tagged" && (
                <>
                  {isTaggedLoading ? (
                    <PostListSkeleton />
                  ) : taggedPosts.length > 0 ? (
                    <div className="space-y-4 mx-auto max-w-2xl">
                      {taggedPosts.map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          currentMemberSlug={member?.slug}
                          familyId={familyId}
                          isAdmin={isAdmin}
                        />
                      ))}
                    </div>
                  ) : taggedPostsQuery.isSuccess ? (
                    <EmptyState
                      icon={UserSquare}
                      title="No mentions or tags yet"
                      description={`Posts that mention or tag ${member.name.split(" ")[0]} will appear here.`}
                    />
                  ) : null}
                </>
              )}

              {activeTab === "gallery" && member ? (
                <div className="space-y-4 mx-auto max-w-6xl">
                  <MemberGalleryTab familyId={familyId} memberId={member.id} memberName={member.name} />
                </div>
              ) : null}

              {activeTab === "liked" && (
                <>
                  {isLikedLoading ? (
                    <PostListSkeleton />
                  ) : likedPosts.length > 0 ? (
                    <div className="space-y-4 mx-auto max-w-2xl">
                      {likedPosts.map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          currentMemberSlug={member?.slug}
                          familyId={familyId}
                          isAdmin={isAdmin}
                        />
                      ))}
                    </div>
                  ) : likedPostsQuery.isSuccess ? (
                    <EmptyState
                      icon={Heart}
                      title="No liked posts"
                      description={`Posts ${member.name.split(" ")[0]} likes will show up here.`}
                    />
                  ) : null}
                </>
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto rounded-3xl border border-dashed p-8 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <UserRoundX className="size-5" aria-hidden="true" />
          </div>
          <h1 className="mt-3 font-semibold text-xl tracking-tight">Profile not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We could not find a current user profile to display.
          </p>
          <Button asChild className="mt-4">
            <Link href="/members">Go to members</Link>
          </Button>
        </div>
      )}
    </section>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Dash;
  title: string;
  description: string;
}) {
  return (
    <div className="px-2 py-8 text-center mx-auto max-w-2xl">
      <div className="mx-auto grid size-10 place-items-center rounded-full text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <p className="mt-3 font-medium text-sm">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ProfilePageSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-5" aria-hidden>
      <header className="flex flex-col items-center gap-3 pb-2 pt-6 text-center">
        <Skeleton className="size-24 rounded-full border-2 shadow-sm sm:size-28" />
        <div className="space-y-2">
          <Skeleton className="mx-auto h-8 w-56 rounded-full" />
        </div>
      </header>

      <div className="flex justify-center">
        <Skeleton className="h-9 w-36 rounded-full" />
      </div>

      <section className="space-y-4">
        <div className="mx-auto flex w-full max-w-2xl gap-1 border-b pb-1">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={`profile-tab-skeleton-${index}`} className="h-10 flex-1 rounded-2xl" />
          ))}
        </div>

        <PostListSkeleton />
      </section>
    </div>
  );
}

function PostListSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4" aria-hidden>
      {Array.from({ length: 2 }).map((_, index) => (
        <article
          key={`profile-tab-post-skeleton-${index}`}
          className="rounded-3xl border border-border/80 bg-card/90 p-4 sm:p-5"
        >
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
          <Skeleton className="mt-4 h-3.5 w-32 rounded-full" />
        </article>
      ))}
    </div>
  );
}
