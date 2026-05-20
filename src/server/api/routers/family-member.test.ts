import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: {},
}));

import { familyMemberRouter } from "~/server/api/routers/family-member";

function createCaller(db: unknown, userId = "user-1") {
  return familyMemberRouter.createCaller({
    db,
    session: {
      user: { id: userId },
    },
    headers: new Headers(),
  } as never);
}

describe("familyMemberRouter.changeMyPassword", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  const familyId = "clh0000000000000000000001";
  const userId = "user-1";
  const memberId = "clh0000000000000000000101";

  it("changes the password when the current password is valid", async () => {
    const currentPasswordHash = await bcrypt.hash("current-password", 12);
    const userUpdate = vi.fn().mockResolvedValue({ id: userId });

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: memberId,
          familyId,
          userId,
          role: "MEMBER",
        }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: userId,
          password: currentPasswordHash,
        }),
        update: userUpdate,
      },
    };

    const caller = createCaller(db);

    const result = await caller.changeMyPassword({
      familyId,
      currentPassword: "current-password",
      newPassword: "new-password1",
      confirmPassword: "new-password1",
    });

    expect(result).toEqual({ success: true });
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: userId },
      }),
    );

    const updatedPassword = userUpdate.mock.calls[0]?.[0]?.data?.password as string;
    expect(await bcrypt.compare("new-password1", updatedPassword)).toBe(true);
  });

  it("rejects the wrong current password", async () => {
    const currentPasswordHash = await bcrypt.hash("current-password", 12);

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: memberId,
          familyId,
          userId,
          role: "MEMBER",
        }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: userId,
          password: currentPasswordHash,
        }),
        update: vi.fn(),
      },
    };

    const caller = createCaller(db);

    await expect(
      caller.changeMyPassword({
        familyId,
        currentPassword: "wrong-password",
        newPassword: "new-password1",
        confirmPassword: "new-password1",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Current password is incorrect",
    });
  });

  it("rejects users without family membership", async () => {
    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    const caller = createCaller(db);

    await expect(
      caller.changeMyPassword({
        familyId,
        currentPassword: "current-password",
        newPassword: "new-password1",
        confirmPassword: "new-password1",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("familyMemberRouter.adminResetMemberPassword", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  const familyId = "clh0000000000000000000001";
  const otherFamilyId = "clh0000000000000000000009";
  const adminUserId = "admin-user";
  const targetUserId = "target-user";
  const adminMemberId = "clh0000000000000000000102";
  const targetMemberId = "clh0000000000000000000103";

  it("resets the password for a claimed member", async () => {
    const userUpdate = vi.fn().mockResolvedValue({ id: targetUserId });
    const familyMemberFindUnique = vi.fn((args: {
      where: { familyId_userId?: { familyId: string; userId: string }; id?: string };
    }) => {
      if (args.where.familyId_userId) {
        return Promise.resolve({
          id: adminMemberId,
          familyId,
          userId: adminUserId,
          role: "ADMIN",
        });
      }

      if (args.where.id === targetMemberId) {
        return Promise.resolve({
          id: targetMemberId,
          familyId,
          userId: targetUserId,
          name: "Target Member",
        });
      }

      return Promise.resolve(null);
    });

    const db = {
      familyMember: {
        findUnique: familyMemberFindUnique,
      },
      user: {
        update: userUpdate,
      },
    };

    const caller = createCaller(db, adminUserId);

    const result = await caller.adminResetMemberPassword({
      familyId,
      memberId: targetMemberId,
      temporaryPassword: "temporary-password1",
    });

    expect(result).toEqual({ success: true });
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: targetUserId },
      }),
    );

    const updatedPassword = userUpdate.mock.calls[0]?.[0]?.data?.password as string;
    expect(await bcrypt.compare("temporary-password1", updatedPassword)).toBe(true);
  });

  it("rejects a non-admin member", async () => {
    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: adminMemberId,
          familyId,
          userId: adminUserId,
          role: "MEMBER",
        }),
      },
      user: {
        update: vi.fn(),
      },
    };

    const caller = createCaller(db, adminUserId);

    await expect(
      caller.adminResetMemberPassword({
        familyId,
        memberId: targetMemberId,
        temporaryPassword: "temporary-password1",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects unclaimed members", async () => {
    const familyMemberFindUnique = vi.fn((args: {
      where: { familyId_userId?: { familyId: string; userId: string }; id?: string };
    }) => {
      if (args.where.familyId_userId) {
        return Promise.resolve({
          id: adminMemberId,
          familyId,
          userId: adminUserId,
          role: "OWNER",
        });
      }

      if (args.where.id === targetMemberId) {
        return Promise.resolve({
          id: targetMemberId,
          familyId,
          userId: null,
          name: "Unclaimed Member",
        });
      }

      return Promise.resolve(null);
    });

    const db = {
      familyMember: {
        findUnique: familyMemberFindUnique,
      },
      user: {
        update: vi.fn(),
      },
    };

    const caller = createCaller(db, adminUserId);

    await expect(
      caller.adminResetMemberPassword({
        familyId,
        memberId: targetMemberId,
        temporaryPassword: "temporary-password1",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("rejects cross-family member targeting", async () => {
    const familyMemberFindUnique = vi.fn((args: {
      where: { familyId_userId?: { familyId: string; userId: string }; id?: string };
    }) => {
      if (args.where.familyId_userId) {
        return Promise.resolve({
          id: adminMemberId,
          familyId,
          userId: adminUserId,
          role: "OWNER",
        });
      }

      if (args.where.id === targetMemberId) {
        return Promise.resolve({
          id: targetMemberId,
          familyId: otherFamilyId,
          userId: targetUserId,
          name: "Other Family Member",
        });
      }

      return Promise.resolve(null);
    });

    const db = {
      familyMember: {
        findUnique: familyMemberFindUnique,
      },
      user: {
        update: vi.fn(),
      },
    };

    const caller = createCaller(db, adminUserId);

    await expect(
      caller.adminResetMemberPassword({
        familyId,
        memberId: targetMemberId,
        temporaryPassword: "temporary-password1",
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("familyMemberRouter.updateMemberProfile", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  const familyId = "clh0000000000000000000001";
  const otherFamilyId = "clh0000000000000000000009";
  const ownerUserId = "owner-user";
  const memberUserId = "member-user";
  const ownerMemberId = "clh0000000000000000000104";
  const targetMemberId = "clh0000000000000000000105";

  it("allows a member to update their own profile", async () => {
    const familyMemberFindUnique = vi.fn((args: {
      where: { familyId_userId?: { familyId: string; userId: string }; id?: string };
    }) => {
      if (args.where.familyId_userId) {
        return Promise.resolve({
          id: targetMemberId,
          familyId,
          userId: memberUserId,
          role: "MEMBER",
        });
      }

      if (args.where.id === targetMemberId) {
        return Promise.resolve({
          id: targetMemberId,
          familyId,
        });
      }

      return Promise.resolve(null);
    });

    const familyMemberUpdate = vi.fn().mockResolvedValue({
      id: targetMemberId,
      familyId,
      name: "Updated Name",
      image: "https://example.com/avatar.jpg",
      slug: "target-member",
      userId: memberUserId,
      role: "MEMBER",
    });

    const db = {
      familyMember: {
        findUnique: familyMemberFindUnique,
        update: familyMemberUpdate,
      },
    };

    const caller = createCaller(db, memberUserId);

    const result = await caller.updateMemberProfile({
      familyId,
      memberId: targetMemberId,
      name: "Updated Name",
      image: "https://example.com/avatar.jpg",
    });

    expect(result).toMatchObject({
      id: targetMemberId,
      familyId,
      name: "Updated Name",
      image: "https://example.com/avatar.jpg",
      status: "claimed",
      role: "MEMBER",
    });
    expect(familyMemberUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: targetMemberId },
        data: {
          name: "Updated Name",
          image: "https://example.com/avatar.jpg",
        },
      }),
    );
  });

  it("rejects a non-admin member editing someone else", async () => {
    const familyMemberFindUnique = vi.fn((args: {
      where: { familyId_userId?: { familyId: string; userId: string }; id?: string };
    }) => {
      if (args.where.familyId_userId) {
        return Promise.resolve({
          id: ownerMemberId,
          familyId,
          userId: ownerUserId,
          role: "MEMBER",
        });
      }

      if (args.where.id === targetMemberId) {
        return Promise.resolve({
          id: targetMemberId,
          familyId,
        });
      }

      return Promise.resolve(null);
    });

    const db = {
      familyMember: {
        findUnique: familyMemberFindUnique,
        update: vi.fn(),
      },
    };

    const caller = createCaller(db, ownerUserId);

    await expect(
      caller.updateMemberProfile({
        familyId,
        memberId: targetMemberId,
        name: "Updated Name",
        image: null,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects cross-family member targeting", async () => {
    const familyMemberFindUnique = vi.fn((args: {
      where: { familyId_userId?: { familyId: string; userId: string }; id?: string };
    }) => {
      if (args.where.familyId_userId) {
        return Promise.resolve({
          id: ownerMemberId,
          familyId,
          userId: ownerUserId,
          role: "OWNER",
        });
      }

      if (args.where.id === targetMemberId) {
        return Promise.resolve({
          id: targetMemberId,
          familyId: otherFamilyId,
        });
      }

      return Promise.resolve(null);
    });

    const db = {
      familyMember: {
        findUnique: familyMemberFindUnique,
        update: vi.fn(),
      },
    };

    const caller = createCaller(db, ownerUserId);

    await expect(
      caller.updateMemberProfile({
        familyId,
        memberId: targetMemberId,
        name: "Updated Name",
        image: null,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
