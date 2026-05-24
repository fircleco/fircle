import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getStorageProvider } from "~/server/storage";
import type { db as appDb } from "~/server/db";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const getFamilyGalleryInputSchema = z.object({
  familyId: z.string().cuid(),
  limit: z.number().int().min(1).max(100).default(30),
  cursor: z.string().optional(),
});

export const getMemberGalleryInputSchema = z.object({
  familyId: z.string().cuid(),
  memberId: z.string().cuid(),
  limit: z.number().int().min(1).max(100).default(30),
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

type GalleryMediaRow = {
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
  post: {
    id: string;
    createdAt: Date;
    authorMemberId: string;
    authorMember: {
      id: string;
      name: string;
      slug: string;
      image: string | null;
    };
  };
  mediaTags: MediaTagRecord[];
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
  };
}

function mapGalleryMediaItem(media: GalleryMediaRow) {
  const tags = media.mediaTags.map((tag) => mapMediaTagResponse(tag));
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
    post: {
      id: media.post.id,
      createdAt: media.post.createdAt,
      author: {
        id: media.post.authorMember.id,
        name: media.post.authorMember.name,
        slug: media.post.authorMember.slug,
        avatarUrl: media.post.authorMember.image ?? "",
      },
    },
    tags,
    mediaItem: {
      id: media.id,
      type: media.type === "IMAGE" ? ("image" as const) : ("video" as const),
      url: readUrl,
      alt: media.caption ?? "",
      caption: media.caption ?? undefined,
      durationLabel: formatDuration(media.durationMs),
      taggedMembers: tags.map((tag) => ({
        name: tag.taggedMember.name,
        avatarUrl: tag.taggedMember.avatarUrl,
      })),
      tags,
    },
  };
}

function sortMediaDescendingByCreatedAt(items: GalleryMediaRow[]) {
  return [...items].sort((a, b) => {
    const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return b.id.localeCompare(a.id);
  });
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

async function requireMemberInFamily(familyId: string, memberId: string, db: typeof appDb) {
  const member = await db.familyMember.findFirst({
    where: {
      id: memberId,
      familyId,
    },
    select: {
      id: true,
    },
  });

  if (!member) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Family member not found",
    });
  }

  return member;
}

const galleryMediaSelect = {
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
  post: {
    select: {
      id: true,
      createdAt: true,
      authorMemberId: true,
      authorMember: {
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
        },
      },
    },
  },
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
};

export const mediaRouter = createTRPCRouter({
  getFamilyGallery: protectedProcedure
    .input(getFamilyGalleryInputSchema)
    .query(async ({ ctx, input }) => {
      await requireFamilyMembership(input.familyId, ctx.session.user.id, ctx.db);

      const cursor = parseCursor(input.cursor);

      const rows = await ctx.db.postMedia.findMany({
        take: input.limit + 1,
        where: {
          post: {
            authorMember: {
              familyId: input.familyId,
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
        select: galleryMediaSelect,
      });

      const hasNextPage = rows.length > input.limit;
      const items = hasNextPage ? rows.slice(0, input.limit) : rows;
      const nextCursor = hasNextPage
        ? encodeCursor({
            createdAt: items[items.length - 1]!.createdAt,
            id: items[items.length - 1]!.id,
          })
        : null;

      return {
        items: items.map((row) => mapGalleryMediaItem(row)),
        nextCursor,
      };
    }),

  getMemberGallery: protectedProcedure
    .input(getMemberGalleryInputSchema)
    .query(async ({ ctx, input }) => {
      await requireFamilyMembership(input.familyId, ctx.session.user.id, ctx.db);
      await requireMemberInFamily(input.familyId, input.memberId, ctx.db);

      const [publishedRows, taggedRows] = await Promise.all([
        ctx.db.postMedia.findMany({
          take: input.limit,
          where: {
            post: {
              authorMemberId: input.memberId,
              authorMember: {
                familyId: input.familyId,
              },
            },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: galleryMediaSelect,
        }),
        ctx.db.postMedia.findMany({
          take: input.limit,
          where: {
            post: {
              authorMember: {
                familyId: input.familyId,
              },
            },
            mediaTags: {
              some: {
                taggedMemberId: input.memberId,
              },
            },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: galleryMediaSelect,
        }),
      ]);

      const publishedIds = new Set(publishedRows.map((row) => row.id));
      const dedupedTagged = taggedRows.filter((row) => !publishedIds.has(row.id));

      return {
        publishedMedia: sortMediaDescendingByCreatedAt(publishedRows).map((row) =>
          mapGalleryMediaItem(row),
        ),
        taggedMedia: sortMediaDescendingByCreatedAt(dedupedTagged).map((row) =>
          mapGalleryMediaItem(row),
        ),
      };
    }),
});
