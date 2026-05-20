import { describe, expect, it, vi, beforeEach } from "vitest";
import * as rateLimit from "~/lib/rate-limit";

vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: {},
}));

vi.mock("~/server/storage", () => ({
  getStorageProvider: () => ({
    driver: "r2",
    buildReadUrl: ({ bucket, objectKey }: { bucket: string; objectKey: string }) =>
      `/api/media/r2/${bucket}/${objectKey}`,
  }),
}));

import { createPostInputSchema, postRouter } from "~/server/api/routers/post";

describe("createPostInputSchema", () => {
  it("rejects text posts with media", () => {
    const result = createPostInputSchema.safeParse({
      familyId: "clh0000000000000000000000",
      caption: "Hello",
      type: "TEXT",
      media: [
        {
          provider: "r2",
          bucket: "fircle",
          objectKey: "families/a/posts/b.jpg",
          url: "/api/media/r2/fircle/families/a/posts/b.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 100,
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});

describe("postRouter.create", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const familyId = "clh0000000000000000000002";

  it("persists mixed-media posts and returns ordered media metadata", async () => {
    const postCreate = vi.fn().mockResolvedValue({ id: "post-1" });
    const postMediaCreateMany = vi.fn().mockResolvedValue({ count: 2 });
    const postFindUnique = vi.fn().mockResolvedValue({
      id: "post-1",
      type: "MIXED",
      caption: "Family road trip",
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
      authorMember: {
        id: "member-1",
        name: "Parent One",
        slug: "parent-one",
        image: null,
      },
      likes: [],
      _count: {
        likes: 0,
      },
      media: [
        {
          id: "media-1",
          type: "IMAGE",
          provider: "r2",
          bucket: "fircle",
          objectKey: "families/fam-1/members/member-1/posts/2030/01/01/image/a.jpg",
          url: "/api/media/r2/fircle/families/fam-1/members/member-1/posts/2030/01/01/image/a.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 111,
          width: 1200,
          height: 900,
          durationMs: null,
          caption: "Arrival photo",
          sortOrder: 0,
          createdAt: new Date("2030-01-01T00:00:00.000Z"),
        },
        {
          id: "media-2",
          type: "VIDEO",
          provider: "r2",
          bucket: "fircle",
          objectKey: "families/fam-1/members/member-1/posts/2030/01/01/video/b.mp4",
          url: "/api/media/r2/fircle/families/fam-1/members/member-1/posts/2030/01/01/video/b.mp4",
          mimeType: "video/mp4",
          sizeBytes: 222,
          width: null,
          height: null,
          durationMs: 64000,
          caption: "Drive video",
          sortOrder: 1,
          createdAt: new Date("2030-01-01T00:00:00.000Z"),
        },
      ],
    });

    const tx = {
      post: {
        create: postCreate,
        findUnique: postFindUnique,
      },
      postMedia: {
        createMany: postMediaCreateMany,
      },
    };

    const familyMemberFindUnique = vi.fn().mockResolvedValue({
      id: "member-1",
      familyId,
      name: "Parent One",
      image: null,
    });

    const db = {
      familyMember: {
        findUnique: familyMemberFindUnique,
      },
      $transaction: vi.fn(async (callback: (txArg: typeof tx) => Promise<unknown>) => callback(tx)),
    } as never;

    const caller = postRouter.createCaller({
      db,
      session: {
        user: { id: "user-1" },
      },
      headers: new Headers(),
    } as never);

    const result = await caller.create({
      familyId,
      caption: "Family road trip",
      type: "MIXED",
      media: [
        {
          provider: "r2",
          bucket: "fircle",
          objectKey: "families/fam-1/members/member-1/posts/2030/01/01/image/a.jpg",
          url: "/api/media/r2/fircle/families/fam-1/members/member-1/posts/2030/01/01/image/a.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 111,
          width: 1200,
          height: 900,
          caption: "Arrival photo",
        },
        {
          provider: "r2",
          bucket: "fircle",
          objectKey: "families/fam-1/members/member-1/posts/2030/01/01/video/b.mp4",
          url: "/api/media/r2/fircle/families/fam-1/members/member-1/posts/2030/01/01/video/b.mp4",
          mimeType: "video/mp4",
          sizeBytes: 222,
          durationMs: 64000,
          caption: "Drive video",
        },
      ],
    });

    expect(familyMemberFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          familyId_userId: { familyId, userId: "user-1" },
        },
      }),
    );
    expect(postCreate).toHaveBeenCalledTimes(1);
    expect(postMediaCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            sortOrder: 0,
            caption: "Arrival photo",
          }),
          expect.objectContaining({
            sortOrder: 1,
            caption: "Drive video",
          }),
        ],
      }),
    );
    expect(result.type).toBe("MIXED");
    expect(result.media).toHaveLength(2);
    expect(result.media[0]?.url).toContain("/api/media/r2/");
    expect(result.mediaItems[1]?.durationLabel).toBe("01:04");
    expect(result.reactionCount).toBe(0);
    expect(result.likedByCurrentUser).toBe(false);
  });

  it("rejects users without family membership", async () => {
    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(),
    } as never;

    const caller = postRouter.createCaller({
      db,
      session: {
        user: { id: "user-1" },
      },
      headers: new Headers(),
    } as never);

    await expect(
      caller.create({
        familyId,
        caption: "Hello",
        type: "TEXT",
        media: [],
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("postRouter.toggleLike", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const familyId = "clh0000000000000000000002";
  const postId = "clh0000000000000000000003";

  it("creates a like when none exists", async () => {
    vi.spyOn(rateLimit, "checkRateLimit").mockReturnValue({ ok: true });

    const familyMemberFindUnique = vi.fn().mockResolvedValue({
      id: "member-1",
      familyId,
      name: "Parent One",
      image: null,
    });

    const postFindFirst = vi.fn().mockResolvedValue({ id: "post-1" });
    const postLikeFindUnique = vi.fn().mockResolvedValue(null);
    const postLikeCreate = vi.fn().mockResolvedValue({ id: "like-1" });
    const postLikeDelete = vi.fn();
    const postLikeCount = vi.fn().mockResolvedValue(4);

    const tx = {
      postLike: {
        findUnique: postLikeFindUnique,
        create: postLikeCreate,
        delete: postLikeDelete,
        count: postLikeCount,
      },
    };

    const db = {
      familyMember: {
        findUnique: familyMemberFindUnique,
      },
      post: {
        findFirst: postFindFirst,
      },
      $transaction: vi.fn(async (callback: (txArg: typeof tx) => Promise<unknown>) => callback(tx)),
    } as never;

    const caller = postRouter.createCaller({
      db,
      session: {
        user: { id: "user-1" },
      },
      headers: new Headers(),
    } as never);

    const result = await caller.toggleLike({
      familyId,
      postId,
    });

    expect(postLikeCreate).toHaveBeenCalledWith({
      data: {
        postId: "post-1",
        memberIdWhoLiked: "member-1",
      },
    });
    expect(postLikeDelete).not.toHaveBeenCalled();
    expect(result).toEqual({
      postId: "post-1",
      likedByCurrentUser: true,
      reactionCount: 4,
    });
  });

  it("removes an existing like", async () => {
    vi.spyOn(rateLimit, "checkRateLimit").mockReturnValue({ ok: true });

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: "member-1",
          familyId,
          name: "Parent One",
          image: null,
        }),
      },
      post: {
        findFirst: vi.fn().mockResolvedValue({ id: "post-1" }),
      },
      $transaction: vi.fn(async (callback: (txArg: {
        postLike: {
          findUnique: ReturnType<typeof vi.fn>;
          create: ReturnType<typeof vi.fn>;
          delete: ReturnType<typeof vi.fn>;
          count: ReturnType<typeof vi.fn>;
        };
      }) => Promise<unknown>) =>
        callback({
          postLike: {
            findUnique: vi.fn().mockResolvedValue({ id: "like-1" }),
            create: vi.fn(),
            delete: vi.fn().mockResolvedValue({ id: "like-1" }),
            count: vi.fn().mockResolvedValue(2),
          },
        })),
    } as never;

    const caller = postRouter.createCaller({
      db,
      session: {
        user: { id: "user-1" },
      },
      headers: new Headers(),
    } as never);

    const result = await caller.toggleLike({
      familyId,
      postId,
    });

    expect(result).toEqual({
      postId: "post-1",
      likedByCurrentUser: false,
      reactionCount: 2,
    });
  });

  it("rejects users without family membership", async () => {
    vi.spyOn(rateLimit, "checkRateLimit").mockReturnValue({ ok: true });

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      post: {
        findFirst: vi.fn(),
      },
      $transaction: vi.fn(),
    } as never;

    const caller = postRouter.createCaller({
      db,
      session: {
        user: { id: "user-1" },
      },
      headers: new Headers(),
    } as never);

    await expect(
      caller.toggleLike({
        familyId,
        postId,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects when post is not in the family", async () => {
    vi.spyOn(rateLimit, "checkRateLimit").mockReturnValue({ ok: true });

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: "member-1",
          familyId,
          name: "Parent One",
          image: null,
        }),
      },
      post: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(),
    } as never;

    const caller = postRouter.createCaller({
      db,
      session: {
        user: { id: "user-1" },
      },
      headers: new Headers(),
    } as never);

    await expect(
      caller.toggleLike({
        familyId,
        postId,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("enforces rate limits", async () => {
    vi.spyOn(rateLimit, "checkRateLimit").mockReturnValue({ ok: false, retryAfterMs: 1000 });

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: "member-1",
          familyId,
          name: "Parent One",
          image: null,
        }),
      },
      post: {
        findFirst: vi.fn(),
      },
      $transaction: vi.fn(),
    } as never;

    const caller = postRouter.createCaller({
      db,
      session: {
        user: { id: "user-1" },
      },
      headers: new Headers(),
    } as never);

    await expect(
      caller.toggleLike({
        familyId,
        postId,
      }),
    ).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });
});

