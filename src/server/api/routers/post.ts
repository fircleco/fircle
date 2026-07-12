import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { StorageProvider } from "~/server/storage";
import { getStorageProvider, tryGetStorageProvider } from "~/server/storage";
import { checkRateLimit } from "~/lib/rate-limit";
import type { db as appDb } from "~/server/db";
import { createNotifications, getClaimedMemberIds, dispatchPushForNotifications } from "~/server/notifications";

import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";

const MAX_MEDIA_PER_POST = 10;
const MAX_REPLY_PREVIEW_PER_PARENT = 3;
const MAX_MENTIONS_PER_ENTITY = 20;

type CreatedNotifications = Awaited<ReturnType<typeof createNotifications>>;

const mentionRangeInputSchema = z.object({
  start: z.number().int().min(0),
  end: z.number().int().min(1),
});

const memberMentionInputSchema = mentionRangeInputSchema
  .extend({
    kind: z.literal("MEMBER").optional(),
    memberId: z.string().cuid(),
  })
  .transform(({ kind: _kind, ...rest }) => ({
    ...rest,
    kind: "MEMBER" as const,
  }));

const allMentionInputSchema = mentionRangeInputSchema.extend({
  kind: z.literal("ALL"),
});

const mentionInputSchema = z.union([memberMentionInputSchema, allMentionInputSchema]);
type MentionInput = z.infer<typeof mentionInputSchema>;

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
    mentions: z.array(mentionInputSchema).max(MAX_MENTIONS_PER_ENTITY).default([]),
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
    validateMentionRanges({
      text: input.caption?.trim() ?? "",
      mentions: input.mentions,
      ctx,
      path: ["mentions"],
    });

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

export const createCommentInputSchema = z
  .object({
    familyId: z.string().cuid(),
    postId: z.string().cuid(),
    content: z.string().trim().min(1).max(2000),
    mentions: z.array(mentionInputSchema).max(MAX_MENTIONS_PER_ENTITY).default([]),
    parentCommentId: z.string().cuid().optional(),
  })
  .superRefine((input, ctx) => {
    validateMentionRanges({
      text: input.content,
      mentions: input.mentions,
      ctx,
      path: ["mentions"],
    });
  });

export const getCommentsInputSchema = z.object({
  familyId: z.string().cuid(),
  postId: z.string().cuid(),
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
  parentCommentId: z.string().cuid().optional(),
});

export const updateCommentInputSchema = z
  .object({
    familyId: z.string().cuid(),
    commentId: z.string().cuid(),
    content: z.string().trim().min(1).max(2000),
    mentions: z.array(mentionInputSchema).max(MAX_MENTIONS_PER_ENTITY).default([]),
  })
  .superRefine((input, ctx) => {
    validateMentionRanges({
      text: input.content,
      mentions: input.mentions,
      ctx,
      path: ["mentions"],
    });
  });

export const deleteCommentInputSchema = z.object({
  familyId: z.string().cuid(),
  commentId: z.string().cuid(),
});

export const toggleCommentLikeInputSchema = z.object({
  familyId: z.string().cuid(),
  commentId: z.string().cuid(),
});

function validateMentionRanges(input: {
  text: string;
  mentions: MentionInput[];
  ctx: z.RefinementCtx;
  path: (string | number)[];
}) {
  const sortedMentions = [...input.mentions]
    .map((mention, index) => ({ mention, index }))
    .sort((a, b) => a.mention.start - b.mention.start || a.mention.end - b.mention.end);

  let previousEnd = -1;
  for (const item of sortedMentions) {
    const { mention, index } = item;

    if (mention.start >= mention.end) {
      input.ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...input.path, index, "start"],
        message: "Mention start must be less than end",
      });
      continue;
    }

    if (mention.end > input.text.length) {
      input.ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...input.path, index, "end"],
        message: "Mention range must be within content bounds",
      });
      continue;
    }

    if (mention.start < previousEnd) {
      input.ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...input.path, index, "start"],
        message: "Mention ranges cannot overlap",
      });
      continue;
    }

    previousEnd = mention.end;
  }
}

