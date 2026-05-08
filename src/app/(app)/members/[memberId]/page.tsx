"use client";

import Link from "next/link";
import { Clock3, Image as ImageIcon, UserRoundX } from "lucide-react";
import { useParams } from "next/navigation";

import { MemberProfileHeader } from "~/components/members/member-profile-header";
import { TaggedMemoryCard } from "~/components/memories/tagged-memory-card";
import { Button } from "~/components/ui/button";
import { getFamilyMemberProfileById } from "~/lib/mocks/family-members";
import { getTaggedMemoriesByMemberId } from "~/lib/mocks/tagging";

export default function MemberProfilePage() {
  const params = useParams<{ memberId: string }>();
  const member = getFamilyMemberProfileById(params.memberId);
  const isClaimed = member?.status === "claimed";
  const taggedMemories = member ? getTaggedMemoriesByMemberId(member.id) : [];

  return (
    <section className="mx-auto w-full max-w-5xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
      {member ? (
        <>
          <MemberProfileHeader member={member} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <section className="rounded-3xl border bg-card p-5 lg:col-span-2">
              <h2 className="font-medium text-lg">About</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
                {member.bio ?? "No bio added yet."}
              </p>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border bg-muted/30 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Relationship details
                  </p>
                  <p className="mt-1 font-medium">{member.relationship}</p>
                  <p className="text-sm text-muted-foreground">
                    Location: {member.location ?? "Unknown"}
                  </p>
                </div>

                <div className="rounded-2xl border bg-muted/30 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Membership status
                  </p>
                  <p className="mt-1 font-medium">{isClaimed ? "Claimed profile" : "Unclaimed profile"}</p>
                  <p className="text-sm text-muted-foreground">
                    {isClaimed
                      ? "This member can sign in and interact directly."
                      : "This profile can be claimed later by the real family member."}
                  </p>
                </div>
              </div>
            </section>

            <aside className="rounded-3xl border bg-card p-5">
              <h2 className="font-medium text-lg">Profile notes</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {member.note ?? "No pending notes for this member."}
              </p>

              {!isClaimed ? (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  <Clock3 className="size-3.5" aria-hidden="true" />
                  Invite/claim pending
                </p>
              ) : null}
            </aside>
          </div>

          <section className="rounded-3xl border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-medium text-lg">Tagged memories</h2>
              <Button asChild type="button" variant="ghost" size="sm">
                <Link href={`/members/${member.id}/memories`}>View all memories</Link>
              </Button>
            </div>

            {taggedMemories.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {taggedMemories.slice(0, 3).map((memory) => (
                  <TaggedMemoryCard key={memory.id} memory={memory} ctaHref={`/members/${member.id}/memories`} />
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed bg-muted/20 p-4">
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <ImageIcon className="size-4" aria-hidden="true" />
                  No tagged memories yet
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Memories tagged with this member will appear here once available.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-3xl border bg-card p-5">
            <h2 className="font-medium text-lg">Recent family activity</h2>
            <ul className="mt-3 space-y-2">
              {member.recentActivity.map((activity, index) => (
                <li key={`${activity}-${index}`} className="rounded-2xl border bg-muted/20 px-3 py-2 text-sm">
                  {activity}
                </li>
              ))}
            </ul>
          </section>
        </>
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
