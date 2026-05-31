import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: {},
}));

vi.mock("~/server/email", () => ({
  getEmailProvider: vi.fn().mockReturnValue(null),
  resolveAppBaseUrlFromHeaders: vi.fn().mockReturnValue("https://fircle.example.com"),
  buildClaimLinkCreatedTemplate: vi.fn().mockReturnValue({
    subject: "Claim link subject",
    html: "<p>Claim link html</p>",
    text: "Claim link text",
    actionUrl: "https://fircle.example.com/auth/claim/CLAIM_TOKEN_123",
  }),
}));

import { familyMemberRouter } from "~/server/api/routers/family-member";
import {
  buildClaimLinkCreatedTemplate,
  getEmailProvider,
} from "~/server/email";

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
    const currentPasswordHash = await bcrypt.hash("current-password", 8);
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
    const currentPasswordHash = await bcrypt.hash("current-password", 8);

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
    type UpdateMemberProfileCall = {
      where: { id: string };
      data: { name: string; image: string | null };
    };
    const firstUpdateCall = familyMemberUpdate.mock.calls[0]?.[0] as UpdateMemberProfileCall | undefined;
    expect(firstUpdateCall).toBeDefined();
    expect(familyMemberUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: targetMemberId },
      }),
    );
    expect(firstUpdateCall?.data).toMatchObject({
      name: "Updated Name",
      image: "https://example.com/avatar.jpg",
    });
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

describe("familyMemberRouter claim-link email delivery", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("sends claim-link-created email for createClaimLink when EMAIL_BOUND", async () => {
    const send = vi.fn().mockResolvedValue({
      driver: "zeptomail",
      providerMessageId: "req-claim-link",
      acceptedAt: new Date(),
    });
    vi.mocked(getEmailProvider).mockReturnValue({
      driver: "zeptomail",
      send,
    });

    const familyId = "clh0000000000000000000201";
    const memberId = "clh0000000000000000000202";

    const db = {
      familyMember: {
        findUnique: vi.fn((args: { where: { id?: string; familyId_userId?: { familyId: string; userId: string } } }) => {
          if (args.where.id === memberId) {
            return Promise.resolve({
              id: memberId,
              familyId,
              userId: null,
              name: "Grandma Mary",
            });
          }

          return Promise.resolve({
            id: "clh0000000000000000000203",
            familyId,
            userId: "user-1",
            role: "ADMIN",
          });
        }),
      },
      invite: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({
          id: "clh0000000000000000007001",
          code: "CLAIM_TOKEN_123",
          type: "EMAIL_BOUND",
          invitedEmail: "claim@example.com",
          familyId,
          expiresAt: new Date("2031-01-01T00:00:00.000Z"),
          status: "PENDING",
        }),
      },
      family: {
        findUnique: vi.fn().mockResolvedValue({ name: "Ng Family" }),
      },
    } as never;

    const caller = createCaller(db);

    await caller.createClaimLink({
      familyMemberId: memberId,
      invitedEmail: "claim@example.com",
      expiresInDays: 30,
    });

    expect(buildClaimLinkCreatedTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        familyName: "Ng Family",
        memberName: "Grandma Mary",
        claimToken: "CLAIM_TOKEN_123",
      }),
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "claim-link-created",
        to: { email: "claim@example.com" },
      }),
    );
  });

  it("does not fail createUnclaimedMember when claim-link email send throws", async () => {
    const send = vi.fn().mockRejectedValue(new Error("provider down"));
    vi.mocked(getEmailProvider).mockReturnValue({
      driver: "zeptomail",
      send,
    });

    const familyId = "clh0000000000000000000204";

    const tx = {
      invite: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: "clh0000000000000000007002",
          code: "CLAIM_TOKEN_456",
          type: "EMAIL_BOUND",
          invitedEmail: "newmember@example.com",
          expiresAt: new Date("2031-01-01T00:00:00.000Z"),
        }),
      },
      familyMember: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: "clh0000000000000000000205",
          familyId,
          name: "New Member",
          nickname: null,
          slug: "new-member",
          image: null,
        }),
      },
    };

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: "clh0000000000000000000206",
          familyId,
          userId: "user-1",
          role: "ADMIN",
        }),
      },
      family: {
        findUnique: vi.fn().mockResolvedValue({ name: "Ng Family" }),
      },
      $transaction: vi.fn(async (callback: (txArg: typeof tx) => Promise<unknown>) => callback(tx)),
    } as never;

    const caller = createCaller(db);

    await expect(
      caller.createUnclaimedMember({
        familyId,
        name: "New Member",
        email: "newmember@example.com",
      }),
    ).resolves.toMatchObject({
      status: "unclaimed",
      claimInvite: {
        code: "CLAIM_TOKEN_456",
      },
    });
  });

  it("skips email send when no provider is configured and still succeeds", async () => {
    vi.mocked(getEmailProvider).mockReturnValue(null);

    const familyId = "clh0000000000000000000207";
    const memberId = "clh0000000000000000000208";

    const db = {
      familyMember: {
        findUnique: vi.fn((args: { where: { id?: string; familyId_userId?: { familyId: string; userId: string } } }) => {
          if (args.where.id === memberId) {
            return Promise.resolve({
              id: memberId,
              familyId,
              userId: null,
              name: "Grandpa Joe",
            });
          }

          return Promise.resolve({
            id: "clh0000000000000000000209",
            familyId,
            userId: "user-1",
            role: "ADMIN",
          });
        }),
      },
      invite: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({
          id: "clh0000000000000000007003",
          code: "CLAIM_TOKEN_789",
          type: "EMAIL_BOUND",
          invitedEmail: "claim@example.com",
          familyId,
          expiresAt: new Date("2031-01-01T00:00:00.000Z"),
          status: "PENDING",
        }),
      },
      family: {
        findUnique: vi.fn().mockResolvedValue({ name: "Ng Family" }),
      },
    } as never;

    const caller = createCaller(db);

    await expect(
      caller.createClaimLink({
        familyMemberId: memberId,
        invitedEmail: "claim@example.com",
        expiresInDays: 30,
      }),
    ).resolves.toMatchObject({
      code: "CLAIM_TOKEN_789",
    });

    expect(buildClaimLinkCreatedTemplate).not.toHaveBeenCalled();
  });
});
