"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ArrowLeft, Heart } from "~/components/ui/icons";
import { Button } from "~/components/ui/button";
import { PostCard } from "~/components/feed/post-card";
import type { PostCardData } from "~/components/feed/post-card";
import { feedPosts, postComments } from "~/lib/mocks/feed";
import type { PostComment } from "~/lib/mocks/feed";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function CommentCard({ comment }: { comment: PostComment }) {
  return (
    <article className="flex gap-3">
      {/* Avatar */}
      <div className="shrink-0">
        {comment.author.avatarUrl ? (
          <img
            src={comment.author.avatarUrl}
            alt={comment.author.name}
            className="size-8 rounded-full object-cover border border-border"
          />
        ) : (
          <div className="flex size-8 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-foreground">
            {getInitials(comment.author.name)}
          </div>
        )}
      </div>

      {/* Bubble */}
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl rounded-tl-sm border border-border/80 bg-card/90 px-4 py-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground leading-none">
              {comment.author.name}
            </p>
            <span className="shrink-0 text-xs text-muted-foreground">{comment.createdAtLabel}</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{comment.body}</p>
        </div>
        <div className="mt-1.5 flex items-center gap-3 pl-1">
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Heart className="size-3" />
            {comment.reactionCount > 0 && (
              <span className="tabular-nums">{comment.reactionCount}</span>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

function CommentInput() {
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasText = value.trim().length > 0;
  const isExpanded = isFocused || hasText;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (!hasText) {
      textarea.style.height = "";
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [hasText, value]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValue("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/90 p-4"
    >
      {/* Current user avatar placeholder */}
      <div className="mb-auto mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-foreground">
        ME
      </div>
      <div className="flex-1">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Post your reply"
          className="min-h-6 w-full resize-none bg-transparent py-1 text-foreground leading-5 placeholder:text-muted-foreground outline-none"
        />

        {isExpanded ? (
          <div className="mt-2 flex justify-end">
            <Button
              type="submit"
              size="sm"
              className="h-9 rounded-full px-4 font-semibold disabled:opacity-100"
              disabled={!hasText}
            >
              Reply
            </Button>
          </div>
        ) : null}
      </div>

      {!isExpanded ? (
        <Button
          type="submit"
          size="sm"
          className="h-9 shrink-0 rounded-full px-4 font-semibold disabled:opacity-100"
          disabled={!hasText}
        >
          Reply
        </Button>
      ) : null}
    </form>
  );
}

export default function SinglePostPage() {
  const router = useRouter();
  const params = useParams<{ postId: string }>();

  const post = feedPosts.find((p) => p.id === params.postId) as PostCardData | undefined;
  const comments = postComments[params.postId] ?? [];

  if (!post) {
    return (
      <section className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-6 -ml-1 rounded-2xl"
          onClick={() => router.back()}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div className="rounded-3xl border border-dashed border-border/80 bg-card/70 px-6 py-12 text-center">
          <p className="font-semibold text-lg">Post not found</p>
          <p className="mt-1 text-muted-foreground text-sm">
            This post may have been removed or the link is incorrect.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      {/* Back */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mb-6 -ml-1 rounded-2xl"
        onClick={() => router.back()}
      >
        <ArrowLeft className="size-4" />
        Back
      </Button>

      {/* Post */}
      <PostCard post={post} />
      
      {/* Comment input */}
      <div className="mt-6">
        <CommentInput />
      </div>

      {/* Comments */}
      <section className="mt-5" aria-label="Comments">
        <h2 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {comments.length} {comments.length === 1 ? "Comment" : "Comments"}
        </h2>

        {comments.length > 0 ? (
          <ul className="space-y-5">
            {comments.map((comment) => (
              <li key={comment.id}>
                <CommentCard comment={comment} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/80 bg-card/60 px-6 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No comments yet. Be the first to say something!
            </p>
          </div>
        )}
      </section>
    </section>
  );
}
