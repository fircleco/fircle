-- CreateTable
CREATE TABLE "PostMention" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "mentionedMemberId" TEXT NOT NULL,
    "start" INTEGER NOT NULL,
    "end" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostMention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentMention" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "mentionedMemberId" TEXT NOT NULL,
    "start" INTEGER NOT NULL,
    "end" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommentMention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostMention_postId_start_id_idx" ON "PostMention"("postId", "start", "id");

-- CreateIndex
CREATE INDEX "PostMention_mentionedMemberId_createdAt_idx" ON "PostMention"("mentionedMemberId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PostMention_postId_start_end_key" ON "PostMention"("postId", "start", "end");

-- CreateIndex
CREATE UNIQUE INDEX "PostMention_postId_mentionedMemberId_start_end_key" ON "PostMention"("postId", "mentionedMemberId", "start", "end");

-- CreateIndex
CREATE INDEX "CommentMention_commentId_start_id_idx" ON "CommentMention"("commentId", "start", "id");

-- CreateIndex
CREATE INDEX "CommentMention_mentionedMemberId_createdAt_idx" ON "CommentMention"("mentionedMemberId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommentMention_commentId_start_end_key" ON "CommentMention"("commentId", "start", "end");

-- CreateIndex
CREATE UNIQUE INDEX "CommentMention_commentId_mentionedMemberId_start_end_key" ON "CommentMention"("commentId", "mentionedMemberId", "start", "end");

-- AddForeignKey
ALTER TABLE "PostMention" ADD CONSTRAINT "PostMention_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostMention" ADD CONSTRAINT "PostMention_mentionedMemberId_fkey" FOREIGN KEY ("mentionedMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentMention" ADD CONSTRAINT "CommentMention_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentMention" ADD CONSTRAINT "CommentMention_mentionedMemberId_fkey" FOREIGN KEY ("mentionedMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
