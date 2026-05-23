/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { PrismaClient } from "../../../../generated/prisma";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const coordinateSchema = z.number().min(0).max(100);

const listTagsByMediaInputSchema = z.object({
  familyId: z.string().cuid(),
  postMediaId: z.string().cuid(),
});

const createPhotoTagInputSchema = z.object({
  familyId: z.string().cuid(),
  postMediaId: z.string().cuid(),
  taggedMemberId: z.string().cuid(),
  xPercent: coordinateSchema,
  yPercent: coordinateSchema,
});

const updatePhotoTagInputSchema = z
  .object({
    familyId: z.string().cuid(),
    tagId: z.string().cuid(),
    taggedMemberId: z.string().cuid().optional(),
    xPercent: coordinateSchema.optional(),
    yPercent: coordinateSchema.optional(),
  })
  .superRefine((input, ctx) => {
    if (
      input.taggedMemberId === undefined &&
      input.xPercent === undefined &&
      input.yPercent === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least one field to update",
      });
    }

    const hasOneCoordinate = input.xPercent !== undefined || input.yPercent !== undefined;
    const hasBothCoordinates = input.xPercent !== undefined && input.yPercent !== undefined;

    if (hasOneCoordinate && !hasBothCoordinates) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Both xPercent and yPercent are required together",
      });
    }
  });

const createVideoTagInputSchema = z.object({
  familyId: z.string().cuid(),
  postMediaId: z.string().cuid(),
  taggedMemberId: z.string().cuid(),
});

const updateVideoTagInputSchema = z.object({
  familyId: z.string().cuid(),
  tagId: z.string().cuid(),
  taggedMemberId: z.string().cuid(),
});

const deleteTagInputSchema = z.object({
  familyId: z.string().cuid(),
  tagId: z.string().cuid(),
});

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
      role: true,
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

async function requireTaggableMedia(postMediaId: string, familyId: string, db: PrismaClient) {
  const media = await db.postMedia.findFirst({
    where: {
      id: postMediaId,
      post: {
        authorMember: {
          familyId,
        },
      },
    },
    select: {
      id: true,
      type: true,
      post: {
        select: {
          id: true,
          authorMemberId: true,
        },
      },
    },
  });

  if (!media) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Media not found",
    });
  }

  return media;
}

async function requireMediaWithTag(tagId: string, familyId: string, db: PrismaClient) {
  const media = await db.postMedia.findFirst({
    where: {
      post: {
        authorMember: {
          familyId,
        },
      },
      mediaTags: {
        some: {
          id: tagId,
        },
      },
    },
    select: {
      id: true,
      type: true,
      post: {
        select: {
          authorMemberId: true,
        },
      },
      mediaTags: {
        where: {
          id: tagId,
        },
        take: 1,
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
  });

  if (!media || media.mediaTags.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Tag not found",
    });
  }

  const tag = media.mediaTags[0];

  if (!tag) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Tag not found",
    });
  }

  return {
    media,
    tag,
  };
}

function ensureCanManageTags(input: {
  callerMemberId: string;
  callerRole: "OWNER" | "ADMIN" | "MEMBER";
  postAuthorMemberId: string;
}) {
  const isAdmin = input.callerRole === "OWNER" || input.callerRole === "ADMIN";
  const isPostAuthor = input.callerMemberId === input.postAuthorMemberId;

  if (!isAdmin && !isPostAuthor) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the post author or a family admin can manage tags",
    });
  }
}

async function ensureTaggedMemberInFamily(familyId: string, memberId: string, db: PrismaClient) {
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
      message: "Tagged member not found in this family",
    });
  }
}

async function ensureTagNotDuplicate(input: {
  postMediaId: string;
  taggedMemberId: string;
  db: PrismaClient;
  ignoreTagId?: string;
}) {
  const existing = await input.db.postMedia.findFirst({
    where: {
      id: input.postMediaId,
      mediaTags: {
        some: {
          taggedMemberId: input.taggedMemberId,
          ...(input.ignoreTagId ? { id: { not: input.ignoreTagId } } : {}),
        },
      },
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This member is already tagged in this media",
    });
  }
}