function getMentionedMemberIds(mentions: MentionInput[]) {
  return mentions
    .filter((mention): mention is Extract<MentionInput, { kind: "MEMBER" }> => mention.kind === "MEMBER")
    .map((mention) => mention.memberId);
}

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

function toReadUrl(storage: StorageProvider | null, input: { provider: string; bucket: string; objectKey: string; fallbackUrl: string }) {
  if (!storage) {
    return input.fallbackUrl;
  }

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
}>(storage: StorageProvider, media: T) {
  const readUrl = toReadUrl(storage, {
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
}>(storage: StorageProvider, media: T) {
  const readUrl = toReadUrl(storage, {
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

type PostMentionRecord = {
  id: string;
  kind: "MEMBER" | "ALL";
  mentionedMemberId: string | null;
  start: number;
  end: number;
  mentionedMember: {
    id: string;
    name: string;
    slug: string;
    image: string | null;
  } | null;
};

type CommentMentionRecord = {
  id: string;
  kind: "MEMBER" | "ALL";
  mentionedMemberId: string | null;
  start: number;
  end: number;
  mentionedMember: {
    id: string;
    name: string;
    slug: string;
    image: string | null;
  } | null;
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

function mapPostMentionResponse(mention: PostMentionRecord) {
  if (mention.kind === "ALL") {
    return {
      id: mention.id,
      kind: "ALL" as const,
      start: mention.start,
      end: mention.end,
      member: null,
    };
  }

  if (!mention.mentionedMember) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Missing mentioned member for MEMBER post mention",
    });
  }

  return {
    id: mention.id,
    kind: "MEMBER" as const,
    start: mention.start,
    end: mention.end,
    member: {
      id: mention.mentionedMember.id,
      name: mention.mentionedMember.name,
      slug: mention.mentionedMember.slug,
      avatarUrl: mention.mentionedMember.image ?? "",
    },
  };
}

function mapCommentMentionResponse(mention: CommentMentionRecord) {
  if (mention.kind === "ALL") {
    return {
      id: mention.id,
      kind: "ALL" as const,
      start: mention.start,
      end: mention.end,
      member: null,
    };
  }

  if (!mention.mentionedMember) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Missing mentioned member for MEMBER comment mention",
    });
  }

  return {
    id: mention.id,
    kind: "MEMBER" as const,
    start: mention.start,
    end: mention.end,
    member: {
      id: mention.mentionedMember.id,
      name: mention.mentionedMember.name,
      slug: mention.mentionedMember.slug,
      avatarUrl: mention.mentionedMember.image ?? "",
    },
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
    mentions: {
      orderBy: [{ start: "asc" as const }, { id: "asc" as const }],
      select: {
        id: true,
        kind: true,
        mentionedMemberId: true,
        start: true,
        end: true,
        mentionedMember: {
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
          },
        },
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

function mapPostResponse(storage: StorageProvider, post: {
  id: string;
  type: "TEXT" | "PHOTO" | "VIDEO" | "MIXED";
  caption: string | null;
  createdAt: Date;
  authorMember: { id: string; name: string; slug: string; image: string | null };
  mentions: PostMentionRecord[];
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
      mediaRecord: mapMediaRecord(storage, media),
      feedMediaItem: mapFeedMediaItem(storage, media),
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
    mentions: (post.mentions ?? []).map((mention) => mapPostMentionResponse(mention)),
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
  mentions?: CommentMentionRecord[];
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
  mentions: Array<{
    id: string;
    kind: "MEMBER" | "ALL";
    start: number;
    end: number;
    member: {
      id: string;
      name: string;
      slug: string;
      avatarUrl: string;
    } | null;
  }>;
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
    mentions: (comment.mentions ?? []).map((mention) => mapCommentMentionResponse(mention)),
    likedByCurrentUser: comment.likes.length > 0,
    likeCount: comment._count.likes,
    replyCount: comment._count.replies,
    replies: replies.map((reply) => mapCommentResponse(reply)),
  };
}

function commentResponseSelect(currentViewerMemberId: string) {
  return {
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
    mentions: {
      orderBy: [{ start: "asc" as const }, { id: "asc" as const }],
      select: {
        id: true,
        kind: true,
        mentionedMemberId: true,
        start: true,
        end: true,
        mentionedMember: {
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
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
        replies: true,
      },
    },
  };
}

async function assertMentionMembersBelongToFamily(input: {
  db: typeof appDb;
  familyId: string;
  mentions: MentionInput[];
}) {
  const memberIds = Array.from(new Set(getMentionedMemberIds(input.mentions)));
  if (memberIds.length === 0) {
    return;
  }

  const familyMembers = await input.db.familyMember.findMany({
    where: {
      familyId: input.familyId,
      id: {
        in: memberIds,
      },
    },
    select: {
      id: true,
    },
  });

  if (familyMembers.length !== memberIds.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "One or more mentioned members are not part of this family",
    });
  }
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
      const storage = await getStorageProvider(input.familyId);

      await assertMentionMembersBelongToFamily({
        db: ctx.db,
        familyId: input.familyId,
        mentions: input.mentions,
      });

      const { result, createdNotifications } = await ctx.db.$transaction(async (tx) => {
        let createdNotifications: CreatedNotifications = [];

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

        if (input.mentions.length > 0) {
          await tx.postMention.createMany({
            data: input.mentions.map((mention) => ({
              postId: post.id,
              kind: mention.kind,
              mentionedMemberId: mention.kind === "MEMBER" ? mention.memberId : null,
              start: mention.start,
              end: mention.end,
            })),
          });

          const claimedMentionedMemberIds = await getClaimedMemberIds(
            tx,
            input.familyId,
            getMentionedMemberIds(input.mentions),
          );

          const mentionSeeds = claimedMentionedMemberIds
            .filter((memberId) => memberId !== membership.id)
            .map((memberId) => ({
              familyId: input.familyId,
              recipientMemberId: memberId,
              actorMemberId: membership.id,
              category: "MENTION" as const,
              eventType: "POST_MENTION_CREATED" as const,
              sourceType: "postMention",
              sourceId: `${post.id}:${memberId}`,
              title: "You were mentioned in a post",
              body: "A family member mentioned you in a post.",
            }));

          if (mentionSeeds.length > 0) {
            createdNotifications = await createNotifications(tx, mentionSeeds);
          }
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

        return {
          result: storage ? mapPostResponse(storage, createdPost) : null,
          createdNotifications,
        };
      });

      void dispatchPushForNotifications(createdNotifications);
      return result;
    }),

  getById: protectedProcedure
    .input(getPostByIdInputSchema)
    .query(async ({ ctx, input }) => {
      const membership = await requireFamilyMembership(input.familyId, ctx.session.user.id, ctx.db);
      const storage = await tryGetStorageProvider(input.familyId);

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

      return storage ? mapPostResponse(storage, post) : null;
    }),

  getFeed: protectedProcedure.input(getFeedInputSchema).query(async ({ ctx, input }) => {
    const membership = await requireFamilyMembership(input.familyId, ctx.session.user.id, ctx.db);
    const storage = await tryGetStorageProvider(input.familyId);

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
      items: storage ? items.map((post) => mapPostResponse(storage, post)) : [],
      nextCursor,
    };
  }),

  getPostsByMember: protectedProcedure
    .input(getPostsByMemberInputSchema)
    .query(async ({ ctx, input }) => {
      const membership = await requireFamilyMembership(input.familyId, ctx.session.user.id, ctx.db);
      const storage = await tryGetStorageProvider(input.familyId);

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
        items: storage ? items.map((post) => mapPostResponse(storage, post)) : [],
        nextCursor,
      };
    }),

  getLikedPostsByMember: protectedProcedure
    .input(getLikedPostsByMemberInputSchema)
    .query(async ({ ctx, input }) => {
      const membership = await requireFamilyMembership(input.familyId, ctx.session.user.id, ctx.db);
      const storage = await tryGetStorageProvider(input.familyId);

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
        items: storage ? items.map((post) => mapPostResponse(storage, post)) : [],
        nextCursor,
      };
    }),

  getTaggedPostsByMember: protectedProcedure
    .input(getTaggedPostsByMemberInputSchema)
    .query(async ({ ctx, input }) => {
      const membership = await requireFamilyMembership(input.familyId, ctx.session.user.id, ctx.db);
      const storage = await tryGetStorageProvider(input.familyId);

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
          OR: [
            {
              media: {
                some: {
                  mediaTags: {
                    some: {
                      taggedMemberId: input.memberId,
                    },
                  },
                },
              },
            },
            {
              mentions: {
                some: {
                  mentionedMemberId: input.memberId,
                },
              },
            },
          ],
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
        items: storage ? items.map((post) => mapPostResponse(storage, post)) : [],
        nextCursor,
      };
    }),

  createComment: protectedProcedure
    .input(createCommentInputSchema)
    .mutation(async ({ ctx, input }) => {
      const membership = await requireFamilyMembership(input.familyId, ctx.session.user.id, ctx.db);

      await assertMentionMembersBelongToFamily({
        db: ctx.db,
        familyId: input.familyId,
        mentions: input.mentions,
      });

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
          authorMemberId: true,
        },
      });

      if (!post) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Post not found",
        });
      }

      let parentCommentId: string | null = null;
      let parentCommentAuthorMemberId: string | null = null;
      if (input.parentCommentId) {
        const parent = await ctx.db.comment.findFirst({
          where: {
            id: input.parentCommentId,
            postId: post.id,
            parentCommentId: null,
          },
          select: {
            id: true,
            authorMemberId: true,
          },
        });

        if (!parent) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Parent comment not found",
          });
        }

        parentCommentId = parent.id;
        parentCommentAuthorMemberId = parent.authorMemberId;
      }

      let createdComment: CommentRecordBase;

      if (input.mentions.length > 0) {
        const transactionResult = await ctx.db.$transaction(async (tx) => {
          let createdNotifications: CreatedNotifications = [];

            const comment = await tx.comment.create({
              data: {
                postId: post.id,
                authorMemberId: membership.id,
                parentCommentId,
                content: input.content,
              },
              select: {
                id: true,
              },
            });

            await tx.commentMention.createMany({
              data: input.mentions.map((mention) => ({
                commentId: comment.id,
                kind: mention.kind,
                mentionedMemberId: mention.kind === "MEMBER" ? mention.memberId : null,
                start: mention.start,
                end: mention.end,
              })),
            });

            const notificationSeeds: Array<{
              familyId: string;
              recipientMemberId: string;
              actorMemberId: string;
              category: "MENTION" | "ENGAGEMENT";
              eventType: "COMMENT_MENTION_CREATED" | "POST_COMMENT_CREATED" | "COMMENT_REPLIED";
              sourceType: string;
              sourceId: string;
              title: string;
              body: string;
            }> = [];

            const claimedMentionedMemberIds = await getClaimedMemberIds(
              tx,
              input.familyId,
              getMentionedMemberIds(input.mentions),
            );

            for (const memberId of claimedMentionedMemberIds) {
              if (memberId === membership.id) {
                continue;
              }

              notificationSeeds.push({
                familyId: input.familyId,
                recipientMemberId: memberId,
                actorMemberId: membership.id,
                category: "MENTION",
                eventType: "COMMENT_MENTION_CREATED",
                sourceType: "commentMention",
                sourceId: `${comment.id}:${memberId}`,
                title: "You were mentioned in a comment",
                body: "A family member mentioned you in a comment.",
              });
            }

            const engagementRecipientId = parentCommentId
              ? parentCommentAuthorMemberId
              : post.authorMemberId;

            if (engagementRecipientId && engagementRecipientId !== membership.id) {
              const claimedRecipientIds = await getClaimedMemberIds(tx, input.familyId, [engagementRecipientId]);
              const recipientMemberId = claimedRecipientIds[0];

              if (recipientMemberId) {
                notificationSeeds.push({
                  familyId: input.familyId,
                  recipientMemberId,
                  actorMemberId: membership.id,
                  category: "ENGAGEMENT",
                  eventType: parentCommentId ? "COMMENT_REPLIED" : "POST_COMMENT_CREATED",
                  sourceType: "comment",
                  sourceId: comment.id,
                  title: parentCommentId ? "Someone replied to your comment" : "Someone commented on your post",
                  body: parentCommentId
                    ? "A family member replied to your comment."
                    : "A family member commented on your post.",
                });
              }
            }

            if (notificationSeeds.length > 0) {
              createdNotifications = await createNotifications(tx, notificationSeeds);
            }

            const created = await tx.comment.findUnique({
              where: {
                id: comment.id,
              },
              select: commentResponseSelect(membership.id),
            });

            if (!created) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to load created comment",
              });
            }

            return {
              created,
              createdNotifications,
            };
          });

        void dispatchPushForNotifications(transactionResult.createdNotifications);
        createdComment = transactionResult.created;
      } else {
        createdComment = await ctx.db.comment.create({
            data: {
              postId: post.id,
              authorMemberId: membership.id,
              parentCommentId,
              content: input.content,
            },
            select: commentResponseSelect(membership.id),
          });
      }

      if (input.mentions.length === 0) {
        const createdNotifications = await ctx.db.$transaction(async (tx) => {
          const engagementRecipientId = parentCommentId
            ? parentCommentAuthorMemberId
            : post.authorMemberId;

          if (!engagementRecipientId || engagementRecipientId === membership.id) {
            return [] as CreatedNotifications;
          }

          const claimedRecipientIds = await getClaimedMemberIds(tx, input.familyId, [engagementRecipientId]);
          const recipientMemberId = claimedRecipientIds[0];
          if (!recipientMemberId) {
            return [] as CreatedNotifications;
          }

          return createNotifications(tx, [
            {
              familyId: input.familyId,
              recipientMemberId,
              actorMemberId: membership.id,
              category: "ENGAGEMENT",
              eventType: parentCommentId ? "COMMENT_REPLIED" : "POST_COMMENT_CREATED",
              sourceType: "comment",
              sourceId: createdComment.id,
              title: parentCommentId ? "Someone replied to your comment" : "Someone commented on your post",
              body: parentCommentId
                ? "A family member replied to your comment."
                : "A family member commented on your post.",
            },
          ]);
        });

        void dispatchPushForNotifications(createdNotifications);
      }

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
            select: commentResponseSelect(membership.id),
          })
        : await ctx.db.comment.findMany({
            take: input.limit + 1,
            where: {
              ...baseWhere,
              parentCommentId: null,
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: {
              ...commentResponseSelect(membership.id),
              replies: {
                take: MAX_REPLY_PREVIEW_PER_PARENT,
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                select: commentResponseSelect(membership.id),
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

      await assertMentionMembersBelongToFamily({
        db: ctx.db,
        familyId: input.familyId,
        mentions: input.mentions,
      });

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

      const { updatedComment, createdNotifications } = await ctx.db.$transaction(async (tx) => {
        let createdNotifications: CreatedNotifications = [];

        await tx.comment.update({
          where: {
            id: comment.id,
          },
          data: {
            content: input.content,
          },
          select: {
            id: true,
          },
        });

        await tx.commentMention.deleteMany({
          where: {
            commentId: comment.id,
          },
        });

        if (input.mentions.length > 0) {
          await tx.commentMention.createMany({
            data: input.mentions.map((mention) => ({
              commentId: comment.id,
              kind: mention.kind,
              mentionedMemberId: mention.kind === "MEMBER" ? mention.memberId : null,
              start: mention.start,
              end: mention.end,
            })),
          });

          const claimedMentionedMemberIds = await getClaimedMemberIds(
            tx,
            input.familyId,
            getMentionedMemberIds(input.mentions),
          );

          const mentionSeeds = claimedMentionedMemberIds
            .filter((memberId) => memberId !== membership.id)
            .map((memberId) => ({
              familyId: input.familyId,
              recipientMemberId: memberId,
              actorMemberId: membership.id,
              category: "MENTION" as const,
              eventType: "COMMENT_MENTION_CREATED" as const,
              sourceType: "commentMention",
              sourceId: `${comment.id}:${memberId}`,
              title: "You were mentioned in a comment",
              body: "A family member mentioned you in a comment.",
            }));

          if (mentionSeeds.length > 0) {
            createdNotifications = await createNotifications(tx, mentionSeeds);
          }
        }

        const updated = await tx.comment.findUnique({
          where: {
            id: comment.id,
          },
          select: commentResponseSelect(membership.id),
        });

        if (!updated) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to load updated comment",
          });
        }

        return {
          updatedComment: updated,
          createdNotifications,
        };
      });

      void dispatchPushForNotifications(createdNotifications);

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
          authorMemberId: true,
        },
      });

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      const { result, createdNotifications } = await ctx.db.$transaction(async (tx) => {
        let createdNotifications: CreatedNotifications = [];

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

          if (comment.authorMemberId !== membership.id) {
            const claimedRecipientIds = await getClaimedMemberIds(tx, input.familyId, [comment.authorMemberId]);
            const recipientMemberId = claimedRecipientIds[0];
            if (recipientMemberId) {
              createdNotifications = await createNotifications(tx, [
                {
                  familyId: input.familyId,
                  recipientMemberId,
                  actorMemberId: membership.id,
                  category: "ENGAGEMENT",
                  eventType: "COMMENT_LIKED",
                  sourceType: "commentLike",
                  sourceId: `${comment.id}:${membership.id}`,
                  title: "Someone liked your comment",
                  body: "A family member liked your comment.",
                },
              ]);
            }
          }
        }

        const likeCount = await tx.commentLike.count({
          where: {
            commentId: comment.id,
          },
        });

        return {
          result: {
            commentId: comment.id,
            likedByCurrentUser,
            likeCount,
          },
          createdNotifications,
        };
      });

      void dispatchPushForNotifications(createdNotifications);

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
          authorMemberId: true,
        },
      });

      if (!post) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Post not found",
        });
      }

      const { result, createdNotifications } = await ctx.db.$transaction(async (tx) => {
        let createdNotifications: CreatedNotifications = [];

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

          if (post.authorMemberId !== membership.id) {
            const claimedRecipientIds = await getClaimedMemberIds(tx, input.familyId, [post.authorMemberId]);
            const recipientMemberId = claimedRecipientIds[0];
            if (recipientMemberId) {
              createdNotifications = await createNotifications(tx, [
                {
                  familyId: input.familyId,
                  recipientMemberId,
                  actorMemberId: membership.id,
                  category: "ENGAGEMENT",
                  eventType: "POST_LIKED",
                  sourceType: "postLike",
                  sourceId: `${post.id}:${membership.id}`,
                  title: "Someone liked your post",
                  body: "A family member liked your post.",
                },
              ]);
            }
          }
        }

        const reactionCount = await tx.postLike.count({
          where: {
            postId: post.id,
          },
        });

        return {
          result: {
            postId: post.id,
            likedByCurrentUser,
            reactionCount,
          },
          createdNotifications,
        };
      });

      void dispatchPushForNotifications(createdNotifications);

      return result;
    }),
});
