ALTER TABLE "Invite"
ADD COLUMN "isReusable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "rotatedFromInviteId" TEXT,
ADD COLUMN "useCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastUsedAt" TIMESTAMP(3);

CREATE INDEX "Invite_rotatedFromInviteId_idx" ON "Invite"("rotatedFromInviteId");
CREATE INDEX "Invite_familyId_isReusable_status_idx" ON "Invite"("familyId", "isReusable", "status");

ALTER TABLE "Invite"
ADD CONSTRAINT "Invite_rotatedFromInviteId_fkey"
FOREIGN KEY ("rotatedFromInviteId") REFERENCES "Invite"("id") ON DELETE SET NULL ON UPDATE CASCADE;