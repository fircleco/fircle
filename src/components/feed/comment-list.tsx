"use client";

import { CommentCard } from "~/components/feed/comment-card";
import type { FeedComment } from "~/components/feed/comment-card";
import { Button } from "~/components/ui/button";

type CommentListProps = {
  comments: FeedComment[];
  highlightedCommentId?: string | null;
  currentMemberId?: string;
  currentMemberSlug?: string;
  onToggleLike: (commentId: string) => void;
  onStartReply: (commentId: string) => void;
  onStartEdit: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  isLikePending?: (commentId: string) => boolean;
  hasMoreReplies?: (comment: FeedComment) => boolean;
  isRepliesLoading?: (commentId: string) => boolean;
  onShowMoreReplies?: (comment: FeedComment) => void;
  onShowAllReplies?: (comment: FeedComment) => void;
  renderInlineComposer?: (comment: FeedComment) => React.ReactNode;
};

export function CommentList({
  comments,
  highlightedCommentId,
  currentMemberId,
  currentMemberSlug,
  onToggleLike,
  onStartReply,
  onStartEdit,
  onDelete,
  isLikePending,
  hasMoreReplies,
  isRepliesLoading,
  onShowMoreReplies,
  onShowAllReplies,
  renderInlineComposer,
}: CommentListProps) {
  if (comments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 bg-card/60 px-6 py-8 text-center">
        <p className="text-sm text-muted-foreground">No comments yet. Be the first to say something!</p>
      </div>
    );
  }

  return (
    <ul className="space-y-5">
      {comments.map((comment) => (
        <li key={comment.id} className="relative scroll-mt-24" id={`comment-${comment.id}`}>
          {(() => {
            const hiddenReplyCount = Math.max(comment.replyCount - comment.replies.length, 0);
            const canShowMore = hasMoreReplies?.(comment) ?? hiddenReplyCount > 0;
            const repliesLoading = isRepliesLoading?.(comment.id) ?? false;

            return (
              <>
          <CommentCard
            comment={comment}
            isHighlighted={highlightedCommentId === comment.id}
            isOwnComment={comment.author.id === currentMemberId}
            currentMemberSlug={currentMemberSlug}
            onToggleLike={onToggleLike}
            onStartReply={onStartReply}
            onStartEdit={onStartEdit}
            onDelete={onDelete}
            likePending={isLikePending?.(comment.id)}
          >
            {renderInlineComposer?.(comment)}
          </CommentCard>

          {comment.replies.length > 0
              ? comment.replies.map((reply) => (
                  <div key={reply.id} className="mt-5 ml-4 relative scroll-mt-24" id={`comment-${reply.id}`}>
                    <div className="w-px h-5 bg-border/80 absolute -top-5 left-8.5 -z-1" />
                    <CommentCard
                      comment={reply}
                      isHighlighted={highlightedCommentId === reply.id}
                      isOwnComment={reply.author.id === currentMemberId}
                      currentMemberSlug={currentMemberSlug}
                      onToggleLike={onToggleLike}
                      onStartReply={onStartReply}
                      onStartEdit={onStartEdit}
                      onDelete={onDelete}
                      likePending={isLikePending?.(reply.id)}
                    >
                      {renderInlineComposer?.(reply)}
                    </CommentCard>
                  </div>
                ))
              : null}

          {canShowMore || repliesLoading ? (
            <div className="mt-3 ml-4 flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-2xl px-3"
                onClick={() => onShowMoreReplies?.(comment)}
                disabled={repliesLoading}
              >
                {repliesLoading ? "Loading..." : "Show more replies"}
              </Button>
              {hiddenReplyCount > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-2xl px-3"
                  onClick={() => onShowAllReplies?.(comment)}
                  disabled={repliesLoading}
                >
                  Show all replies ({hiddenReplyCount})
                </Button>
              ) : null}
            </div>
          ) : null}
              </>
            );
          })()}
        </li>
      ))}
    </ul>
  );
}
