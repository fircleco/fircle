import type { Prisma } from "../../generated/prisma"
import { db } from "~/server/db"
import {
  isPushConfigured,
  sendPush,
  type PushPayload,
  type PushSubscriptionData,
} from "~/server/push"

export type NotificationCategory = "TAG" | "MENTION" | "ENGAGEMENT" | "INVITE" | "SYSTEM"

export type NotificationEventType =
  | "MEDIA_TAG_CREATED"
  | "MEDIA_TAG_UPDATED"
  | "POST_MENTION_CREATED"
  | "COMMENT_MENTION_CREATED"
  | "POST_COMMENT_CREATED"
  | "COMMENT_REPLIED"
  | "POST_LIKED"
  | "COMMENT_LIKED"
  | "INVITE_CREATED"
  | "INVITE_STATUS_CHANGED"
  | "SYSTEM_EVENT"

export type NotificationSeed = {
  familyId: string
  recipientMemberId: string
  actorMemberId?: string | null
  category: NotificationCategory
  eventType: NotificationEventType
  sourceType: string
  sourceId: string
  title: string
  body: string
}

type NotificationTx = Prisma.TransactionClient
export type CreatedNotification = {
  id: string
  familyId: string
  recipientMemberId: string
  eventType: NotificationEventType
  title: string
  body: string
  sourceType: string
  sourceId: string
}

const IN_APP_CHANNEL = "IN_APP" as const
const PUSH_CHANNEL = "PUSH" as const
const PENDING_STATUS = "PENDING" as const
const QUEUED_STATUS = "QUEUED" as const
const SENT_STATUS = "SENT" as const
const FAILED_STATUS = "FAILED" as const
const SKIPPED_STATUS = "SKIPPED" as const

function parseSourcePrimaryId(sourceId: string) {
  const [primaryId] = sourceId.split(":")
  return primaryId ?? sourceId
}

function createPostHref(postId: string, params?: Record<string, string>) {
  if (!params || Object.keys(params).length === 0) {
    return `/post/${postId}`
  }

  return `/post/${postId}?${new URLSearchParams(params).toString()}`
}

async function resolveNotificationTargetHref(notification: CreatedNotification) {
  if (notification.sourceType === "invite") {
    return `/settings/invites#${notification.sourceId}`
  }

  if (
    notification.sourceType === "postMention" ||
    notification.sourceType === "postLike"
  ) {
    return createPostHref(parseSourcePrimaryId(notification.sourceId))
  }

  if (
    notification.sourceType === "comment" ||
    notification.sourceType === "commentMention" ||
    notification.sourceType === "commentLike"
  ) {
    const commentId = parseSourcePrimaryId(notification.sourceId)
    const comment = await db.comment.findUnique({
      where: { id: commentId },
      select: { postId: true },
    })

    return comment ? createPostHref(comment.postId, { commentId }) : "/notifications"
  }

  if (notification.sourceType === "mediaTag") {
    const mediaTagId = parseSourcePrimaryId(notification.sourceId)
    const mediaTag = await db.mediaTag.findUnique({
      where: { id: mediaTagId },
      select: {
        postMedia: {
          select: {
            postId: true,
          },
        },
      },
    })

    return mediaTag
      ? createPostHref(mediaTag.postMedia.postId, { mediaTagId })
      : "/notifications"
  }

  return "/notifications"
}

/**
 * Check if push notifications are enabled for a member/eventType combination.
 * Default is enabled if no explicit preference exists.
 */
async function isPushEnabledForMember(
  familyId: string,
  memberId: string,
  eventType: NotificationEventType,
): Promise<boolean> {
  const preference = await db.notificationPreference.findFirst({
    where: {
      familyId,
      memberId,
      channel: PUSH_CHANNEL,
      eventType,
    },
    select: {
      isEnabled: true,
    },
  })

  // Default to enabled if no preference exists
  return preference?.isEnabled ?? true
}

