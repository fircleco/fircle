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
        <li key={comment.id} className="relative">
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
          </CommentCard>

          {comment.replies.length > 0
              ? comment.replies.map((reply) => (
                  <div key={reply.id} className="mt-3 ml-4 relative">
                    <div className="w-px h-full bg-border/80 absolute -top-6 left-8.5 -z-1" />
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
                  </div>
                ))
              : null}
        </li>
      ))}
    </ul>
  );
}