function mapTagResponse(tag: {
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
}) {
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
      avatarUrl: tag.taggedMember.image,
      status: tag.taggedMember.userId ? ("claimed" as const) : ("unclaimed" as const),
    },
    // Reserved field for future timeline/moment extensions.
    timeline: null,
  };
}

export const tagRouter = createTRPCRouter({
  listTagsByMedia: protectedProcedure
    .input(listTagsByMediaInputSchema)
    .query(async ({ ctx, input }) => {
      await requireFamilyMembership(input.familyId, ctx.session.user.id, ctx.db);

      const media = await ctx.db.postMedia.findFirst({
        where: {
          id: input.postMediaId,
          post: {
            authorMember: {
              familyId: input.familyId,
            },
          },
        },
        select: {
          mediaTags: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
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
      });

      if (!media) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Media not found",
        });
      }

      return {
        items: media.mediaTags.map((tag) => mapTagResponse(tag)),
      };
    }),

  createPhotoTag: protectedProcedure
    .input(createPhotoTagInputSchema)
    .mutation(async ({ ctx, input }) => {
      const membership = await requireFamilyMembership(input.familyId, ctx.session.user.id, ctx.db);
      const media = await requireTaggableMedia(input.postMediaId, input.familyId, ctx.db);

      ensureCanManageTags({
        callerMemberId: membership.id,
        callerRole: membership.role,
        postAuthorMemberId: media.post.authorMemberId,
      });

      if (media.type !== "IMAGE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Photo tags can only be created on image media",
        });
      }

      await ensureTaggedMemberInFamily(input.familyId, input.taggedMemberId, ctx.db);
      await ensureTagNotDuplicate({
        postMediaId: media.id,
        taggedMemberId: input.taggedMemberId,
        db: ctx.db,
      });

      const updatedMedia = await ctx.db.postMedia.update({
        where: {
          id: media.id,
        },
        data: {
          mediaTags: {
            create: {
              taggedMemberId: input.taggedMemberId,
              xPercent: input.xPercent,
              yPercent: input.yPercent,
            },
          },
        },
        select: {
          mediaTags: {
            where: {
              taggedMemberId: input.taggedMemberId,
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 1,
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
      });

      const created = updatedMedia.mediaTags[0];

      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create photo tag",
        });
      }

      return mapTagResponse(created);
    }),

  updatePhotoTag: protectedProcedure
    .input(updatePhotoTagInputSchema)
    .mutation(async ({ ctx, input }) => {
      const membership = await requireFamilyMembership(input.familyId, ctx.session.user.id, ctx.db);
      const existing = await requireMediaWithTag(input.tagId, input.familyId, ctx.db);

      ensureCanManageTags({
        callerMemberId: membership.id,
        callerRole: membership.role,
        postAuthorMemberId: existing.media.post.authorMemberId,
      });

      if (existing.media.type !== "IMAGE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Photo tags can only be updated on image media",
        });
      }

      const nextTaggedMemberId = input.taggedMemberId ?? existing.tag.taggedMemberId;
      await ensureTaggedMemberInFamily(input.familyId, nextTaggedMemberId, ctx.db);
      await ensureTagNotDuplicate({
        postMediaId: existing.tag.postMediaId,
        taggedMemberId: nextTaggedMemberId,
        ignoreTagId: existing.tag.id,
        db: ctx.db,
      });

      const updatedMedia = await ctx.db.postMedia.update({
        where: {
          id: existing.media.id,
        },
        data: {
          mediaTags: {
            update: {
              where: {
                id: existing.tag.id,
              },
              data: {
                taggedMemberId: nextTaggedMemberId,
                ...(input.xPercent !== undefined && input.yPercent !== undefined
                  ? {
                      xPercent: input.xPercent,
                      yPercent: input.yPercent,
                    }
                  : {}),
              },
            },
          },
        },
        select: {
          mediaTags: {
            where: {
              id: existing.tag.id,
            },
            take: 1,
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
      });

      const updated = updatedMedia.mediaTags[0];

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update photo tag",
        });
      }

      return mapTagResponse(updated);
    }),

  createVideoTag: protectedProcedure
    .input(createVideoTagInputSchema)
    .mutation(async ({ ctx, input }) => {
      const membership = await requireFamilyMembership(input.familyId, ctx.session.user.id, ctx.db);
      const media = await requireTaggableMedia(input.postMediaId, input.familyId, ctx.db);

      ensureCanManageTags({
        callerMemberId: membership.id,
        callerRole: membership.role,
        postAuthorMemberId: media.post.authorMemberId,
      });

      if (media.type !== "VIDEO") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Video tags can only be created on video media",
        });
      }

      await ensureTaggedMemberInFamily(input.familyId, input.taggedMemberId, ctx.db);
      await ensureTagNotDuplicate({
        postMediaId: media.id,
        taggedMemberId: input.taggedMemberId,
        db: ctx.db,
      });

      const updatedMedia = await ctx.db.postMedia.update({
        where: {
          id: media.id,
        },
        data: {
          mediaTags: {
            create: {
              taggedMemberId: input.taggedMemberId,
              xPercent: null,
              yPercent: null,
            },
          },
        },
        select: {
          mediaTags: {
            where: {
              taggedMemberId: input.taggedMemberId,
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 1,
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
      });

      const created = updatedMedia.mediaTags[0];

      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create video tag",
        });
      }

      return mapTagResponse(created);
    }),

  updateVideoTag: protectedProcedure
    .input(updateVideoTagInputSchema)
    .mutation(async ({ ctx, input }) => {
      const membership = await requireFamilyMembership(input.familyId, ctx.session.user.id, ctx.db);
      const existing = await requireMediaWithTag(input.tagId, input.familyId, ctx.db);

      ensureCanManageTags({
        callerMemberId: membership.id,
        callerRole: membership.role,
        postAuthorMemberId: existing.media.post.authorMemberId,
      });

      if (existing.media.type !== "VIDEO") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Video tags can only be updated on video media",
        });
      }

      await ensureTaggedMemberInFamily(input.familyId, input.taggedMemberId, ctx.db);
      await ensureTagNotDuplicate({
        postMediaId: existing.tag.postMediaId,
        taggedMemberId: input.taggedMemberId,
        ignoreTagId: existing.tag.id,
        db: ctx.db,
      });

      const updatedMedia = await ctx.db.postMedia.update({
        where: {
          id: existing.media.id,
        },
        data: {
          mediaTags: {
            update: {
              where: {
                id: existing.tag.id,
              },
              data: {
                taggedMemberId: input.taggedMemberId,
                xPercent: null,
                yPercent: null,
              },
            },
          },
        },
        select: {
          mediaTags: {
            where: {
              id: existing.tag.id,
            },
            take: 1,
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
      });

      const updated = updatedMedia.mediaTags[0];

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update video tag",
        });
      }

      return mapTagResponse(updated);
    }),

  deleteTag: protectedProcedure.input(deleteTagInputSchema).mutation(async ({ ctx, input }) => {
    const membership = await requireFamilyMembership(input.familyId, ctx.session.user.id, ctx.db);
    const existing = await requireMediaWithTag(input.tagId, input.familyId, ctx.db);

    ensureCanManageTags({
      callerMemberId: membership.id,
      callerRole: membership.role,
      postAuthorMemberId: existing.media.post.authorMemberId,
    });

    await ctx.db.postMedia.update({
      where: {
        id: existing.media.id,
      },
      data: {
        mediaTags: {
          delete: {
            id: existing.tag.id,
          },
        },
      },
    });

    return {
      success: true as const,
      deletedTagId: existing.tag.id,
    };
  }),
});