export async function createNotifications(tx: NotificationTx, seeds: NotificationSeed[]) {
  const createdNotifications: CreatedNotification[] = []

  for (const seed of seeds) {
    const existing = await tx.notification.findUnique({
      where: {
        familyId_recipientMemberId_eventType_sourceType_sourceId: {
          familyId: seed.familyId,
          recipientMemberId: seed.recipientMemberId,
          eventType: seed.eventType,
          sourceType: seed.sourceType,
          sourceId: seed.sourceId,
        },
      },
      select: { id: true },
    })

    if (existing) {
      continue
    }

    const notification = await tx.notification.create({
      data: {
        familyId: seed.familyId,
        recipientMemberId: seed.recipientMemberId,
        actorMemberId: seed.actorMemberId ?? null,
        category: seed.category,
        eventType: seed.eventType,
        sourceType: seed.sourceType,
        sourceId: seed.sourceId,
        title: seed.title,
        body: seed.body,
      },
      select: {
        id: true,
      },
    })

    await tx.notificationDeliveryLog.createMany({
      data: [
        {
          notificationId: notification.id,
          channel: IN_APP_CHANNEL,
          status: QUEUED_STATUS,
        },
        ...(isPushConfigured()
          ? [
              {
                notificationId: notification.id,
                channel: PUSH_CHANNEL,
                status: PENDING_STATUS,
              },
            ]
          : []),
      ],
    })

    createdNotifications.push({
      id: notification.id,
      familyId: seed.familyId,
      recipientMemberId: seed.recipientMemberId,
      eventType: seed.eventType,
      title: seed.title,
      body: seed.body,
      sourceType: seed.sourceType,
      sourceId: seed.sourceId,
    })
  }

  return createdNotifications
}

/**
 * Dispatch push notifications for newly created notifications.
 * This should be called after the transaction that created notifications commits.
 */
export async function dispatchPushForNotifications(
  notifications: CreatedNotification[],
): Promise<void> {
  if (notifications.length === 0) {
    return
  }

  if (!isPushConfigured()) {
    return
  }

  for (const notification of notifications) {
    let deliveryLogId: string | undefined

    try {
      const deliveryLog = await db.notificationDeliveryLog.findFirst({
        where: {
          notificationId: notification.id,
          channel: PUSH_CHANNEL,
        },
        select: {
          id: true,
          attemptCount: true,
        },
      })

      if (!deliveryLog) {
        continue
      }

      deliveryLogId = deliveryLog.id

      const isPushEnabled = await isPushEnabledForMember(
        notification.familyId,
        notification.recipientMemberId,
        notification.eventType,
      )

      if (!isPushEnabled) {
        await db.notificationDeliveryLog.update({
          where: { id: deliveryLog.id },
          data: {
            status: SKIPPED_STATUS,
            errorMessage: "Push disabled for this interaction type",
          },
        })
        continue
      }

      const subscriptions: PushSubscriptionData[] = await db.pushSubscription.findMany({
        where: {
          familyId: notification.familyId,
          memberId: notification.recipientMemberId,
        },
        select: {
          endpoint: true,
          p256dh: true,
          auth: true,
        },
      })

      if (subscriptions.length === 0) {
        await db.notificationDeliveryLog.update({
          where: { id: deliveryLog.id },
          data: {
            status: SKIPPED_STATUS,
            errorMessage: "No active push subscriptions",
          },
        })
        continue
      }

      await db.notificationDeliveryLog.update({
        where: { id: deliveryLog.id },
        data: {
          status: QUEUED_STATUS,
          errorMessage: null,
        },
      })

      const targetUrl = await resolveNotificationTargetHref(notification)
      const payload: PushPayload = {
        title: notification.title,
        body: notification.body,
        targetUrl,
        tag: `${notification.sourceType}:${notification.sourceId}`,
      }

      const attemptedAt = new Date()
      let providerMessageId: string | undefined
      let lastFailureMessage: string | undefined
      let hadSuccessfulSend = false
      let hadTransientFailure = false

      for (const subscription of subscriptions) {
        const result = await sendPush(subscription, payload)

        if (result.outcome === SENT_STATUS) {
          hadSuccessfulSend = true
          providerMessageId ??= result.providerMessageId

          await db.pushSubscription.updateMany({
            where: { endpoint: subscription.endpoint },
            data: { lastUsedAt: attemptedAt },
          })

          continue
        }

        lastFailureMessage = result.errorMessage

        if (result.outcome === "INVALID_SUBSCRIPTION") {
          await db.pushSubscription.deleteMany({
            where: { endpoint: subscription.endpoint },
          })
          continue
        }

        hadTransientFailure = true
      }

      if (hadSuccessfulSend) {
        await db.notificationDeliveryLog.update({
          where: { id: deliveryLog.id },
          data: {
            status: SENT_STATUS,
            attemptCount: deliveryLog.attemptCount + subscriptions.length,
            lastAttemptAt: attemptedAt,
            deliveredAt: attemptedAt,
            failedAt: null,
            errorMessage: null,
            providerMessageId,
          },
        })

        continue
      }

      if (hadTransientFailure) {
        await db.notificationDeliveryLog.update({
          where: { id: deliveryLog.id },
          data: {
            status: FAILED_STATUS,
            attemptCount: deliveryLog.attemptCount + subscriptions.length,
            lastAttemptAt: attemptedAt,
            failedAt: attemptedAt,
            errorMessage: lastFailureMessage ?? "Push delivery failed",
          },
        })

        continue
      }

      await db.notificationDeliveryLog.update({
        where: { id: deliveryLog.id },
        data: {
          status: SKIPPED_STATUS,
          attemptCount: deliveryLog.attemptCount + subscriptions.length,
          lastAttemptAt: attemptedAt,
          errorMessage: lastFailureMessage ?? "All push subscriptions were invalid",
        },
      })
    } catch (error) {
      console.error(
        `[notifications:dispatch-push] Error processing notification ${notification.id}:`,
        error instanceof Error ? error.message : String(error),
      )

      if (deliveryLogId) {
        await db.notificationDeliveryLog.update({
          where: { id: deliveryLogId },
          data: {
            status: FAILED_STATUS,
            failedAt: new Date(),
            errorMessage:
              error instanceof Error ? error.message : "Unknown push dispatch error",
          },
        })
      }
    }
  }
}

