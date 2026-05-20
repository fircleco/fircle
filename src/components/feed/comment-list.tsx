"use client";

import { CommentCard } from "~/components/feed/comment-card";
import type { FeedComment } from "~/components/feed/comment-card";

type CommentListProps = {
  comments: FeedComment[];
  currentMemberId?: string;
  onToggleLike: (commentId: string) => void;
  onStartReply: (commentId: string) => void;
  onStartEdit: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  isLikePending?: (commentId: string) => boolean;
  renderInlineComposer?: (comment: FeedComment) => React.ReactNode;
};

export function CommentList({
  comments,
  currentMemberId,
  onToggleLike,
  onStartReply,
  onStartEdit,
  onDelete,
  isLikePending,
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
        <li key={comment.id}>
          <CommentCard
            comment={comment}
            isOwnComment={comment.author.id === currentMemberId}
            onToggleLike={onToggleLike}
            onStartReply={onStartReply}
            onStartEdit={onStartEdit}
            onDelete={onDelete}
            likePending={isLikePending?.(comment.id)}
          >
            {renderInlineComposer?.(comment)}

            {comment.replies.length > 0 ? (
              <ul className="mt-3 space-y-3 border-l border-border/70 pl-3">
                {comment.replies.map((reply) => (
                  <li key={reply.id}>
                    <CommentCard
                      comment={reply}
                      isOwnComment={reply.author.id === currentMemberId}
                      onToggleLike={onToggleLike}
                      onStartReply={onStartReply}
                      onStartEdit={onStartEdit}
                      onDelete={onDelete}
                      likePending={isLikePending?.(reply.id)}
                      showReply={false}
                    >
                      {renderInlineComposer?.(reply)}
                    </CommentCard>
                  </li>
                ))}
              </ul>
            ) : null}
          </CommentCard>
        </li>
      ))}
    </ul>
  );
}
