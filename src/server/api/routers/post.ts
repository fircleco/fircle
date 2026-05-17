import { z } from "zod";
import { TRPCError } from "@trpc/server";

import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";

const MAX_MEDIA_PER_POST = 10;

const createPostInputSchema = z
  .object({
    familyId: z.string().cuid(),
    caption: z.string().trim().max(5000).optional(),
    type: z.enum(["TEXT", "PHOTO", "VIDEO", "MIXED"]),
    media: z
      .array(
        z.object({
          provider: z.string().trim().min(1).max(32),
          bucket: z.string().trim().min(1).max(255),
          objectKey: z.string().trim().min(1).max(2048),
          url: z.string().url().max(4096),
          mimeType: z.string().trim().toLowerCase().min(3).max(120),
          sizeBytes: z.number().int().positive(),
          width: z.number().int().positive().optional(),
          height: z.number().int().positive().optional(),
          durationMs: z.number().int().positive().optional(),
          caption: z.string().trim().max(1000).optional(),
        }),
      )
      .max(MAX_MEDIA_PER_POST)
      .default([]),
  })
  .superRefine((input, ctx) => {
    if (input.type === "TEXT" && input.media.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["media"],
        message: "TEXT posts cannot include media",
      });
    }

    if (input.type !== "TEXT" && input.media.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["media"],
        message: "Media posts must include at least one media item",
      });
    }

    if (input.type === "PHOTO" && input.media.some((m) => m.mimeType.startsWith("video/"))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["media"],
        message: "PHOTO posts may only contain image media",
      });
    }

    if (input.type === "VIDEO" && input.media.some((m) => !m.mimeType.startsWith("video/"))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["media"],
        message: "VIDEO posts may only contain video media",
      });
    }
  });

const getFeedInputSchema = z.object({
  familyId: z.string().cuid(),
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

function parseCursor(cursor?: string) {
  if (!cursor) {
    return null;
  }

  const [timestamp, id] = cursor.split("__");
  if (!timestamp || !id) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid cursor",
    });
  }

  const createdAt = new Date(timestamp);
  if (Number.isNaN(createdAt.getTime())) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid cursor timestamp",
    });
  }

  return { createdAt, id };
}

function encodeCursor(input: { createdAt: Date; id: string }) {
  return `${input.createdAt.toISOString()}__${input.id}`;
}

function toPostMediaType(mimeType: string): "IMAGE" | "VIDEO" {
  if (mimeType.startsWith("image/")) {
    return "IMAGE";
  }
  if (mimeType.startsWith("video/")) {
    return "VIDEO";
  }

  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `Unsupported media mime type: ${mimeType}`,
  });
}

async function requireFamilyMembership(familyId: string, userId: string, db: typeof import("~/server/db").db) {
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
      name: true,
      image: true,
    },
  });

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this family",
    });
  }

  return membership;
}