export async function getClaimedMemberIds(
  tx: NotificationTx,
  familyId: string,
  memberIds: string[],
) {
  if (memberIds.length === 0) {
    return []
  }

  const uniqueMemberIds = [...new Set(memberIds)]

  const members = await tx.familyMember.findMany({
    where: {
      familyId,
      id: { in: uniqueMemberIds },
      userId: { not: null },
    },
    select: {
      id: true,
    },
  })

  return members.map((member) => member.id)
}

export async function getClaimedAdminMemberIds(
  tx: NotificationTx,
  familyId: string,
  excludeMemberIds: string[] = [],
) {
  const members = await tx.familyMember.findMany({
    where: {
      familyId,
      role: { in: ["OWNER", "ADMIN"] },
      userId: { not: null },
      ...(excludeMemberIds.length > 0
        ? {
            id: { notIn: excludeMemberIds },
          }
        : {}),
    },
    select: {
      id: true,
    },
  })

  return members.map((member) => member.id)
}

export async function resolveClaimedMentionRecipientIds(
  tx: NotificationTx,
  input: {
    familyId: string
    actorMemberId: string
    directMemberIds: string[]
    includeAll: boolean
  },
) {
  const recipientIds = new Set<string>()

  if (input.includeAll) {
    const claimedFamilyMembers = await tx.familyMember.findMany({
      where: {
        familyId: input.familyId,
        userId: { not: null },
        id: { not: input.actorMemberId },
      },
      select: {
        id: true,
      },
    })

    for (const member of claimedFamilyMembers) {
      recipientIds.add(member.id)
    }
  }

  const claimedDirectMemberIds = await getClaimedMemberIds(
    tx,
    input.familyId,
    input.directMemberIds,
  )

  for (const memberId of claimedDirectMemberIds) {
    if (memberId !== input.actorMemberId) {
      recipientIds.add(memberId)
    }
  }

  return [...recipientIds]
}