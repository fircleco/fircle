import { describe, expect, it, vi, beforeEach } from "vitest";

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
        image: null,
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
