"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Heart,
  Tag,
  UserRoundX,
  FileText,
} from "~/components/ui/icons";
import { useParams } from "next/navigation";

import { MemberProfileHeader } from "~/components/members/member-profile-header";
import { MemberAdminActionsPanel } from "~/components/members/member-admin-panel";
import { PostCard } from "~/components/feed/post-card";
import { Button } from "~/components/ui/button";
import { getFamilyMemberProfileById } from "~/lib/mocks/family-members";
import { feedPosts } from "~/lib/mocks/feed";
import { cn } from "~/lib/utils";

// In a real app this would come from the auth session / user context.
const MOCK_CURRENT_USER_ROLE = "admin" as "owner" | "admin" | "member";

type ProfileTab = "posts" | "tagged" | "liked";

const tabs: { id: ProfileTab; label: string; icon: typeof FileText }[] = [
  { id: "posts", label: "Posts", icon: FileText },
  { id: "tagged", label: "Tagged In", icon: Tag },
  { id: "liked", label: "Liked", icon: Heart },
];

export default function MemberProfilePage() {
  const params = useParams<{ memberId: string }>();
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");

  const member = getFamilyMemberProfileById(params.memberId);
  const isAdmin = MOCK_CURRENT_USER_ROLE === "owner" || MOCK_CURRENT_USER_ROLE === "admin";

  const memberPosts = member
    ? feedPosts.filter((p) => p.author.name === member.name)
    : [];
  const taggedPosts = member
    ? feedPosts.filter((p) => p.taggedMembers.some((t) => t.name === member.name))
    : [];
  // Liked posts: no mock data yet — shows empty state.
  const likedPosts: typeof feedPosts = [];

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      {member ? (
        <div className="space-y-5">
          {/* ── Top: profile photo + name ── */}
          <MemberProfileHeader member={member} />

          {/* ── Middle: admin-only info ── */}
          {isAdmin && <MemberAdminActionsPanel member={member} />}

          {/* ── Bottom: tabbed posts ── */}
          <section>
            {/* Tab bar */}
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

            {/* Tab panels */}
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
          <h1 className="mt-3 font-semibold text-xl tracking-tight">Member not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No family member exists with id: {params.memberId}
          </p>
          <Button asChild className="mt-4">
            <Link href="/members">Back to members</Link>
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

