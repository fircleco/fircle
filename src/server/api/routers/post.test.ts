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

describe("postRouter.getLikedPostsByMember", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const familyId = "clh0000000000000000000002";
  const memberId = "clh0000000000000000000007";

  it("returns paginated liked posts for a family member", async () => {
    const createdAt = new Date("2030-01-02T00:00:00.000Z");

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: "viewer-member",
          familyId,
          name: "Viewer",
          image: null,
        }),
        findFirst: vi.fn().mockResolvedValue({
          id: memberId,
        }),
      },
      post: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "post-1",
            type: "PHOTO",
            caption: "Liked post",
            createdAt,
            authorMember: {
              id: "author-1",
              name: "Poster",
              slug: "poster",
              image: null,
            },
            media: [],
            likes: [{ id: "like-1" }],
            _count: {
              likes: 3,
              comments: 1,
            },
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

    const result = await caller.getLikedPostsByMember({
      familyId,
      memberId,
      limit: 20,
    });

    expect(result.nextCursor).toBeNull();
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "post-1",
      caption: "Liked post",
      likedByCurrentUser: true,
      reactionCount: 3,
      commentCount: 1,
    });
  });

  it("rejects when target member is not in family", async () => {
    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: "viewer-member",
          familyId,
          name: "Viewer",
          image: null,
        }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      post: {
        findMany: vi.fn(),
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
      caller.getLikedPostsByMember({
        familyId,
        memberId,
        limit: 20,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("postRouter tag integrations", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const familyId = "clh0000000000000000000002";
  const memberId = "clh0000000000000000000007";
  const viewerMemberId = "clh0000000000000000000008";

  it("includes per-media tags and de-duplicated tagged members in getById", async () => {
    const createdAt = new Date("2030-01-04T00:00:00.000Z");

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: viewerMemberId,
          familyId,
          name: "Viewer",
          image: null,
        }),
      },
      post: {
        findFirst: vi.fn().mockResolvedValue({
          id: "post-1",
          type: "MIXED",
          caption: "Tagged memories",
          createdAt,
          authorMember: {
            id: "author-1",
            name: "Poster",
            slug: "poster",
            image: null,
          },
          media: [
            {
              id: "media-1",
              type: "IMAGE",
              provider: "r2",
              bucket: "fircle",
              objectKey: "families/fam-1/posts/image-1.jpg",
              url: "/api/media/r2/fircle/families/fam-1/posts/image-1.jpg",
              mimeType: "image/jpeg",
              sizeBytes: 100,
              width: 1200,
              height: 900,
              durationMs: null,
              caption: "Photo one",
              sortOrder: 0,
              createdAt,
              mediaTags: [
                {
                  id: "tag-1",
                  postMediaId: "media-1",
                  taggedMemberId: memberId,
                  xPercent: 25,
                  yPercent: 50,
                  createdAt,
                  updatedAt: createdAt,
                  taggedMember: {
                    id: memberId,
                    name: "Child One",
                    slug: "child-one",
                    image: null,
                    userId: "user-7",
                  },
                },
              ],
            },
            {
              id: "media-2",
              type: "VIDEO",
              provider: "r2",
              bucket: "fircle",
              objectKey: "families/fam-1/posts/video-1.mp4",
              url: "/api/media/r2/fircle/families/fam-1/posts/video-1.mp4",
              mimeType: "video/mp4",
              sizeBytes: 200,
              width: null,
              height: null,
              durationMs: 32000,
              caption: "Video one",
              sortOrder: 1,
              createdAt,
              mediaTags: [
                {
                  id: "tag-2",
                  postMediaId: "media-2",
                  taggedMemberId: memberId,
                  xPercent: null,
                  yPercent: null,
                  createdAt,
                  updatedAt: createdAt,
                  taggedMember: {
                    id: memberId,
                    name: "Child One",
                    slug: "child-one",
                    image: null,
                    userId: "user-7",
                  },
                },
                {
                  id: "tag-3",
                  postMediaId: "media-2",
                  taggedMemberId: "clh0000000000000000000009",
                  xPercent: null,
                  yPercent: null,
                  createdAt,
                  updatedAt: createdAt,
                  taggedMember: {
                    id: "clh0000000000000000000009",
                    name: "Parent Two",
                    slug: "parent-two",
                    image: "https://example.com/parent-two.jpg",
                    userId: null,
                  },
                },
              ],
            },
          ],
          likes: [{ id: "like-1" }],
          _count: {
            likes: 1,
            comments: 2,
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

    const result = await caller.getById({
      familyId,
      postId: "clh0000000000000000000011",
    });

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      id: "post-1",
      taggedMembers: [
        {
          name: "Child One",
          avatarUrl: "",
        },
        {
          name: "Parent Two",
          avatarUrl: "https://example.com/parent-two.jpg",
        },
      ],
    });
    expect(result?.media[0]?.tags).toMatchObject([
      {
        id: "tag-1",
        xPercent: 25,
        yPercent: 50,
        taggedMember: {
          id: memberId,
          avatarUrl: "",
          status: "claimed",
        },
        timeline: null,
      },
    ]);
    expect(result?.mediaItems[1]?.tags).toMatchObject([
      {
        id: "tag-2",
        xPercent: null,
        yPercent: null,
      },
      {
        id: "tag-3",
        taggedMember: {
          id: "clh0000000000000000000009",
          status: "unclaimed",
        },
      },
    ]);
  });

  it("returns post-unique tagged posts while preserving per-media tags", async () => {
    const createdAt = new Date("2030-01-05T00:00:00.000Z");
    const postFindMany = vi.fn().mockResolvedValue([
      {
        id: "post-1",
        type: "MIXED",
        caption: "Tagged post",
        createdAt,
        authorMember: {
          id: "author-1",
          name: "Poster",
          slug: "poster",
          image: null,
        },
        media: [
          {
            id: "media-1",
            type: "IMAGE",
            provider: "r2",
            bucket: "fircle",
            objectKey: "families/fam-1/posts/image-1.jpg",
            url: "/api/media/r2/fircle/families/fam-1/posts/image-1.jpg",
            mimeType: "image/jpeg",
            sizeBytes: 100,
            width: 1200,
            height: 900,
            durationMs: null,
            caption: null,
            sortOrder: 0,
            createdAt,
            mediaTags: [
              {
                id: "tag-1",
                postMediaId: "media-1",
                taggedMemberId: memberId,
                xPercent: 12,
                yPercent: 34,
                createdAt,
                updatedAt: createdAt,
                taggedMember: {
                  id: memberId,
                  name: "Child One",
                  slug: "child-one",
                  image: null,
                  userId: "user-7",
                },
              },
            ],
          },
          {
            id: "media-2",
            type: "VIDEO",
            provider: "r2",
            bucket: "fircle",
            objectKey: "families/fam-1/posts/video-1.mp4",
            url: "/api/media/r2/fircle/families/fam-1/posts/video-1.mp4",
            mimeType: "video/mp4",
            sizeBytes: 200,
            width: null,
            height: null,
            durationMs: 45000,
            caption: null,
            sortOrder: 1,
            createdAt,
            mediaTags: [
              {
                id: "tag-2",
                postMediaId: "media-2",
                taggedMemberId: memberId,
                xPercent: null,
                yPercent: null,
                createdAt,
                updatedAt: createdAt,
                taggedMember: {
                  id: memberId,
                  name: "Child One",
                  slug: "child-one",
                  image: null,
                  userId: "user-7",
                },
              },
            ],
          },
        ],
        likes: [],
        _count: {
          likes: 0,
          comments: 0,
        },
      },
    ]);

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: viewerMemberId,
          familyId,
          name: "Viewer",
          image: null,
        }),
        findFirst: vi.fn().mockResolvedValue({
          id: memberId,
        }),
      },
      post: {
        findMany: postFindMany,
      },
    } as never;

    const caller = postRouter.createCaller({
      db,
      session: {
        user: { id: "user-1" },
      },
      headers: new Headers(),
    } as never);

    const result = await caller.getTaggedPostsByMember({
      familyId,
      memberId,
      limit: 20,
    });

    const findManyArgs = postFindMany.mock.calls[0]?.[0] as {
      where: {
        media: {
          some: {
            mediaTags: {
              some: {
                taggedMemberId: string;
              };
            };
          };
        };
      };
    };

    expect(findManyArgs.where.media.some.mediaTags.some.taggedMemberId).toBe(memberId);
    expect(result.nextCursor).toBeNull();
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "post-1",
      taggedMembers: [
        {
          name: "Child One",
          avatarUrl: "",
        },
      ],
    });
    expect(result.items[0]?.media).toHaveLength(2);
    expect(result.items[0]?.media[0]?.tags).toMatchObject([
      {
        id: "tag-1",
        xPercent: 12,
        yPercent: 34,
      },
    ]);
    expect(result.items[0]?.media[1]?.tags).toMatchObject([
      {
        id: "tag-2",
        xPercent: null,
        yPercent: null,
      },
    ]);
  });

  it("rejects tagged-post lookup when the target member is outside the family", async () => {
    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: viewerMemberId,
          familyId,
          name: "Viewer",
          image: null,
        }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      post: {
        findMany: vi.fn(),
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
      caller.getTaggedPostsByMember({
        familyId,
        memberId,
        limit: 20,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
