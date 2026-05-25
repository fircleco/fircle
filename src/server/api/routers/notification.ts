import { TRPCError } from "@trpc/server"
import { z } from "zod"

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc"
import type { PrismaClient } from "../../../../generated/prisma";

const notificationListInputSchema = z.object({
  familyId: z.string().cuid(),
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
})

const unreadCountInputSchema = z.object({
  familyId: z.string().cuid(),
})

const markAsReadInputSchema = z.object({
  notificationId: z.string().cuid(),
})

const markAllAsReadInputSchema = z.object({
  familyId: z.string().cuid(),
})

type NotificationListRow = {
  id: string
  familyId: string
  recipientMemberId: string
  actorMemberId: string | null
  category: "TAG" | "MENTION" | "ENGAGEMENT" | "INVITE" | "SYSTEM"
  eventType:
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
  sourceType: string
  sourceId: string
  title: string
  body: string
  isRead: boolean
  readAt: Date | null
  createdAt: Date
  updatedAt: Date
  targetHref: string | null
  actorMember: {
    id: string
    name: string
    slug: string
    image: string | null
  } | null
}

export type NotificationListItem = NotificationListRow

export type NotificationListResponse = {
  items: NotificationListItem[]
  nextCursor: string | null
}

export type NotificationUnreadCountResponse = {
  count: number
}

export type NotificationReadResponse = {
  notification: NotificationListItem
}

export type NotificationMarkAllResponse = {
  count: number
}

function parseCursor(cursor?: string) {
  if (!cursor) {
    return null
  }

  const [timestamp, id] = cursor.split("__")
  if (!timestamp || !id) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid cursor",
    })
  }

  const createdAt = new Date(timestamp)
  if (Number.isNaN(createdAt.getTime())) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid cursor timestamp",
    })
  }

  return { createdAt, id }
}

function encodeCursor(input: { createdAt: Date; id: string }) {
  return `${input.createdAt.toISOString()}__${input.id}`
}

function parseSourcePrimaryId(sourceId: string) {
  const [primaryId] = sourceId.split(":")
  return primaryId ?? sourceId
}

function createPostHref(postId: string, params?: Record<string, string>) {
  if (!params || Object.keys(params).length === 0) {
    return `/post/${postId}`
  }

  const searchParams = new URLSearchParams(params)
  return `/post/${postId}?${searchParams.toString()}`
}

async function resolveNotificationTargetHrefs(
  db: PrismaClient,
  rows: Array<Pick<NotificationListRow, "id" | "sourceType" | "sourceId">>,
) {
  const hrefByNotificationId = new Map<string, string>()
  const commentIdByNotificationId = new Map<string, string>()
  const mediaTagIdByNotificationId = new Map<string, string>()
  const postIdByNotificationId = new Map<string, string>()

  for (const row of rows) {
    if (row.sourceType === "invite") {
      hrefByNotificationId.set(row.id, `/settings/invites#${row.sourceId}`)
      continue
    }

    if (row.sourceType === "comment" || row.sourceType === "commentMention" || row.sourceType === "commentLike") {
      commentIdByNotificationId.set(row.id, parseSourcePrimaryId(row.sourceId))
      continue
    }

    if (row.sourceType === "mediaTag") {
      mediaTagIdByNotificationId.set(row.id, parseSourcePrimaryId(row.sourceId))
      continue
    }

    if (row.sourceType === "postMention" || row.sourceType === "postLike") {
      postIdByNotificationId.set(row.id, parseSourcePrimaryId(row.sourceId))
    }
  }

  for (const [notificationId, postId] of postIdByNotificationId) {
    hrefByNotificationId.set(notificationId, createPostHref(postId))
  }

  const commentFindMany = (db as unknown as {
    comment?: {
      findMany?: PrismaClient["comment"]["findMany"]
    }
  }).comment?.findMany

  if (commentIdByNotificationId.size > 0 && commentFindMany) {
    const uniqueCommentIds = [...new Set(commentIdByNotificationId.values())]
    const comments = await commentFindMany({
      where: {
        id: { in: uniqueCommentIds },
      },
      select: {
        id: true,
        postId: true,
      },
    })

    const postIdByCommentId = new Map(comments.map((comment) => [comment.id, comment.postId]))

    for (const [notificationId, commentId] of commentIdByNotificationId) {
      const postId = postIdByCommentId.get(commentId)
      if (!postId) {
        continue
      }

      hrefByNotificationId.set(
        notificationId,
        createPostHref(postId, { commentId }),
      )
    }
  }

  const mediaTagFindMany = (db as unknown as {
    mediaTag?: {
      findMany?: PrismaClient["mediaTag"]["findMany"]
    }
  }).mediaTag?.findMany

  if (mediaTagIdByNotificationId.size > 0 && mediaTagFindMany) {
    const uniqueMediaTagIds = [...new Set(mediaTagIdByNotificationId.values())]
    const mediaTags = await mediaTagFindMany({
      where: {
        id: { in: uniqueMediaTagIds },
      },
      select: {
        id: true,
        postMedia: {
          select: {
            postId: true,
          },
        },
      },
    })

    const postIdByMediaTagId = new Map(
      mediaTags.map((mediaTag) => [mediaTag.id, mediaTag.postMedia.postId]),
    )

    for (const [notificationId, mediaTagId] of mediaTagIdByNotificationId) {
      const postId = postIdByMediaTagId.get(mediaTagId)
      if (!postId) {
        continue
      }

      hrefByNotificationId.set(
        notificationId,
        createPostHref(postId, { mediaTagId }),
      )
    }
  }

  return hrefByNotificationId
}

