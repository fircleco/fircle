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
  let capturedLogs: string[] = [];

  beforeEach(() => {
    vi.restoreAllMocks();
    capturedLogs = [];
    vi.spyOn(console, "log").mockImplementation((message) => {
      capturedLogs.push(String(message));
    });
  });

  const familyId = "clh0000000000000000000001";
  const userId = "user-1";
  const memberId = "clh0000000000000000000101";

  it("changes the password when the current password is valid", async () => {
    const currentPasswordHash = await bcrypt.hash("current-password", 12);
    let updatedPassword: string | null = null;
    const userUpdate = vi
      .fn<
        (args: { where: { id: string }; data: { password: string } }) => Promise<{ id: string }>
      >()
      .mockImplementation(async (args) => {
        updatedPassword = args.data.password;
        return { id: userId };
      });

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

    expect(updatedPassword).not.toBeNull();
    expect(await bcrypt.compare("new-password1", updatedPassword!)).toBe(true);

    const securityLog = capturedLogs.find((entry) => entry.includes("security:password-changed"));
    expect(securityLog).toBeDefined();
    expect(securityLog).not.toContain("current-password");
    expect(securityLog).not.toContain("new-password1");
  });

  it("rejects the wrong current password", async () => {
    expect.assertions(3);

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

    try {
      await caller.changeMyPassword({
        familyId,
        currentPassword: "wrong-password",
        newPassword: "new-password1",
        confirmPassword: "new-password1",
      });
      throw new Error("Expected changeMyPassword to reject with wrong current password");
    } catch (error) {
      expect(error).toMatchObject({
        code: "BAD_REQUEST",
        message: "Current password is incorrect",
      });
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain("wrong-password");
      expect(message).not.toContain("new-password1");
    }
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
  let capturedLogs: string[] = [];

  beforeEach(() => {
    vi.restoreAllMocks();
    capturedLogs = [];
    vi.spyOn(console, "log").mockImplementation((message) => {
      capturedLogs.push(String(message));
    });
  });

  const familyId = "clh0000000000000000000001";
  const otherFamilyId = "clh0000000000000000000009";
  const adminUserId = "admin-user";
  const targetUserId = "target-user";
  const adminMemberId = "clh0000000000000000000102";
  const targetMemberId = "clh0000000000000000000103";

  it("resets the password for a claimed member", async () => {
    let updatedPassword: string | null = null;
    const userUpdate = vi
      .fn<
        (args: { where: { id: string }; data: { password: string } }) => Promise<{ id: string }>
      >()
      .mockImplementation(async (args) => {
        updatedPassword = args.data.password;
        return { id: targetUserId };
      });
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

    expect(updatedPassword).not.toBeNull();
    expect(await bcrypt.compare("temporary-password1", updatedPassword!)).toBe(true);

    const securityLog = capturedLogs.find((entry) => entry.includes("security:admin-password-reset"));
    expect(securityLog).toBeDefined();
    expect(securityLog).not.toContain("temporary-password1");
    expect(securityLog).not.toContain(targetUserId);
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
          slug: "target-member",
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
        data: expect.objectContaining({
          name: "Updated Name",
          image: "https://example.com/avatar.jpg",
        }),
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
