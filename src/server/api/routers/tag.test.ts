import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: {},
}));

import { tagRouter } from "~/server/api/routers/tag";

function createCaller(db: unknown, userId = "user-1") {
  return tagRouter.createCaller({
    db,
    session: {
      user: { id: userId },
    },
    headers: new Headers(),
  } as never);
}

describe("tagRouter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const familyId = "clh0000000000000000000002";
  const otherFamilyId = "clh0000000000000000000099";
  const imageMediaId = "clh0000000000000000000101";
  const videoMediaId = "clh0000000000000000000102";
  const tagId = "clh0000000000000000000201";
  const authorMemberId = "clh0000000000000000000301";
  const adminMemberId = "clh0000000000000000000302";
  const viewerMemberId = "clh0000000000000000000303";
  const taggedMemberId = "clh0000000000000000000401";
  const replacementTaggedMemberId = "clh0000000000000000000402";

  it("lists media tags for a family member", async () => {
    const createdAt = new Date("2030-01-01T00:00:00.000Z");

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: viewerMemberId,
          familyId,
          role: "MEMBER",
        }),
      },
      postMedia: {
        findFirst: vi.fn().mockResolvedValue({
          mediaTags: [
            {
              id: tagId,
              postMediaId: imageMediaId,
              taggedMemberId,
              xPercent: 24.5,
              yPercent: 60.25,
              createdAt,
              updatedAt: createdAt,
              taggedMember: {
                id: taggedMemberId,
                name: "Child One",
                slug: "child-one",
                image: null,
                userId: null,
              },
            },
          ],
        }),
      },
    } as never;

    const caller = createCaller(db);

    const result = await caller.listTagsByMedia({
      familyId,
      postMediaId: imageMediaId,
    });

    expect(result).toEqual({
      items: [
        {
          id: tagId,
          postMediaId: imageMediaId,
          taggedMemberId,
          xPercent: 24.5,
          yPercent: 60.25,
          createdAt,
          updatedAt: createdAt,
          taggedMember: {
            id: taggedMemberId,
            name: "Child One",
            slug: "child-one",
            avatarUrl: null,
            status: "unclaimed",
          },
          timeline: null,
        },
      ],
    });
  });

  it("creates a photo tag for the post author", async () => {
    const createdAt = new Date("2030-01-01T00:00:00.000Z");
    const postMediaUpdate = vi.fn().mockResolvedValue({
      mediaTags: [
        {
          id: tagId,
          postMediaId: imageMediaId,
          taggedMemberId,
          xPercent: 33,
          yPercent: 44,
          createdAt,
          updatedAt: createdAt,
          taggedMember: {
            id: taggedMemberId,
            name: "Child One",
            slug: "child-one",
            image: "https://example.com/avatar.jpg",
            userId: "user-9",
          },
        },
      ],
    });

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: authorMemberId,
          familyId,
          role: "MEMBER",
        }),
        findFirst: vi.fn().mockResolvedValue({
          id: taggedMemberId,
        }),
      },
      postMedia: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: imageMediaId,
            type: "IMAGE",
            post: {
              id: "post-1",
              authorMemberId,
            },
          })
          .mockResolvedValueOnce(null),
        update: postMediaUpdate,
      },
    } as never;

    const caller = createCaller(db);

    const result = await caller.createPhotoTag({
      familyId,
      postMediaId: imageMediaId,
      taggedMemberId,
      xPercent: 33,
      yPercent: 44,
    });

    expect(postMediaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: imageMediaId },
        data: {
          mediaTags: {
            create: {
              taggedMemberId,
              xPercent: 33,
              yPercent: 44,
            },
          },
        },
      }),
    );
    expect(result).toMatchObject({
      id: tagId,
      postMediaId: imageMediaId,
      taggedMemberId,
      xPercent: 33,
      yPercent: 44,
      timeline: null,
      taggedMember: {
        id: taggedMemberId,
        status: "claimed",
      },
    });
  });

  it("allows a family admin to create a video tag on another member's post", async () => {
    const createdAt = new Date("2030-01-02T00:00:00.000Z");

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: adminMemberId,
          familyId,
          role: "ADMIN",
        }),
        findFirst: vi.fn().mockResolvedValue({
          id: taggedMemberId,
        }),
      },
      postMedia: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: videoMediaId,
            type: "VIDEO",
            post: {
              id: "post-1",
              authorMemberId,
            },
          })
          .mockResolvedValueOnce(null),
        update: vi.fn().mockResolvedValue({
          mediaTags: [
            {
              id: tagId,
              postMediaId: videoMediaId,
              taggedMemberId,
              xPercent: null,
              yPercent: null,
              createdAt,
              updatedAt: createdAt,
              taggedMember: {
                id: taggedMemberId,
                name: "Child One",
                slug: "child-one",
                image: null,
                userId: "user-10",
              },
            },
          ],
        }),
      },
    } as never;

    const caller = createCaller(db, "admin-user");

    const result = await caller.createVideoTag({
      familyId,
      postMediaId: videoMediaId,
      taggedMemberId,
    });

    expect(result).toMatchObject({
      id: tagId,
      postMediaId: videoMediaId,
      taggedMemberId,
      xPercent: null,
      yPercent: null,
      timeline: null,
    });
  });

  it("rejects tag mutations from non-author non-admin members", async () => {
    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: viewerMemberId,
          familyId,
          role: "MEMBER",
        }),
      },
      postMedia: {
        findFirst: vi.fn().mockResolvedValue({
          id: imageMediaId,
          type: "IMAGE",
          post: {
            id: "post-1",
            authorMemberId,
          },
        }),
      },
    } as never;

    const caller = createCaller(db);

    await expect(
      caller.createPhotoTag({
        familyId,
        postMediaId: imageMediaId,
        taggedMemberId,
        xPercent: 10,
        yPercent: 20,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects tagging a member outside the current family", async () => {
    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: adminMemberId,
          familyId,
          role: "ADMIN",
        }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      postMedia: {
        findFirst: vi.fn().mockResolvedValue({
          id: videoMediaId,
          type: "VIDEO",
          post: {
            id: "post-1",
            authorMemberId,
          },
        }),
      },
    } as never;

    const caller = createCaller(db, "admin-user");

    await expect(
      caller.createVideoTag({
        familyId,
        postMediaId: videoMediaId,
        taggedMemberId: replacementTaggedMemberId,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("updates an existing photo tag", async () => {
    const createdAt = new Date("2030-01-03T00:00:00.000Z");
    const updatedAt = new Date("2030-01-03T00:05:00.000Z");

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: adminMemberId,
          familyId,
          role: "OWNER",
        }),
        findFirst: vi.fn().mockResolvedValue({
          id: replacementTaggedMemberId,
        }),
      },
      postMedia: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: imageMediaId,
            type: "IMAGE",
            post: {
              authorMemberId,
            },
            mediaTags: [
              {
                id: tagId,
                postMediaId: imageMediaId,
                taggedMemberId,
                xPercent: 10,
                yPercent: 15,
                createdAt,
                updatedAt: createdAt,
                taggedMember: {
                  id: taggedMemberId,
                  name: "Child One",
                  slug: "child-one",
                  image: null,
                  userId: null,
                },
              },
            ],
          })
          .mockResolvedValueOnce(null),
        update: vi.fn().mockResolvedValue({
          mediaTags: [
            {
              id: tagId,
              postMediaId: imageMediaId,
              taggedMemberId: replacementTaggedMemberId,
              xPercent: 66,
              yPercent: 77,
              createdAt,
              updatedAt,
              taggedMember: {
                id: replacementTaggedMemberId,
                name: "Child Two",
                slug: "child-two",
                image: null,
                userId: null,
              },
            },
          ],
        }),
      },
    } as never;

    const caller = createCaller(db, "owner-user");

    const result = await caller.updatePhotoTag({
      familyId,
      tagId,
      taggedMemberId: replacementTaggedMemberId,
      xPercent: 66,
      yPercent: 77,
    });

    expect(result).toMatchObject({
      id: tagId,
      taggedMemberId: replacementTaggedMemberId,
      xPercent: 66,
      yPercent: 77,
      updatedAt,
    });
  });

  it("deletes a tag when the caller can manage it", async () => {
    const update = vi.fn().mockResolvedValue({ id: imageMediaId });

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: adminMemberId,
          familyId,
          role: "ADMIN",
        }),
      },
      postMedia: {
        findFirst: vi.fn().mockResolvedValue({
          id: imageMediaId,
          type: "IMAGE",
          post: {
            authorMemberId,
          },
          mediaTags: [
            {
              id: tagId,
              postMediaId: imageMediaId,
              taggedMemberId,
              xPercent: 10,
              yPercent: 20,
              createdAt: new Date("2030-01-01T00:00:00.000Z"),
              updatedAt: new Date("2030-01-01T00:00:00.000Z"),
              taggedMember: {
                id: taggedMemberId,
                name: "Child One",
                slug: "child-one",
                image: null,
                userId: null,
              },
            },
          ],
        }),
        update,
      },
    } as never;

    const caller = createCaller(db, "admin-user");

    const result = await caller.deleteTag({
      familyId,
      tagId,
    });

    expect(update).toHaveBeenCalledWith({
      where: {
        id: imageMediaId,
      },
      data: {
        mediaTags: {
          delete: {
            id: tagId,
          },
        },
      },
    });
    expect(result).toEqual({
      success: true,
      deletedTagId: tagId,
    });
  });

  it("returns not found when media is outside the requested family scope", async () => {
    const membershipFindUnique = vi.fn().mockResolvedValue({
      id: adminMemberId,
      familyId: otherFamilyId,
      role: "ADMIN",
    });
    const mediaFindFirst = vi.fn().mockResolvedValue(null);

    const db = {
      familyMember: {
        findUnique: membershipFindUnique,
      },
      postMedia: {
        findFirst: mediaFindFirst,
      },
    } as never;

    const caller = createCaller(db, "admin-user");

    await expect(
      caller.listTagsByMedia({
        familyId: otherFamilyId,
        postMediaId: imageMediaId,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect(membershipFindUnique).toHaveBeenCalledWith({
      where: {
        familyId_userId: {
          familyId: otherFamilyId,
          userId: "admin-user",
        },
      },
      select: {
        id: true,
        familyId: true,
        role: true,
      },
    });
    expect(mediaFindFirst).toHaveBeenCalledWith({
      where: {
        id: imageMediaId,
        post: {
          authorMember: {
            familyId: otherFamilyId,
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
  });
});