export const postRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createPostInputSchema)
    .mutation(async ({ ctx, input }) => {
      const membership = await requireFamilyMembership(
        input.familyId,
        ctx.session.user.id,
        ctx.db,
      );

      return ctx.db.$transaction(async (tx) => {
        const post = await tx.post.create({
          data: {
            caption: input.caption,
            type: input.type,
            authorMemberId: membership.id,
          },
        });

        if (input.media.length > 0) {
          await tx.postMedia.createMany({
            data: input.media.map((media, index) => ({
              postId: post.id,
              type: toPostMediaType(media.mimeType),
              provider: media.provider,
              bucket: media.bucket,
              objectKey: media.objectKey,
              url: media.url,
              mimeType: media.mimeType,
              sizeBytes: media.sizeBytes,
              width: media.width,
              height: media.height,
              durationMs: media.durationMs,
              caption: media.caption,
              sortOrder: index,
            })),
          });
        }

        const createdPost = await tx.post.findUnique({
          where: { id: post.id },
          select: {
            id: true,
            type: true,
            caption: true,
            createdAt: true,
            authorMember: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            media: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              select: {
                id: true,
                type: true,
                provider: true,
                bucket: true,
                objectKey: true,
                url: true,
                mimeType: true,
                sizeBytes: true,
                width: true,
                height: true,
                durationMs: true,
                caption: true,
                sortOrder: true,
                createdAt: true,
              },
            },
          },
        });

        if (!createdPost) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to load created post",
          });
        }

        return {
          id: createdPost.id,
          type: createdPost.type,
          caption: createdPost.caption,
          body: createdPost.caption ?? "",
          createdAt: createdPost.createdAt,
          createdAtLabel: createdPost.createdAt.toISOString(),
          author: {
            id: createdPost.authorMember.id,
            name: createdPost.authorMember.name,
            avatarUrl: createdPost.authorMember.image ?? "",
          },
          media: createdPost.media.map((media) => ({
            id: media.id,
            type: media.type,
            provider: media.provider,
            bucket: media.bucket,
            objectKey: media.objectKey,
            url: media.url,
            mimeType: media.mimeType,
            sizeBytes: media.sizeBytes,
            width: media.width,
            height: media.height,
            durationMs: media.durationMs,
            caption: media.caption,
            sortOrder: media.sortOrder,
            createdAt: media.createdAt,
          })),
          mediaItems: createdPost.media.map((media) => ({
            id: media.id,
            type: media.type === "IMAGE" ? "image" : "video",
            url: media.url,
            alt: media.caption ?? createdPost.caption ?? "Post media",
            durationLabel:
              media.durationMs !== null && media.durationMs !== undefined
                ? `${Math.floor(media.durationMs / 60000)
                    .toString()
                    .padStart(2, "0")}:${Math.floor((media.durationMs % 60000) / 1000)
                    .toString()
                    .padStart(2, "0")}`
                : undefined,
            caption: media.caption,
          })),
          taggedMembers: [],
          reactionCount: 0,
          commentCount: 0,
        };
      });
    }),

  getFeed: protectedProcedure.input(getFeedInputSchema).query(async ({ ctx, input }) => {
    await requireFamilyMembership(input.familyId, ctx.session.user.id, ctx.db);

    const cursor = parseCursor(input.cursor);

    const posts = await ctx.db.post.findMany({
      take: input.limit + 1,
      where: {
        authorMember: {
          familyId: input.familyId,
        },
        ...(cursor
          ? {
              OR: [
                {
                  createdAt: {
                    lt: cursor.createdAt,
                  },
                },
                {
                  createdAt: cursor.createdAt,
                  id: {
                    lt: cursor.id,
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        type: true,
        caption: true,
        createdAt: true,
        authorMember: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        media: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            type: true,
            provider: true,
            bucket: true,
            objectKey: true,
            url: true,
            mimeType: true,
            sizeBytes: true,
            width: true,
            height: true,
            durationMs: true,
            caption: true,
            sortOrder: true,
            createdAt: true,
          },
        },
      },
    });

    const hasNextPage = posts.length > input.limit;
    const items = hasNextPage ? posts.slice(0, input.limit) : posts;
    const nextCursor = hasNextPage
      ? encodeCursor({
          createdAt: items[items.length - 1]!.createdAt,
          id: items[items.length - 1]!.id,
        })
      : null;

    return {
      items: items.map((post) => ({
        id: post.id,
        type: post.type,
        caption: post.caption,
        body: post.caption ?? "",
        createdAt: post.createdAt,
        createdAtLabel: post.createdAt.toISOString(),
        author: {
          id: post.authorMember.id,
          name: post.authorMember.name,
          avatarUrl: post.authorMember.image ?? "",
        },
        media: post.media.map((media) => ({
          id: media.id,
          type: media.type,
          provider: media.provider,
          bucket: media.bucket,
          objectKey: media.objectKey,
          url: media.url,
          mimeType: media.mimeType,
          sizeBytes: media.sizeBytes,
          width: media.width,
          height: media.height,
          durationMs: media.durationMs,
          caption: media.caption,
          sortOrder: media.sortOrder,
          createdAt: media.createdAt,
        })),
        mediaItems: post.media.map((media) => ({
          id: media.id,
          type: media.type === "IMAGE" ? "image" : "video",
          url: media.url,
          alt: media.caption ?? post.caption ?? "Post media",
          durationLabel:
            media.durationMs !== null && media.durationMs !== undefined
              ? `${Math.floor(media.durationMs / 60000)
                  .toString()
                  .padStart(2, "0")}:${Math.floor((media.durationMs % 60000) / 1000)
                  .toString()
                  .padStart(2, "0")}`
              : undefined,
          caption: media.caption,
        })),
        taggedMembers: [],
        reactionCount: 0,
        commentCount: 0,
      })),
      nextCursor,
    };
  }),
});
