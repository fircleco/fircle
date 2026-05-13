"use client";

import Link from "next/link";
import { useState } from "react";

import { PostCard } from "~/components/feed/post-card";
import { EditProfileDialog } from "~/components/members/edit-profile-dialog";
import { MemberProfileHeader } from "~/components/members/member-profile-header";
import { Button } from "~/components/ui/button";
import { FileText, Heart, Tag, UserRoundX } from "~/components/ui/icons";
import { feedPosts } from "~/lib/mocks/feed";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import type { FamilyMemberProfile } from "~/lib/mocks/family-members";

type ProfileTab = "posts" | "tagged" | "liked";

const tabs: { id: ProfileTab; label: string; icon: typeof FileText }[] = [
  { id: "posts", label: "Posts", icon: FileText },
  { id: "tagged", label: "Tagged In", icon: Tag },
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

  // Filter posts by current member name (using mock feed data for now)
  const memberPosts = member ? feedPosts.filter((p) => p.author.name === member.name) : []
  const taggedPosts = member
    ? feedPosts.filter((p) => p.taggedMembers.some((t) => t.name === member.name))
    : []
  // Liked posts: no mock data yet — shows empty state.
  const likedPosts: typeof feedPosts = []

  const isLoading = managementContext.isLoading || memberQuery.isLoading

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center text-muted-foreground">Loading profile...</div>
        </div>
      ) : member ? (
        <div className="space-y-5">
          <MemberProfileHeader member={member} showStatus={false} />
          <div className="flex justify-center">
            <EditProfileDialog member={member} triggerText="Edit my profile" />
          </div>

          <section>
            <div className="flex border-b">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition-colors first:rounded-tl-3xl last:rounded-tr-3xl",
                    activeTab === id
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>

            <div className="pt-4">
              {activeTab === "posts" && (
                <>
                  {memberPosts.length > 0 ? (
                    <div className="space-y-4">
                      {memberPosts.map((post) => (
                        <PostCard key={post.id} post={post} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={FileText}
                      title="No posts yet"
                      description={`${member.name.split(" ")[0]} hasn't posted anything yet.`}
                    />
                  )}
                </>
              )}

              {activeTab === "tagged" && (
                <>
                  {taggedPosts.length > 0 ? (
                    <div className="space-y-4">
                      {taggedPosts.map((post) => (
                        <PostCard key={post.id} post={post} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Tag}
                      title="Not tagged yet"
                      description={`Posts tagging ${member.name.split(" ")[0]} will appear here.`}
                    />
                  )}
                </>
              )}

              {activeTab === "liked" && (
                <>
                  {likedPosts.length > 0 ? (
                    <div className="space-y-4">
                      {likedPosts.map((post) => (
                        <PostCard key={post.id} post={post} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Heart}
                      title="No liked posts"
                      description={`Posts ${member.name.split(" ")[0]} likes will show up here.`}
                    />
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed p-8 text-center">
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
  icon: typeof FileText;
  title: string;
  description: string;
}) {
  return (
    <div className="px-2 py-8 text-center">
      <div className="mx-auto grid size-10 place-items-center rounded-full text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <p className="mt-3 font-medium text-sm">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