describe("postRouter comments", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const familyId = "clh0000000000000000000002";
  const postId = "clh0000000000000000000003";
  const commentId = "clh0000000000000000000010";

  it("creates a top-level comment", async () => {
    vi.spyOn(rateLimit, "checkRateLimit").mockReturnValue({ ok: true });

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: "member-1",
          familyId,
          name: "Parent One",
          image: null,
        }),
      },
      post: {
        findFirst: vi.fn().mockResolvedValue({ id: postId }),
      },
      comment: {
        findFirst: vi.fn(),
        create: vi.fn().mockResolvedValue({
          id: commentId,
          postId,
          parentCommentId: null,
          content: "Great update",
          createdAt: new Date("2030-01-01T00:00:00.000Z"),
          updatedAt: new Date("2030-01-01T00:00:00.000Z"),
          authorMember: {
            id: "member-1",
            name: "Parent One",
            slug: "parent-one",
            image: null,
          },
          likes: [],
          _count: {
            likes: 0,
            replies: 0,
          },
        }),
      },
    } as never;

    const caller = postRouter.createCaller({
      db,
      session: {
        user: { id: "user-1" },
      },
      headers: new Headers(),
    } as never);

    const result = await caller.createComment({
      familyId,
      postId,
      content: "Great update",
    });

    expect(result).toMatchObject({
      id: commentId,
      postId,
      content: "Great update",
      likedByCurrentUser: false,
      likeCount: 0,
      replyCount: 0,
    });
  });

  it("rejects replies when parent comment is missing or not top-level", async () => {
    vi.spyOn(rateLimit, "checkRateLimit").mockReturnValue({ ok: true });

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: "member-1",
          familyId,
          name: "Parent One",
          image: null,
        }),
      },
      post: {
        findFirst: vi.fn().mockResolvedValue({ id: postId }),
      },
      comment: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
    } as never;

    const caller = postRouter.createCaller({
      db,
      session: {
        user: { id: "user-1" },
      },
      headers: new Headers(),
    } as never);

    await expect(
      caller.createComment({
        familyId,
        postId,
        content: "Reply text",
        parentCommentId: "clh0000000000000000000099",
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("enforces comment creation rate limits", async () => {
    vi.spyOn(rateLimit, "checkRateLimit").mockReturnValue({ ok: false, retryAfterMs: 1000 });

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: "member-1",
          familyId,
          name: "Parent One",
          image: null,
        }),
      },
      post: {
        findFirst: vi.fn(),
      },
      comment: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    } as never;

    const caller = postRouter.createCaller({
      db,
      session: {
        user: { id: "user-1" },
      },
      headers: new Headers(),
    } as never);

    await expect(
      caller.createComment({
        familyId,
        postId,
        content: "Great update",
      }),
    ).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });

  it("rejects updating a comment owned by another member", async () => {
    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: "member-1",
          familyId,
          name: "Parent One",
          image: null,
        }),
      },
      comment: {
        findFirst: vi.fn().mockResolvedValue({
          id: commentId,
          authorMemberId: "member-2",
        }),
        update: vi.fn(),
      },
    } as never;

    const caller = postRouter.createCaller({
      db,
      session: {
        user: { id: "user-1" },
      },
      headers: new Headers(),
    } as never);

    await expect(
      caller.updateComment({
        familyId,
        commentId,
        content: "Updated text",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects deleting a comment owned by another member", async () => {
    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: "member-1",
          familyId,
          name: "Parent One",
          image: null,
        }),
      },
      comment: {
        findFirst: vi.fn().mockResolvedValue({
          id: commentId,
          authorMemberId: "member-2",
          postId,
        }),
        delete: vi.fn(),
      },
    } as never;

    const caller = postRouter.createCaller({
      db,
      session: {
        user: { id: "user-1" },
      },
      headers: new Headers(),
    } as never);

    await expect(
      caller.deleteComment({
        familyId,
        commentId,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("toggles a comment like and returns current count", async () => {
    vi.spyOn(rateLimit, "checkRateLimit").mockReturnValue({ ok: true });

    const tx = {
      commentLike: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "comment-like-1" }),
        delete: vi.fn(),
        count: vi.fn().mockResolvedValue(3),
      },
    };

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: "member-1",
          familyId,
          name: "Parent One",
          image: null,
        }),
      },
      comment: {
        findFirst: vi.fn().mockResolvedValue({ id: commentId }),
      },
      $transaction: vi.fn(async (callback: (txArg: typeof tx) => Promise<unknown>) => callback(tx)),
    } as never;

    const caller = postRouter.createCaller({
      db,
      session: {
        user: { id: "user-1" },
      },
      headers: new Headers(),
    } as never);

    const result = await caller.toggleCommentLike({
      familyId,
      commentId,
    });

    expect(result).toEqual({
      commentId,
      likedByCurrentUser: true,
      likeCount: 3,
    });
  });

  it("enforces rate limits for comment likes", async () => {
    vi.spyOn(rateLimit, "checkRateLimit").mockReturnValue({ ok: false, retryAfterMs: 1000 });

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: "member-1",
          familyId,
          name: "Parent One",
          image: null,
        }),
      },
      comment: {
        findFirst: vi.fn(),
      },
      $transaction: vi.fn(),
    } as never;

    const caller = postRouter.createCaller({
      db,
      session: {
        user: { id: "user-1" },
      },
      headers: new Headers(),
    } as never);

    await expect(
      caller.toggleCommentLike({
        familyId,
        commentId,
      }),
    ).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });

  it("returns paginated comments", async () => {
    const createdAt = new Date("2030-01-01T00:00:00.000Z");

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: "member-1",
          familyId,
          name: "Parent One",
          image: null,
        }),
      },
      post: {
        findFirst: vi.fn().mockResolvedValue({ id: postId }),
      },
      comment: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([
          {
            id: commentId,
            postId,
            parentCommentId: null,
            content: "Top-level comment",
            createdAt,
            updatedAt: createdAt,
            authorMember: {
              id: "member-2",
              name: "Parent Two",
              slug: "parent-two",
              image: null,
            },
            likes: [{ id: "like-1" }],
            _count: {
              likes: 1,
              replies: 0,
            },
            replies: [],
          },
        ]),
      },
    } as never;

    const caller = postRouter.createCaller({
      db,
      session: {
        user: { id: "user-1" },
      },
      headers: new Headers(),
    } as never);

    const result = await caller.getComments({
      familyId,
      postId,
      limit: 20,
    });

    expect(result.nextCursor).toBeNull();
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: commentId,
      likedByCurrentUser: true,
      likeCount: 1,
      replyCount: 0,
    });
  });
});
