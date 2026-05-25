-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('TAG', 'MENTION', 'ENGAGEMENT', 'INVITE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationEventType" AS ENUM (
    'MEDIA_TAG_CREATED',
    'MEDIA_TAG_UPDATED',
    'POST_MENTION_CREATED',
    'COMMENT_MENTION_CREATED',
    'POST_COMMENT_CREATED',
    'COMMENT_REPLIED',
    'POST_LIKED',
    'COMMENT_LIKED',
    'INVITE_CREATED',
    'INVITE_STATUS_CHANGED',
    'SYSTEM_EVENT'
);

-- CreateEnum
CREATE TYPE "NotificationDeliveryChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "recipientMemberId" TEXT NOT NULL,
    "actorMemberId" TEXT,
    "category" "NotificationCategory" NOT NULL,
    "eventType" "NotificationEventType" NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "category" "NotificationCategory",
    "channel" "NotificationDeliveryChannel" NOT NULL DEFAULT 'IN_APP',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDeliveryLog" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "channel" "NotificationDeliveryChannel" NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_familyId_recipientMemberId_eventType_sourceType__key" ON "Notification"("familyId", "recipientMemberId", "eventType", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "Notification_familyId_recipientMemberId_isRead_createdAt_id_idx" ON "Notification"("familyId", "recipientMemberId", "isRead", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Notification_familyId_recipientMemberId_createdAt_id_idx" ON "Notification"("familyId", "recipientMemberId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Notification_familyId_createdAt_id_idx" ON "Notification"("familyId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Notification_sourceType_sourceId_idx" ON "Notification"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "Notification_actorMemberId_idx" ON "Notification"("actorMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_familyId_memberId_channel_category_key" ON "NotificationPreference"("familyId", "memberId", "channel", "category");

-- CreateIndex
CREATE INDEX "NotificationPreference_familyId_memberId_channel_isEnabled_idx" ON "NotificationPreference"("familyId", "memberId", "channel", "isEnabled");

-- CreateIndex
CREATE INDEX "NotificationPreference_memberId_idx" ON "NotificationPreference"("memberId");

-- CreateIndex
CREATE INDEX "NotificationDeliveryLog_notificationId_idx" ON "NotificationDeliveryLog"("notificationId");

-- CreateIndex
CREATE INDEX "NotificationDeliveryLog_notificationId_channel_idx" ON "NotificationDeliveryLog"("notificationId", "channel");

-- CreateIndex
CREATE INDEX "NotificationDeliveryLog_status_queuedAt_idx" ON "NotificationDeliveryLog"("status", "queuedAt");

-- CreateIndex
CREATE INDEX "NotificationDeliveryLog_createdAt_idx" ON "NotificationDeliveryLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientMemberId_fkey" FOREIGN KEY ("recipientMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorMemberId_fkey" FOREIGN KEY ("actorMemberId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDeliveryLog" ADD CONSTRAINT "NotificationDeliveryLog_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
