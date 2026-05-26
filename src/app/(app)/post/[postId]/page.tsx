"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { CommentInput } from "~/components/feed/comment-input";
import { CommentList } from "~/components/feed/comment-list";
import { PostCard } from "~/components/feed/post-card";
import type { PostCardData } from "~/components/feed/post-card";
import { Button } from "~/components/ui/button";
import { ArrowLeft } from "~/components/ui/icons";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import {
  normalizeMentionsForSubmit,
  type MentionDraft,
  type MentionableMember,
} from "~/components/feed/mention-helpers";

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

function formatFullPostTimestamp(dateInput: Date | string) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  const fullDate = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${time} · ${fullDate}`;
}

function mapPostToPostCardData(item: {
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

type LikeOverride = {
  likedByCurrentUser: boolean;
  likeCount: number;
};

type ReplyPaginationState = {
  nextCursor: string | null;
  hasMore: boolean;
  isLoading: boolean;
};

const REPLIES_PAGE_SIZE = 20;

type CommentApiItem = {
  id: string;
  postId: string;
  parentCommentId: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    name: string;
    slug: string;
    avatarUrl: string;
  };
  mentions: Array<{
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
  likedByCurrentUser: boolean;
  likeCount: number;
  replyCount: number;
  replies: CommentApiItem[];
};

function applyLikeOverrides(comments: CommentApiItem[], overrides: Record<string, LikeOverride>): CommentApiItem[] {
  return comments.map((comment) => ({
    ...comment,
    likedByCurrentUser: overrides[comment.id]?.likedByCurrentUser ?? comment.likedByCurrentUser,
    likeCount: overrides[comment.id]?.likeCount ?? comment.likeCount,
    replies: applyLikeOverrides(comment.replies, overrides),
  }));
}

function findCommentById(comments: CommentApiItem[], targetId: string): CommentApiItem | null {
  for (const comment of comments) {
    if (comment.id === targetId) {
      return comment;
    }

    const nested = findCommentById(comment.replies, targetId);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function updateCommentInTree(
  comments: CommentApiItem[],
  targetId: string,
  updater: (comment: CommentApiItem) => CommentApiItem,
): CommentApiItem[] {
  return comments.map((comment) => {
    if (comment.id === targetId) {
      return updater(comment);
    }

    if (comment.replies.length === 0) {
      return comment;
    }

    return {
      ...comment,
      replies: updateCommentInTree(comment.replies, targetId, updater),
    };
  });
}

function encodeCommentCursor(createdAt: Date | string, id: string) {
  const createdAtIso = (createdAt instanceof Date ? createdAt : new Date(createdAt)).toISOString();
  return `${createdAtIso}__${id}`;
}

function mergeReplies(existing: CommentApiItem[], incoming: CommentApiItem[]) {
  const byId = new Map<string, CommentApiItem>();

  for (const reply of existing) {
    byId.set(reply.id, reply);
  }

  for (const reply of incoming) {
    byId.set(reply.id, reply);
  }

  return Array.from(byId.values()).sort((a, b) => {
    const createdAtDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (createdAtDiff !== 0) {
      return createdAtDiff;
    }

    return a.id.localeCompare(b.id);
  });
}

export default function SinglePostPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ postId: string }>();
  const postId = params.postId;
  const trpcUtils = api.useUtils();
  const targetCommentId = searchParams.get("commentId");
  const targetMediaTagId = searchParams.get("mediaTagId");
  const consumedCommentTargetRef = useRef<string | null>(null);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);

  const [topLevelDraft, setTopLevelDraft] = useState("");
  const [topLevelMentions, setTopLevelMentions] = useState<MentionDraft[]>([]);
  const [activeReplyCommentId, setActiveReplyCommentId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyMentions, setReplyMentions] = useState<MentionDraft[]>([]);
  const [activeEditCommentId, setActiveEditCommentId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editMentions, setEditMentions] = useState<MentionDraft[]>([]);
  const [commentActionError, setCommentActionError] = useState<string | null>(null);
  const [commentActionStatus, setCommentActionStatus] = useState<string | null>(null);
  const [likeOverrides, setLikeOverrides] = useState<Record<string, LikeOverride>>({});
  const [pendingLikeIds, setPendingLikeIds] = useState<string[]>([]);
  const [replyPaginationByParentId, setReplyPaginationByParentId] = useState<
    Record<string, ReplyPaginationState>
  >({});

  const managementContext = api.invite.getManagementContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const familyId = managementContext.data?.family?.id;
  const isAdmin = managementContext.data?.role === "OWNER" || managementContext.data?.role === "ADMIN";

  const memberProfileQuery = api.familyMember.getCurrentUserMemberProfile.useQuery(
    { familyId: familyId ?? "" },
    { enabled: Boolean(familyId) },
  );

  const currentUser = memberProfileQuery.data
    ? { name: memberProfileQuery.data.name, avatarUrl: memberProfileQuery.data.image ?? undefined }
    : undefined;

  const familyMembersQuery = api.familyMember.listFamilyMembers.useQuery(
    { familyId: familyId ?? "" },
    {
      enabled: Boolean(familyId),
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const mentionMembers = useMemo<MentionableMember[]>(
    () =>
      (familyMembersQuery.data ?? []).map((member) => ({
        id: member.id,
        name: member.name,
        avatarUrl: member.image ?? "",
      })),
    [familyMembersQuery.data],
  );

  const postQuery = api.post.getById.useQuery(
    {
      familyId: familyId ?? "",
      postId,
    },
    {
      enabled: Boolean(familyId && postId),
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const commentsInput = familyId && postId ? { familyId, postId, limit: 20 } : undefined;
  const commentsQuery = api.post.getComments.useQuery(
    commentsInput ?? { familyId: "", postId: "", limit: 20 },
    {
      enabled: Boolean(commentsInput),
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const createCommentMutation = api.post.createComment.useMutation();
  const updateCommentMutation = api.post.updateComment.useMutation();
  const deleteCommentMutation = api.post.deleteComment.useMutation();
  const toggleCommentLikeMutation = api.post.toggleCommentLike.useMutation();

  const post = postQuery.data ? mapPostToPostCardData(postQuery.data) : undefined;
  const fullPostTimestamp = postQuery.data ? formatFullPostTimestamp(postQuery.data.createdAt) : undefined;

  const comments = useMemo(() => {
    const items = (commentsQuery.data?.items ?? []) as CommentApiItem[];
    return applyLikeOverrides(items, likeOverrides);
  }, [commentsQuery.data?.items, likeOverrides]);

  useEffect(() => {
    if (!targetCommentId) {
      return;
    }

    if (consumedCommentTargetRef.current === targetCommentId) {
      return;
    }

    const targetElement = document.getElementById(`comment-${targetCommentId}`);
    if (!targetElement) {
      return;
    }

    consumedCommentTargetRef.current = targetCommentId;
    setHighlightedCommentId(targetCommentId);

    targetElement.scrollIntoView({ behavior: "smooth", block: "center" });

    const clearHighlightId = window.setTimeout(() => {
      setHighlightedCommentId((current) => (current === targetCommentId ? null : current));
    }, 4200);

    return () => {
      window.clearTimeout(clearHighlightId);
    };
  }, [targetCommentId, comments]);

  const totalCommentCount = useMemo(
    () => comments.reduce((sum, comment) => sum + 1 + comment.replyCount, 0),
    [comments],
  );

  const isLoading =
    managementContext.isLoading ||
    (Boolean(familyId) && postQuery.isLoading) ||
    (Boolean(commentsInput) && commentsQuery.isLoading);
  const hasNoFamily = !managementContext.isLoading && !familyId;
  const isPostingTopLevelComment = createCommentMutation.isPending && !activeReplyCommentId;

  function isLikePending(commentId: string) {
    return pendingLikeIds.includes(commentId);
  }

  function getReplyPaginationState(comment: CommentApiItem): ReplyPaginationState {
    const existing = replyPaginationByParentId[comment.id];
    if (existing) {
      return existing;
    }

    const hasMore = comment.replyCount > comment.replies.length;
    const nextCursor =
      comment.replies.length > 0
        ? encodeCommentCursor(comment.replies[comment.replies.length - 1]!.createdAt, comment.replies[comment.replies.length - 1]!.id)
        : null;

    return {
      nextCursor,
      hasMore,
      isLoading: false,
    };
  }

  function isRepliesLoading(commentId: string) {
    return replyPaginationByParentId[commentId]?.isLoading ?? false;
  }

  async function loadRepliesForComment(comment: CommentApiItem, loadAll: boolean) {
    if (!commentsInput) return;

    const initialState = getReplyPaginationState(comment);
    if (!initialState.hasMore || initialState.isLoading) {
      return;
    }

    setCommentActionError(null);
    setReplyPaginationByParentId((previous) => ({
      ...previous,
      [comment.id]: {
        ...initialState,
        isLoading: true,
      },
    }));

    try {
      let nextCursor = initialState.nextCursor;
      let hasMore: boolean = initialState.hasMore;

      do {
        const result = await trpcUtils.post.getComments.fetch({
          familyId: commentsInput.familyId,
          postId: commentsInput.postId,
          parentCommentId: comment.id,
          limit: REPLIES_PAGE_SIZE,
          ...(nextCursor ? { cursor: nextCursor } : {}),
        });

        const incomingReplies = result.items as CommentApiItem[];

        trpcUtils.post.getComments.setData(commentsInput, (previous) => {
          if (!previous) return previous;

          return {
            ...previous,
            items: previous.items.map((item) => {
              if (item.id !== comment.id) {
                return item;
              }

              return {
                ...item,
                replies: mergeReplies(item.replies, incomingReplies),
              };
            }),
          };
        });

        const responseNextCursor = typeof result.nextCursor === "string" ? result.nextCursor : null;
        nextCursor = responseNextCursor;
        hasMore = responseNextCursor !== null;
      } while (loadAll && hasMore);

      setReplyPaginationByParentId((previous) => ({
        ...previous,
        [comment.id]: {
          nextCursor,
          hasMore,
          isLoading: false,
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load replies.";
      setCommentActionError(message);
      setReplyPaginationByParentId((previous) => ({
        ...previous,
        [comment.id]: {
          ...initialState,
          isLoading: false,
        },
      }));
    }
  }

  function clearInlineEditors() {
    setActiveReplyCommentId(null);
    setReplyDraft("");
    setActiveEditCommentId(null);
    setEditDraft("");
  }

  function incrementPostCommentCount(delta: number) {
    if (!familyId || !postId || delta === 0) return;

    trpcUtils.post.getById.setData({ familyId, postId }, (previous) => {
      if (!previous) return previous;

      return {
        ...previous,
        commentCount: Math.max((previous.commentCount ?? 0) + delta, 0),
      };
    });
  }

  function findParentTopLevelComment(commentId: string) {
    for (const comment of comments) {
      if (comment.id === commentId) {
        return comment;
      }

      if (comment.replies.some((reply) => reply.id === commentId)) {
        return comment;
      }
    }

    return null;
  }

  async function invalidatePostSurfaceQueries() {
    if (!familyId || !postId) return;

    await Promise.all([
      trpcUtils.post.getById.invalidate({ familyId, postId }),
      trpcUtils.post.getComments.invalidate({ familyId, postId, limit: 20 }),
      trpcUtils.post.getFeed.invalidate(),
      trpcUtils.post.getPostsByMember.invalidate(),
    ]);
  }

  function handleSubmitTopLevelComment() {
    if (!commentsInput || !memberProfileQuery.data) return;

    const normalized = normalizeMentionsForSubmit({
      text: topLevelDraft,
      mentions: topLevelMentions,
    });
    if (!normalized.text) return;

    setCommentActionError(null);
    setCommentActionStatus("Posting comment...");

    const tempId = `temp-comment-${Date.now()}`;
    const now = new Date();

    const optimisticComment: CommentApiItem = {
      id: tempId,
      postId,
      parentCommentId: null,
      content: normalized.text,
      createdAt: now,
      updatedAt: now,
      author: {
        id: memberProfileQuery.data.id,
        name: memberProfileQuery.data.name,
        slug: memberProfileQuery.data.slug,
        avatarUrl: memberProfileQuery.data.image ?? "",
      },
      mentions: [],
      likedByCurrentUser: false,
      likeCount: 0,
      replyCount: 0,
      replies: [],
    };

    setTopLevelDraft("");
    setTopLevelMentions([]);

    trpcUtils.post.getComments.setData(commentsInput, (previous) => {
      if (!previous) {
        return {
          items: [optimisticComment],
          nextCursor: null,
        };
      }

      return {
        ...previous,
        items: [optimisticComment, ...previous.items],
      };
    });
    incrementPostCommentCount(1);

    createCommentMutation.mutate(
      {
        familyId: commentsInput.familyId,
        postId: commentsInput.postId,
        content: normalized.text,
        mentions: normalized.mentions,
      },
      {
        onSuccess: (created) => {
          trpcUtils.post.getComments.setData(commentsInput, (previous) => {
            if (!previous) return previous;

            return {
              ...previous,
              items: previous.items.map((item) => (item.id === tempId ? created : item)),
            };
          });

          setCommentActionStatus("Comment posted.");
          void invalidatePostSurfaceQueries();
        },
        onError: (error) => {
          trpcUtils.post.getComments.setData(commentsInput, (previous) => {
            if (!previous) return previous;

            return {
              ...previous,
              items: previous.items.filter((item) => item.id !== tempId),
            };
          });
          incrementPostCommentCount(-1);
          setTopLevelDraft(normalized.text);
          setTopLevelMentions(normalized.mentions);
          setCommentActionError(error.message);
          setCommentActionStatus("Failed to post comment.");
        },
      },
    );
  }

  function handleStartReply(commentId: string) {
    const target = findCommentById(comments, commentId);

    setCommentActionError(null);
    setActiveEditCommentId(null);
    setEditDraft("");
    setEditMentions([]);
    setActiveReplyCommentId(commentId);

    if (target?.parentCommentId) {
      const mentionText = `@${target.author.name}`;
      setReplyDraft(`${mentionText} `);
      setReplyMentions([
        {
          memberId: target.author.id,
          start: 0,
          end: mentionText.length,
        },
      ]);
      return;
    }

    setReplyDraft("");
    setReplyMentions([]);
  }

  function handleStartEdit(commentId: string) {
    const target = findCommentById(comments, commentId);
    if (!target) return;

    setCommentActionError(null);
    setActiveReplyCommentId(null);
    setReplyDraft("");
    setReplyMentions([]);
    setActiveEditCommentId(commentId);
    setEditDraft(target.content);
    setEditMentions(
      (target.mentions ?? []).map((mention) => ({
        memberId: mention.member.id,
        start: mention.start,
        end: mention.end,
      })),
    );
  }

  function handleSubmitReply() {
    if (!commentsInput || !activeReplyCommentId) return;

    const parentComment = findParentTopLevelComment(activeReplyCommentId);
    if (!parentComment) return;

    const normalized = normalizeMentionsForSubmit({
      text: replyDraft,
      mentions: replyMentions,
    });
    if (!normalized.text) return;

    setCommentActionError(null);
    setCommentActionStatus("Posting reply...");

    createCommentMutation.mutate(
      {
        familyId: commentsInput.familyId,
        postId: commentsInput.postId,
        parentCommentId: parentComment.id,
        content: normalized.text,
        mentions: normalized.mentions,
      },
      {
        onSuccess: (created) => {
          trpcUtils.post.getComments.setData(commentsInput, (previous) => {
            if (!previous) return previous;

            return {
              ...previous,
              items: previous.items.map((item) => {
                if (item.id !== parentComment.id) {
                  return item;
                }

                return {
                  ...item,
                  replyCount: item.replyCount + 1,
                  replies: [...item.replies, created],
                };
              }),
            };
          });

          incrementPostCommentCount(1);
          setReplyDraft("");
          setReplyMentions([]);
          setActiveReplyCommentId(null);
          setCommentActionStatus("Reply posted.");
          void invalidatePostSurfaceQueries();
        },
        onError: (error) => {
          setCommentActionError(error.message);
          setCommentActionStatus("Failed to post reply.");
        },
      },
    );
  }

  function handleSubmitEdit(commentId: string) {
    if (!commentsInput) return;

    const normalized = normalizeMentionsForSubmit({
      text: editDraft,
      mentions: editMentions,
    });
    if (!normalized.text) return;

    setCommentActionError(null);
    setCommentActionStatus("Saving comment...");

    updateCommentMutation.mutate(
      {
        familyId: commentsInput.familyId,
        commentId,
        content: normalized.text,
        mentions: normalized.mentions,
      },
      {
        onSuccess: (updated) => {
          trpcUtils.post.getComments.setData(commentsInput, (previous) => {
            if (!previous) return previous;

            return {
              ...previous,
              items: updateCommentInTree(previous.items, commentId, (comment) => ({
                ...comment,
                content: updated.content,
                updatedAt: updated.updatedAt,
                mentions: updated.mentions,
              })),
            };
          });

          setActiveEditCommentId(null);
          setEditDraft("");
          setEditMentions([]);
          setCommentActionStatus("Comment updated.");
          void invalidatePostSurfaceQueries();
        },
        onError: (error) => {
          setCommentActionError(error.message);
          setCommentActionStatus("Failed to update comment.");
        },
      },
    );
  }

  function handleDeleteComment(commentId: string) {
    if (!commentsInput) return;

    const target = findCommentById(comments, commentId);
    if (!target) return;

    if (!window.confirm("Delete this comment? This cannot be undone.")) {
      return;
    }

    setCommentActionError(null);
    setCommentActionStatus("Deleting comment...");

    deleteCommentMutation.mutate(
      {
        familyId: commentsInput.familyId,
        commentId,
      },
      {
        onSuccess: () => {
          clearInlineEditors();
          setCommentActionStatus("Comment deleted.");
          void invalidatePostSurfaceQueries();
        },
        onError: (error) => {
          setCommentActionError(error.message);
          setCommentActionStatus("Failed to delete comment.");
        },
      },
    );
  }

  function handleToggleLike(commentId: string) {
    if (!commentsInput || isLikePending(commentId)) return;

    const target = findCommentById(comments, commentId);
    if (!target) return;

    const previousOverride = likeOverrides[commentId];
    const previousLikedByCurrentUser =
      previousOverride?.likedByCurrentUser ?? target.likedByCurrentUser;
    const previousLikeCount = previousOverride?.likeCount ?? target.likeCount;

    const nextLikedByCurrentUser = !previousLikedByCurrentUser;
    const nextLikeCount = nextLikedByCurrentUser
      ? previousLikeCount + 1
      : Math.max(previousLikeCount - 1, 0);

    setCommentActionStatus(nextLikedByCurrentUser ? "Liking comment..." : "Removing like...");

    setPendingLikeIds((previous) => [...previous, commentId]);
    setLikeOverrides((previous) => ({
      ...previous,
      [commentId]: {
        likedByCurrentUser: nextLikedByCurrentUser,
        likeCount: nextLikeCount,
      },
    }));

    toggleCommentLikeMutation.mutate(
      {
        familyId: commentsInput.familyId,
        commentId,
      },
      {
        onSuccess: (result) => {
          setLikeOverrides((previous) => ({
            ...previous,
            [commentId]: {
              likedByCurrentUser: result.likedByCurrentUser,
              likeCount: result.likeCount,
            },
          }));
          setCommentActionStatus(result.likedByCurrentUser ? "Comment liked." : "Comment unliked.");
          void invalidatePostSurfaceQueries();
        },
        onError: () => {
          setLikeOverrides((previous) => ({
            ...previous,
            [commentId]: {
              likedByCurrentUser: previousLikedByCurrentUser,
              likeCount: previousLikeCount,
            },
          }));
          setCommentActionStatus("Failed to update comment like.");
        },
        onSettled: () => {
          setPendingLikeIds((previous) => previous.filter((id) => id !== commentId));
        },
      },
    );
  }

  if (isLoading) {
    return (
      <section className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <div className="space-y-4" aria-hidden>
          <Skeleton className="h-9 w-20 rounded-2xl" />
          <div className="rounded-3xl border border-border/80 bg-card/90 p-4 sm:p-5">
            <Skeleton className="h-5 w-40 rounded-full" />
            <Skeleton className="mt-4 h-4 w-full rounded-full" />
            <Skeleton className="mt-2 h-4 w-3/4 rounded-full" />
            <Skeleton className="mt-4 aspect-video rounded-2xl" />
          </div>
        </div>
      </section>
    );
  }

  if (hasNoFamily) {
    return (
      <section className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-1 mb-6 rounded-2xl"
          onClick={() => router.back()}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div className="rounded-3xl border border-dashed border-border/80 bg-card/70 px-6 py-12 text-center">
          <p className="text-lg font-semibold">No family membership found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Join a family to view and comment on posts.
          </p>
        </div>
      </section>
    );
  }

  if (postQuery.error) {
    return (
      <section className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-1 mb-6 rounded-2xl"
          onClick={() => router.back()}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div className="rounded-3xl border border-border/80 bg-card/70 px-6 py-12 text-center">
          <p className="text-lg font-semibold">Unable to load post</p>
          <p className="mt-1 text-sm text-muted-foreground">{postQuery.error.message}</p>
          <Button type="button" className="mt-4" onClick={() => postQuery.refetch()}>
            Retry
          </Button>
        </div>
      </section>
    );
  }

  if (!post) {
    return (
      <section className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-1 mb-6 rounded-2xl"
          onClick={() => router.back()}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div className="rounded-3xl border border-dashed border-border/80 bg-card/70 px-6 py-12 text-center">
          <p className="text-lg font-semibold">Post not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This post may have been removed or the link is incorrect.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-1 mb-6 rounded-2xl"
        onClick={() => router.back()}
      >
        <ArrowLeft className="size-4" />
        Back
      </Button>

      <PostCard
        post={post}
        showHeaderTimestamp={false}
        footerMeta={fullPostTimestamp}
        showActionsSeparator
        currentMemberSlug={memberProfileQuery.data?.slug}
        familyId={familyId}
        isAdmin={isAdmin}
        highlightedMediaTagId={targetMediaTagId}
      />

      <div className="mt-6">
        <CommentInput
          user={currentUser}
          value={topLevelDraft}
          onChange={setTopLevelDraft}
          mentionMembers={mentionMembers}
          mentions={topLevelMentions}
          onMentionsChange={setTopLevelMentions}
          onSubmit={handleSubmitTopLevelComment}
          submitLabel="Reply"
          pending={isPostingTopLevelComment}
        />
      </div>

      <section id="comments" className="mt-5" aria-label="Comments">
        <p className="sr-only" role="status" aria-live="polite">
          {commentActionStatus ?? ""}
        </p>

        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {totalCommentCount} {totalCommentCount === 1 ? "Comment" : "Comments"}
        </h2>

        {commentsQuery.error ? (
          <div
            className="mb-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="status"
            aria-live="polite"
          >
            {commentsQuery.error.message}
          </div>
        ) : null}

        {commentActionError ? (
          <div
            className="mb-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="status"
            aria-live="polite"
          >
            {commentActionError}
          </div>
        ) : null}

        <CommentList
          comments={comments}
          currentMemberId={memberProfileQuery.data?.id}
          currentMemberSlug={memberProfileQuery.data?.slug}
          highlightedCommentId={highlightedCommentId}
          onToggleLike={handleToggleLike}
          onStartReply={handleStartReply}
          onStartEdit={handleStartEdit}
          onDelete={handleDeleteComment}
          isLikePending={isLikePending}
          hasMoreReplies={(comment) =>
            getReplyPaginationState(comment as CommentApiItem).hasMore
          }
          isRepliesLoading={isRepliesLoading}
          onShowMoreReplies={(comment) => {
            void loadRepliesForComment(comment as CommentApiItem, false);
          }}
          onShowAllReplies={(comment) => {
            void loadRepliesForComment(comment as CommentApiItem, true);
          }}
          renderInlineComposer={(comment) => {
            if (activeEditCommentId === comment.id) {
              return (
                <CommentInput
                  user={currentUser}
                  value={editDraft}
                  onChange={setEditDraft}
                  mentionMembers={mentionMembers}
                  mentions={editMentions}
                  onMentionsChange={setEditMentions}
                  onSubmit={() => handleSubmitEdit(comment.id)}
                  placeholder="Edit your comment"
                  submitLabel="Save"
                  pending={updateCommentMutation.isPending}
                  compact
                  autoFocus
                  onCancel={() => {
                    setActiveEditCommentId(null);
                    setEditDraft("");
                    setEditMentions([]);
                  }}
                />
              );
            }

            if (activeReplyCommentId === comment.id) {
              return (
                <CommentInput
                  user={currentUser}
                  value={replyDraft}
                  onChange={setReplyDraft}
                  mentionMembers={mentionMembers}
                  mentions={replyMentions}
                  onMentionsChange={setReplyMentions}
                  onSubmit={handleSubmitReply}
                  placeholder="Write a reply"
                  submitLabel="Reply"
                  pending={createCommentMutation.isPending}
                  compact
                  autoFocus
                  onCancel={() => {
                    setActiveReplyCommentId(null);
                    setReplyDraft("");
                    setReplyMentions([]);
                  }}
                />
              );
            }

            return null;
          }}
        />
      </section>
    </section>
  );
}