async function requireFamilyMembership(familyId: string, userId: string, db: PrismaClient) {
  const membership = await db.familyMember.findUnique({
    where: {
      familyId_userId: {
        familyId,
        userId,
      },
    },
    select: {
      id: true,
      familyId: true,
    },
  })

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this family",
    })
  }

  return membership
}

const notificationSelect = {
  id: true,
  familyId: true,
  recipientMemberId: true,
  actorMemberId: true,
  category: true,
  eventType: true,
  sourceType: true,
  sourceId: true,
  title: true,
  body: true,
  isRead: true,
  readAt: true,
  createdAt: true,
  updatedAt: true,
  actorMember: {
    select: {
      id: true,
      name: true,
      slug: true,
      image: true,
    },
  },
} as const

export const notificationRouter = createTRPCRouter({
  getUnreadCount: protectedProcedure
    .input(unreadCountInputSchema)
    .query(async ({ ctx, input }) => {
      const membership = await requireFamilyMembership(
        input.familyId,
        ctx.session.user.id,
        ctx.db,
      )

      const count = await ctx.db.notification.count({
        where: {
          familyId: input.familyId,
          recipientMemberId: membership.id,
          isRead: false,
        },
      })

      return { count } satisfies NotificationUnreadCountResponse
    }),

  listByFamily: protectedProcedure
    .input(notificationListInputSchema)
    .query(async ({ ctx, input }) => {
      const membership = await requireFamilyMembership(
        input.familyId,
        ctx.session.user.id,
        ctx.db,
      )

      const cursor = parseCursor(input.cursor)

      const rows = await ctx.db.notification.findMany({
        take: input.limit + 1,
        where: {
          familyId: input.familyId,
          recipientMemberId: membership.id,
          ...(cursor
            ? {
                OR: [
                  { createdAt: { lt: cursor.createdAt } },
                  { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: notificationSelect,
      })

      const hasNextPage = rows.length > input.limit
      const items = hasNextPage ? rows.slice(0, input.limit) : rows
      const targetHrefs = await resolveNotificationTargetHrefs(ctx.db, items)
      const mappedItems = items.map((item) => ({
        ...item,
        targetHref: targetHrefs.get(item.id) ?? null,
      }))
      const nextCursor = hasNextPage
        ? encodeCursor({
            createdAt: mappedItems[mappedItems.length - 1]!.createdAt,
            id: mappedItems[mappedItems.length - 1]!.id,
          })
        : null

      return {
        items: mappedItems,
        nextCursor,
      } satisfies NotificationListResponse
    }),

  markAsRead: protectedProcedure
    .input(markAsReadInputSchema)
    .mutation(async ({ ctx, input }) => {
      const notification = await ctx.db.notification.findFirst({
        where: {
          id: input.notificationId,
        },
        select: notificationSelect,
      })

      if (!notification) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Notification not found",
        })
      }

      const membership = await requireFamilyMembership(
        notification.familyId,
        ctx.session.user.id,
        ctx.db,
      )

      if (notification.recipientMemberId !== membership.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Notification not found",
        })
      }

      const updatedNotification = await ctx.db.notification.update({
        where: {
          id: notification.id,
        },
        data: {
          isRead: true,
          readAt: notification.isRead ? notification.readAt : new Date(),
        },
        select: notificationSelect,
      })

      return {
        notification: updatedNotification,
      } satisfies NotificationReadResponse
    }),

  markAllAsRead: protectedProcedure
    .input(markAllAsReadInputSchema)
    .mutation(async ({ ctx, input }) => {
      const membership = await requireFamilyMembership(
        input.familyId,
        ctx.session.user.id,
        ctx.db,
      )

      const now = new Date()

      const result = await ctx.db.notification.updateMany({
        where: {
          familyId: input.familyId,
          recipientMemberId: membership.id,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: now,
        },
      })

      return {
        count: result.count,
      } satisfies NotificationMarkAllResponse
    }),
})