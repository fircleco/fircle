import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getStorageProvider } from "~/server/storage";
import { checkRateLimit } from "~/lib/rate-limit";
import type { db as appDb } from "~/server/db";

import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";

const MAX_MEDIA_PER_POST = 10;
const MAX_REPLY_PREVIEW_PER_PARENT = 3;

function isAbsoluteUrl(value: string) {
  try {
    // URL constructor throws when value is not an absolute URL.
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isAllowedMediaUrl(value: string) {
  const trimmedValue = value.trim();
  return isAbsoluteUrl(trimmedValue) || trimmedValue.startsWith("/api/media/");
}

export const createPostInputSchema = z
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
          url: z
            .string()
            .trim()
            .max(4096)
            .refine(isAllowedMediaUrl, {
              message: "Media url must be an absolute URL or an internal media route",
            }),
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

export const getFeedInputSchema = z.object({
  familyId: z.string().cuid(),
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

export const getPostsByMemberInputSchema = z.object({
  familyId: z.string().cuid(),
  memberId: z.string().cuid(),
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

export const getLikedPostsByMemberInputSchema = z.object({
  familyId: z.string().cuid(),
  memberId: z.string().cuid(),
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

export const getTaggedPostsByMemberInputSchema = z.object({
  familyId: z.string().cuid(),
  memberId: z.string().cuid(),
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

export const getPostByIdInputSchema = z.object({
  familyId: z.string().cuid(),
  postId: z.string().cuid(),
});

export const toggleLikeInputSchema = z.object({
  familyId: z.string().cuid(),
  postId: z.string().cuid(),
});

export const createCommentInputSchema = z.object({
  familyId: z.string().cuid(),
  postId: z.string().cuid(),
  content: z.string().trim().min(1).max(2000),
  parentCommentId: z.string().cuid().optional(),
});

export const getCommentsInputSchema = z.object({
  familyId: z.string().cuid(),
  postId: z.string().cuid(),
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
  parentCommentId: z.string().cuid().optional(),
});

export const updateCommentInputSchema = z.object({
  familyId: z.string().cuid(),
  commentId: z.string().cuid(),
  content: z.string().trim().min(1).max(2000),
});

export const deleteCommentInputSchema = z.object({
  familyId: z.string().cuid(),
  commentId: z.string().cuid(),
});

export const toggleCommentLikeInputSchema = z.object({
  familyId: z.string().cuid(),
  commentId: z.string().cuid(),
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

function toReadUrl(input: { provider: string; bucket: string; objectKey: string; fallbackUrl: string }) {
  const storage = getStorageProvider();

  if (input.provider !== storage.driver) {
    return input.fallbackUrl;
  }

  return storage.buildReadUrl({
    provider: input.provider,
    bucket: input.bucket,
    objectKey: input.objectKey,
  });
}

function formatDuration(durationMs: number | null | undefined) {
  if (durationMs === null || durationMs === undefined) {
    return undefined;
  }

  return `${Math.floor(durationMs / 60000)
    .toString()
    .padStart(2, "0")}:${Math.floor((durationMs % 60000) / 1000)
    .toString()
    .padStart(2, "0")}`;
}

function mapMediaRecord<T extends {
  id: string;
  type: "IMAGE" | "VIDEO";
  provider: string;
  bucket: string;
  objectKey: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  caption: string | null;
  sortOrder: number;
  createdAt: Date;
}>(media: T) {
  const readUrl = toReadUrl({
    provider: media.provider,
    bucket: media.bucket,
    objectKey: media.objectKey,
    fallbackUrl: media.url,
  });

  return {
    id: media.id,
    type: media.type,
    provider: media.provider,
    bucket: media.bucket,
    objectKey: media.objectKey,
    url: readUrl,
    mimeType: media.mimeType,
    sizeBytes: media.sizeBytes,
    width: media.width,
    height: media.height,
    durationMs: media.durationMs,
    caption: media.caption,
    sortOrder: media.sortOrder,
    createdAt: media.createdAt,
  };
}

function mapFeedMediaItem<T extends {
  id: string;
  type: "IMAGE" | "VIDEO";
  provider: string;
  bucket: string;
  objectKey: string;
  url: string;
  durationMs: number | null;
  caption: string | null;
}>(media: T) {
  const readUrl = toReadUrl({
    provider: media.provider,
    bucket: media.bucket,
    objectKey: media.objectKey,
    fallbackUrl: media.url,
  });

  return {
    id: media.id,
    type: media.type === "IMAGE" ? "image" : "video",
    url: readUrl,
    alt: media.caption ?? "",
    durationLabel: formatDuration(media.durationMs),
    caption: media.caption,
  };
}

type MediaTagRecord = {
  id: string;
  postMediaId: string;
  taggedMemberId: string;
  xPercent: unknown;
  yPercent: unknown;
  createdAt: Date;
  updatedAt: Date;
  taggedMember: {
    id: string;
    name: string;
    slug: string;
    image: string | null;
    userId: string | null;
  };
};

function mapMediaTagResponse(tag: MediaTagRecord) {
  const toNumber = (value: unknown) => (value === null ? null : Number(value));

  return {
    id: tag.id,
    postMediaId: tag.postMediaId,
    taggedMemberId: tag.taggedMemberId,
    xPercent: toNumber(tag.xPercent),
    yPercent: toNumber(tag.yPercent),
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
    taggedMember: {
      id: tag.taggedMember.id,
      name: tag.taggedMember.name,
      slug: tag.taggedMember.slug,
      avatarUrl: tag.taggedMember.image ?? "",
      status: tag.taggedMember.userId ? ("claimed" as const) : ("unclaimed" as const),
    },
    timeline: null,
  };
}

function postResponseSelect(currentViewerMemberId: string) {
  return {
    id: true,
    type: true,
    caption: true,
    createdAt: true,
    authorMember: {
      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
      },
    },
    media: {
      orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
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
        mediaTags: {
          orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
          select: {
            id: true,
            postMediaId: true,
            taggedMemberId: true,
            xPercent: true,
            yPercent: true,
            createdAt: true,
            updatedAt: true,
            taggedMember: {
              select: {
                id: true,
                name: true,
                slug: true,
                image: true,
                userId: true,
              },
            },
          },
        },
      },
    },
    likes: {
      where: {
        memberIdWhoLiked: currentViewerMemberId,
      },
      select: {
        id: true,
      },
    },
    _count: {
      select: {
        likes: true,
        comments: true,
      },
    },
  };
}

function mapPostResponse(post: {
  id: string;
  type: "TEXT" | "PHOTO" | "VIDEO" | "MIXED";
  caption: string | null;
  createdAt: Date;
  authorMember: { id: string; name: string; slug: string; image: string | null };
  likes: Array<{ id: string }>;
  _count: { likes: number; comments: number };
  media: Array<{
    id: string;
    type: "IMAGE" | "VIDEO";
    provider: string;
    bucket: string;
    objectKey: string;
    url: string;
    mimeType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    durationMs: number | null;
    caption: string | null;
    sortOrder: number;
    createdAt: Date;
    mediaTags?: MediaTagRecord[];
  }>;
}) {
  const postTaggedMembersById = new Map<string, { name: string; avatarUrl: string }>();

  const mappedMedia = post.media.map((media) => {
    const tags = (media.mediaTags ?? []).map((tag) => mapMediaTagResponse(tag));

    for (const tag of tags) {
      postTaggedMembersById.set(tag.taggedMemberId, {
        name: tag.taggedMember.name,
        avatarUrl: tag.taggedMember.avatarUrl,
      });
    }

    return {
      media,
      mediaRecord: mapMediaRecord(media),
      feedMediaItem: mapFeedMediaItem(media),
      tags,
    };
  });

  return {
    id: post.id,
    type: post.type,
    caption: post.caption,
    body: post.caption ?? "",
    createdAt: post.createdAt,
    createdAtLabel: post.createdAt.toISOString(),
    author: {
      id: post.authorMember.id,
      name: post.authorMember.name,
      slug: post.authorMember.slug,
      avatarUrl: post.authorMember.image ?? "",
    },
    media: mappedMedia.map(({ mediaRecord, tags }) => ({
      ...mediaRecord,
      tags,
    })),
    mediaItems: mappedMedia.map(({ feedMediaItem, tags }) => ({
      ...feedMediaItem,
      taggedMembers: tags.map((tag) => ({
        name: tag.taggedMember.name,
        avatarUrl: tag.taggedMember.avatarUrl,
      })),
      tags,
    })),
    taggedMembers: Array.from(postTaggedMembersById.values()),
    likedByCurrentUser: post.likes.length > 0,
    reactionCount: post._count.likes,
    commentCount: post._count.comments,
  };
}

type CommentRecordBase = {
  id: string;
  postId: string;
  parentCommentId: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  authorMember: { id: string; name: string; slug: string; image: string | null };
  likes: Array<{ id: string }>;
  _count: { likes: number; replies: number };
};

type CommentResponse = {
  id: string;
  postId: string;
  parentCommentId: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    name: string;
    slug: string;
    avatarUrl: string;
  };
  likedByCurrentUser: boolean;
  likeCount: number;
  replyCount: number;
  replies: CommentResponse[];
};

function mapCommentResponse(comment: CommentRecordBase, replies: CommentRecordBase[] = []): CommentResponse {
  return {
    id: comment.id,
    postId: comment.postId,
    parentCommentId: comment.parentCommentId,
    content: comment.content,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    author: {
      id: comment.authorMember.id,
      name: comment.authorMember.name,
      slug: comment.authorMember.slug,
      avatarUrl: comment.authorMember.image ?? "",
    },
    likedByCurrentUser: comment.likes.length > 0,
    likeCount: comment._count.likes,
    replyCount: comment._count.replies,
    replies: replies.map((reply) => mapCommentResponse(reply)),
  };
}

async function requireFamilyMembership(familyId: string, userId: string, db: typeof appDb) {
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
          select: postResponseSelect(membership.id),
        });

        if (!createdPost) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to load created post",
          });
        }

        return mapPostResponse(createdPost);
      });
    }),

  getById: protectedProcedure
    .input(getPostByIdInputSchema)
    .query(async ({ ctx, input }) => {
      const membership = await requireFamilyMembership(input.familyId, ctx.session.user.id, ctx.db);

      const post = await ctx.db.post.findFirst({
        where: {
          id: input.postId,
          authorMember: {
            familyId: input.familyId,
          },
        },
        select: postResponseSelect(membership.id),
      });

      if (!post) {
        return null;
      }

      return mapPostResponse(post);
    }),

  getFeed: protectedProcedure.input(getFeedInputSchema).query(async ({ ctx, input }) => {
    const membership = await requireFamilyMembership(input.familyId, ctx.session.user.id, ctx.db);

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
      select: postResponseSelect(membership.id),
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
      items: items.map((post) => mapPostResponse(post)),
      nextCursor,
    };
  }),

  getPostsByMember: protectedProcedure
    .input(getPostsByMemberInputSchema)
    .query(async ({ ctx, input }) => {
      const membership = await requireFamilyMembership(input.familyId, ctx.session.user.id, ctx.db);

      const cursor = parseCursor(input.cursor);

      const posts = await ctx.db.post.findMany({
        take: input.limit + 1,
        where: {
          authorMemberId: input.memberId,
          authorMember: {
            familyId: input.familyId,
          },
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
        select: postResponseSelect(membership.id),
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
        items: items.map((post) => mapPostResponse(post)),
        nextCursor,
      };
    }),

  getLikedPostsByMember: protectedProcedure
    .input(getLikedPostsByMemberInputSchema)
    .query(async ({ ctx, input }) => {
      const membership = await requireFamilyMembership(input.familyId, ctx.session.user.id, ctx.db);

      const targetMember = await ctx.db.familyMember.findFirst({
        where: {
          id: input.memberId,
          familyId: input.familyId,
        },
        select: {
          id: true,
        },
      });

      if (!targetMember) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Family member not found",
        });
      }

      const cursor = parseCursor(input.cursor);

      const posts = await ctx.db.post.findMany({
        take: input.limit + 1,
        where: {
          authorMember: {
            familyId: input.familyId,
          },
          likes: {
            some: {
              memberIdWhoLiked: input.memberId,
            },
          },
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
        select: postResponseSelect(membership.id),
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
        items: items.map((post) => mapPostResponse(post)),
        nextCursor,
      };
    }),

  getTaggedPostsByMember: protectedProcedure
    .input(getTaggedPostsByMemberInputSchema)
    .query(async ({ ctx, input }) => {
      const membership = await requireFamilyMembership(input.familyId, ctx.session.user.id, ctx.db);

      const targetMember = await ctx.db.familyMember.findFirst({
        where: {
          id: input.memberId,
          familyId: input.familyId,
        },
        select: {
          id: true,
        },
      });

      if (!targetMember) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Family member not found",
        });
      }

      const cursor = parseCursor(input.cursor);

      const posts = await ctx.db.post.findMany({
        take: input.limit + 1,
        where: {
          authorMember: {
            familyId: input.familyId,
          },
          media: {
            some: {
              mediaTags: {
                some: {
                  taggedMemberId: input.memberId,
                },
              },
            },
          },
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
        select: postResponseSelect(membership.id),
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
        items: items.map((post) => mapPostResponse(post)),
        nextCursor,
      };
    }),

  createComment: protectedProcedure
    .input(createCommentInputSchema)
    .mutation(async ({ ctx, input }) => {
      const membership = await requireFamilyMembership(input.familyId, ctx.session.user.id, ctx.db);

      const rateLimit = checkRateLimit(`comment:create:${membership.id}`, 50, 60_000);
      if (!rateLimit.ok) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many requests. Please try again later.",
        });
      }

      const post = await ctx.db.post.findFirst({
        where: {
          id: input.postId,
          authorMember: {
            familyId: input.familyId,
          },
        },
        select: {
          id: true,
        },
      });

      if (!post) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Post not found",
        });
      }

      let parentCommentId: string | null = null;
      if (input.parentCommentId) {
        const parent = await ctx.db.comment.findFirst({
          where: {
            id: input.parentCommentId,
            postId: post.id,
            parentCommentId: null,
          },
          select: {
            id: true,
          },
        });

        if (!parent) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Parent comment not found",
          });
        }

        parentCommentId = parent.id;
      }

      const createdComment = await ctx.db.comment.create({
        data: {
          postId: post.id,
          authorMemberId: membership.id,
          parentCommentId,
          content: input.content,
        },
        select: {
          id: true,
          postId: true,
          parentCommentId: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          authorMember: {
            select: {
              id: true,
              name: true,
              slug: true,
              image: true,
            },
          },
          likes: {
            where: {
              memberIdWhoLiked: membership.id,
            },
            select: {
              id: true,
            },
          },
          _count: {
            select: {
              likes: true,
              replies: true,
            },
          },
        },
      });

      return mapCommentResponse(createdComment);
    }),

  getComments: protectedProcedure
    .input(getCommentsInputSchema)
    .query(async ({ ctx, input }) => {
      const membership = await requireFamilyMembership(input.familyId, ctx.session.user.id, ctx.db);
      const cursor = parseCursor(input.cursor);

      const post = await ctx.db.post.findFirst({
        where: {
          id: input.postId,
          authorMember: {
            familyId: input.familyId,
          },
        },
        select: {
          id: true,
        },
      });

      if (!post) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Post not found",
        });
      }

      if (input.parentCommentId) {
        const parent = await ctx.db.comment.findFirst({
          where: {
            id: input.parentCommentId,
            postId: post.id,
            parentCommentId: null,
          },
          select: {
            id: true,
          },
        });

        if (!parent) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Parent comment not found",
          });
        }
      }

      const paginationWhere = cursor
        ? input.parentCommentId
          ? {
              OR: [
                {
                  createdAt: {
                    gt: cursor.createdAt,
                  },
                },
                {
                  createdAt: cursor.createdAt,
                  id: {
                    gt: cursor.id,
                  },
                },
              ],
            }
          : {
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
        : {};

      const baseWhere = {
        postId: post.id,
        ...paginationWhere,
      };

      const comments = input.parentCommentId
        ? await ctx.db.comment.findMany({
            take: input.limit + 1,
            where: {
              ...baseWhere,
              parentCommentId: input.parentCommentId,
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              postId: true,
              parentCommentId: true,
              content: true,
              createdAt: true,
              updatedAt: true,
              authorMember: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  image: true,
                },
              },
              likes: {
                where: {
                  memberIdWhoLiked: membership.id,
                },
                select: {
                  id: true,
                },
              },
              _count: {
                select: {
                  likes: true,
                  replies: true,
                },
              },
            },
          })
        : await ctx.db.comment.findMany({
            take: input.limit + 1,
            where: {
              ...baseWhere,
              parentCommentId: null,
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: {
              id: true,
              postId: true,
              parentCommentId: true,
              content: true,
              createdAt: true,
              updatedAt: true,
              authorMember: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  image: true,
                },
              },
              likes: {
                where: {
                  memberIdWhoLiked: membership.id,
                },
                select: {
                  id: true,
                },
              },
              _count: {
                select: {
                  likes: true,
                  replies: true,
                },
              },
              replies: {
                take: MAX_REPLY_PREVIEW_PER_PARENT,
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                select: {
                  id: true,
                  postId: true,
                  parentCommentId: true,
                  content: true,
                  createdAt: true,
                  updatedAt: true,
                  authorMember: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                      image: true,
                    },
                  },
                  likes: {
                    where: {
                      memberIdWhoLiked: membership.id,
                    },
                    select: {
                      id: true,
                    },
                  },
                  _count: {
                    select: {
                      likes: true,
                      replies: true,
                    },
                  },
                },
              },
            },
          });

      const hasNextPage = comments.length > input.limit;
      const items = hasNextPage ? comments.slice(0, input.limit) : comments;
      const nextCursor = hasNextPage
        ? encodeCursor({
            createdAt: items[items.length - 1]!.createdAt,
            id: items[items.length - 1]!.id,
          })
        : null;

      return {
        items: items.map((comment) => {
          const replies = (comment as { replies?: CommentRecordBase[] }).replies ?? [];
          return mapCommentResponse(comment, replies);
        }),
        nextCursor,
      };
    }),

  updateComment: protectedProcedure
    .input(updateCommentInputSchema)
    .mutation(async ({ ctx, input }) => {
      const membership = await requireFamilyMembership(input.familyId, ctx.session.user.id, ctx.db);

      const comment = await ctx.db.comment.findFirst({
        where: {
          id: input.commentId,
          post: {
            authorMember: {
              familyId: input.familyId,
            },
          },
        },
        select: {
          id: true,
          authorMemberId: true,
        },
      });

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      if (comment.authorMemberId !== membership.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only edit your own comments",
        });
      }

      const updatedComment = await ctx.db.comment.update({
        where: {
          id: comment.id,
        },
        data: {
          content: input.content,
        },
        select: {
          id: true,
          postId: true,
          parentCommentId: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          authorMember: {
            select: {
              id: true,
              name: true,
              slug: true,
              image: true,
            },
          },
          likes: {
            where: {
              memberIdWhoLiked: membership.id,
            },
            select: {
              id: true,
            },
          },
          _count: {
            select: {
              likes: true,
              replies: true,
            },
          },
        },
      });

      return mapCommentResponse(updatedComment);
    }),

  deleteComment: protectedProcedure
    .input(deleteCommentInputSchema)
    .mutation(async ({ ctx, input }) => {
      const membership = await requireFamilyMembership(input.familyId, ctx.session.user.id, ctx.db);

      const comment = await ctx.db.comment.findFirst({
        where: {
          id: input.commentId,
          post: {
            authorMember: {
              familyId: input.familyId,
            },
          },
        },
        select: {
          id: true,
          authorMemberId: true,
          postId: true,
        },
      });

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      if (comment.authorMemberId !== membership.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete your own comments",
        });
      }

      await ctx.db.comment.delete({
        where: {
          id: comment.id,
        },
      });

      return {
        commentId: comment.id,
        postId: comment.postId,
        deleted: true,
      };
    }),

  toggleCommentLike: protectedProcedure
    .input(toggleCommentLikeInputSchema)
    .mutation(async ({ ctx, input }) => {
      const membership = await requireFamilyMembership(input.familyId, ctx.session.user.id, ctx.db);

      const rateLimit = checkRateLimit(`comment:like:${membership.id}`, 100, 60_000);
      if (!rateLimit.ok) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many requests. Please try again later.",
        });
      }

      const comment = await ctx.db.comment.findFirst({
        where: {
          id: input.commentId,
          post: {
            authorMember: {
              familyId: input.familyId,
            },
          },
        },
        select: {
          id: true,
        },
      });

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      const result = await ctx.db.$transaction(async (tx) => {
        const existingLike = await tx.commentLike.findUnique({
          where: {
            commentId_memberIdWhoLiked: {
              commentId: comment.id,
              memberIdWhoLiked: membership.id,
            },
          },
          select: {
            id: true,
          },
        });

        let likedByCurrentUser = false;
        if (existingLike) {
          await tx.commentLike.delete({
            where: {
              id: existingLike.id,
            },
          });
        } else {
          await tx.commentLike.create({
            data: {
              commentId: comment.id,
              memberIdWhoLiked: membership.id,
            },
          });
          likedByCurrentUser = true;
        }

        const likeCount = await tx.commentLike.count({
          where: {
            commentId: comment.id,
          },
        });

        return {
          commentId: comment.id,
          likedByCurrentUser,
          likeCount,
        };
      });

      return result;
    }),

  toggleLike: protectedProcedure
    .input(toggleLikeInputSchema)
    .mutation(async ({ ctx, input }) => {
      const membership = await requireFamilyMembership(input.familyId, ctx.session.user.id, ctx.db);

      const rateLimit = checkRateLimit(`post:like:${membership.id}`, 100, 60_000);
      if (!rateLimit.ok) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many requests. Please try again later.",
        });
      }

      const post = await ctx.db.post.findFirst({
        where: {
          id: input.postId,
          authorMember: {
            familyId: input.familyId,
          },
        },
        select: {
          id: true,
        },
      });

      if (!post) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Post not found",
        });
      }

      const result = await ctx.db.$transaction(async (tx) => {
        const existingLike = await tx.postLike.findUnique({
          where: {
            postId_memberIdWhoLiked: {
              postId: post.id,
              memberIdWhoLiked: membership.id,
            },
          },
          select: {
            id: true,
          },
        });

        let likedByCurrentUser = false;
        if (existingLike) {
          await tx.postLike.delete({
            where: {
              id: existingLike.id,
            },
          });
        } else {
          await tx.postLike.create({
            data: {
              postId: post.id,
              memberIdWhoLiked: membership.id,
            },
          });
          likedByCurrentUser = true;
        }

        const reactionCount = await tx.postLike.count({
          where: {
            postId: post.id,
          },
        });

        return {
          postId: post.id,
          likedByCurrentUser,
          reactionCount,
        };
      });

      return result;
    }),
});
