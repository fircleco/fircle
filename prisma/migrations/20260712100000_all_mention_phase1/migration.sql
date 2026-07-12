-- Phase 1: allow special @all mention records alongside member mentions.
CREATE TYPE "MentionKind" AS ENUM ('MEMBER', 'ALL');

ALTER TABLE "PostMention"
ADD COLUMN "kind" "MentionKind" NOT NULL DEFAULT 'MEMBER',
ALTER COLUMN "mentionedMemberId" DROP NOT NULL;

ALTER TABLE "CommentMention"
ADD COLUMN "kind" "MentionKind" NOT NULL DEFAULT 'MEMBER',
ALTER COLUMN "mentionedMemberId" DROP NOT NULL;
