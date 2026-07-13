import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedEnv = vi.hoisted(() => ({
  DATABASE_URL: "postgresql://user:pass@localhost:5432/fircle_test",
  SELF_HOSTED: true,
  STORAGE_DRIVER: "r2",
  NODE_ENV: "test",
  EMAIL_FROM_ADDRESS: "no-reply@example.com",
  EMAIL_FROM_NAME: "Fircle",
}));

vi.mock("~/env", () => ({
  env: mockedEnv,
}));

vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: {},
}));

vi.mock("~/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockReturnValue({ ok: true }),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("~/server/notifications", () => ({
  createNotifications: vi.fn().mockResolvedValue([]),
  dispatchPushForNotifications: vi.fn().mockResolvedValue(undefined),
  getClaimedAdminMemberIds: vi.fn().mockResolvedValue(["clh0000000000000000000302"]),
  getClaimedMemberIds: vi.fn().mockResolvedValue([]),
}));

vi.mock("~/server/email", () => ({
  getEmailProvider: vi.fn().mockReturnValue(null),
  resolveAppBaseUrlFromHeaders: vi.fn().mockReturnValue("https://fircle.example.com"),
  buildInviteCreatedTemplate: vi.fn().mockReturnValue({
    subject: "Invite subject",
    html: "<p>Invite html</p>",
    text: "Invite text",
    actionUrl: "https://fircle.example.com/auth/invite/INVITE_CODE_123456",
  }),
  buildClaimLinkCreatedTemplate: vi.fn().mockReturnValue({
    subject: "Claim link subject",
    html: "<p>Claim link html</p>",
    text: "Claim link text",
    actionUrl: "https://fircle.example.com/auth/claim/CLAIM_TOKEN_123",
  }),
  buildSentDeliveryResult: vi.fn().mockImplementation((result: { acceptedAt: Date }) => ({
    status: "sent" as const,
    acceptedAt: result.acceptedAt.toISOString(),
  })),
  buildSkippedDeliveryResult: vi.fn().mockImplementation((reason: string) => ({
    status: "skipped" as const,
    reasonCode: reason,
    message: `skipped:${reason}`,
  })),
  buildFailedDeliveryResult: vi.fn().mockImplementation(() => ({
    status: "failed" as const,
    reasonCode: "provider_error",
    message: "provider error",
  })),
}));

import { inviteRouter } from "~/server/api/routers/invite";
import {
  buildClaimLinkCreatedTemplate,
  buildInviteCreatedTemplate,
  getEmailProvider,
  resolveAppBaseUrlFromHeaders,
} from "~/server/email";
import {
  createNotifications,
  dispatchPushForNotifications,
  getClaimedAdminMemberIds,
} from "~/server/notifications";

const dispatchPushForNotificationsMock = vi.mocked(dispatchPushForNotifications);

function createCaller(db: unknown, userId = "user-1") {
  return inviteRouter.createCaller({
    db,
    session: {
      user: { id: userId },
    },
    headers: new Headers(),
  } as never);
}

describe("inviteRouter notification producers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  const familyId = "clh0000000000000000000002";
  const actorMemberId = "clh0000000000000000000301";

  it("emits INVITE_CREATED notifications to claimed admins when creating an invite", async () => {
    const invite = {
      id: "clh0000000000000000005001",
      code: "INVITE_CODE_123456",
      type: "OPEN",
      invitedEmail: null,
      familyId,
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
      expiresAt: new Date("2030-01-08T00:00:00.000Z"),
      status: "PENDING",
    };

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: actorMemberId,
          familyId,
          role: "ADMIN",
        }),
      },
      invite: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(invite),
      },
      user: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(async (callback: (txArg: Record<string, never>) => Promise<unknown>) => callback({})),
    } as never;

    const caller = createCaller(db);

    const result = await caller.createInvite({
      familyId,
      type: "OPEN",
      expiresInDays: 7,
    });

    expect(result.id).toBe(invite.id);
    expect(getClaimedAdminMemberIds).toHaveBeenCalledWith({}, familyId, [actorMemberId]);
    expect(createNotifications).toHaveBeenCalledWith(
      {},
      [
        expect.objectContaining({
          familyId,
          recipientMemberId: "clh0000000000000000000302",
          actorMemberId,
          category: "INVITE",
          eventType: "INVITE_CREATED",
          sourceType: "invite",
          sourceId: invite.id,
        }),
      ],
    );
    expect(dispatchPushForNotificationsMock).toHaveBeenCalledWith([]);
  });

  it("sends invite-created email for EMAIL_BOUND invites when provider is configured", async () => {
    const send = vi.fn().mockResolvedValue({
      driver: "zeptomail",
      providerMessageId: "req-1",
      acceptedAt: new Date(),
    });
    vi.mocked(getEmailProvider).mockReturnValue({
      driver: "zeptomail",
      send,
    });

    const invite = {
      id: "clh0000000000000000005010",
      code: "INVITE_CODE_123456",
      type: "EMAIL_BOUND",
      invitedEmail: "invitee@example.com",
      familyId,
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
      expiresAt: new Date("2030-01-08T00:00:00.000Z"),
      status: "PENDING",
      family: {
        name: "Ng",
      },
    };

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: actorMemberId,
          familyId,
          role: "ADMIN",
        }),
      },
      invite: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(invite),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(async (callback: (txArg: Record<string, never>) => Promise<unknown>) => callback({})),
    } as never;

    const caller = createCaller(db);

    const result = await caller.createInvite({
      familyId,
      type: "EMAIL_BOUND",
      invitedEmail: "invitee@example.com",
      expiresInDays: 7,
    });

    expect(result.id).toBe(invite.id);
    expect(resolveAppBaseUrlFromHeaders).toHaveBeenCalled();
    expect(buildInviteCreatedTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        familyName: "Ng",
        inviteCode: invite.code,
      }),
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "invite-created",
        to: { email: "invitee@example.com" },
      }),
    );
  });

  it("does not fail invite creation when provider send throws", async () => {
    const send = vi.fn().mockRejectedValue(new Error("provider down"));
    vi.mocked(getEmailProvider).mockReturnValue({
      driver: "zeptomail",
      send,
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const invite = {
      id: "clh0000000000000000005011",
      code: "INVITE_CODE_987654",
      type: "EMAIL_BOUND",
      invitedEmail: "invitee@example.com",
      familyId,
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
      expiresAt: new Date("2030-01-08T00:00:00.000Z"),
      status: "PENDING",
      family: {
        name: "Ng",
      },
    };

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: actorMemberId,
          familyId,
          role: "ADMIN",
        }),
      },
      invite: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(invite),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(async (callback: (txArg: Record<string, never>) => Promise<unknown>) => callback({})),
    } as never;

    const caller = createCaller(db);

    await expect(
      caller.createInvite({
        familyId,
        type: "EMAIL_BOUND",
        invitedEmail: "invitee@example.com",
        expiresInDays: 7,
      }),
    ).resolves.toMatchObject({
      id: invite.id,
    });
  });

  it("skips email send when no provider is configured and still succeeds", async () => {
    vi.mocked(getEmailProvider).mockReturnValue(null);

    const invite = {
      id: "clh0000000000000000005012",
      code: "INVITE_CODE_555555",
      type: "EMAIL_BOUND",
      invitedEmail: "invitee@example.com",
      familyId,
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
      expiresAt: new Date("2030-01-08T00:00:00.000Z"),
      status: "PENDING",
      family: {
        name: "Ng",
      },
    };

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: actorMemberId,
          familyId,
          role: "ADMIN",
        }),
      },
      invite: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(invite),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(async (callback: (txArg: Record<string, never>) => Promise<unknown>) => callback({})),
    } as never;

    const caller = createCaller(db);

    await expect(
      caller.createInvite({
        familyId,
        type: "EMAIL_BOUND",
        invitedEmail: "invitee@example.com",
        expiresInDays: 7,
      }),
    ).resolves.toMatchObject({
      id: invite.id,
    });

    expect(buildInviteCreatedTemplate).not.toHaveBeenCalled();
  });
});

describe("inviteRouter reusable family links", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  const familyId = "clh0000000000000000007001";
  const actorMemberId = "clh0000000000000000007002";

  it("returns the active reusable invite for a family", async () => {
    const reusableInvite = {
      id: "clh0000000000000000007010",
      code: "REUSABLE_ACTIVE_CODE",
      familyId,
      isReusable: true,
      status: "PENDING",
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
      updatedAt: new Date("2030-01-01T00:00:00.000Z"),
      revokedAt: null,
      rotatedFromInviteId: null,
      useCount: 2,
      lastUsedAt: new Date("2030-01-02T00:00:00.000Z"),
      claimMemberId: null,
    };

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: actorMemberId,
          familyId,
          role: "ADMIN",
        }),
      },
      invite: {
        findFirst: vi.fn().mockResolvedValue(reusableInvite),
      },
    } as never;

    const result = await createCaller(db).getActiveReusableInvite({ familyId });

    expect(result).toMatchObject({
      id: reusableInvite.id,
      code: reusableInvite.code,
      isReusable: true,
      lifecycleState: "valid",
      useCount: 2,
    });
  });

  it("returns null when no reusable invite exists", async () => {
    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: actorMemberId,
          familyId,
          role: "OWNER",
        }),
      },
      invite: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as never;

    const result = await createCaller(db).getActiveReusableInvite({ familyId });
    expect(result).toBeNull();
  });

  it("resetReusableInvite revokes the previous active link and creates a new reusable link", async () => {
    const activeReusableInvite = {
      id: "clh0000000000000000007020",
      code: "OLD_REUSABLE_CODE",
      familyId,
      isReusable: true,
      status: "PENDING",
      revokedAt: null,
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
      updatedAt: new Date("2030-01-01T00:00:00.000Z"),
      rotatedFromInviteId: null,
      useCount: 4,
      lastUsedAt: null,
      claimMemberId: null,
    };
    const newReusableInvite = {
      id: "clh0000000000000000007021",
      code: "NEW_REUSABLE_CODE",
      familyId,
      isReusable: true,
      status: "PENDING",
      revokedAt: null,
      createdAt: new Date("2030-01-02T00:00:00.000Z"),
      updatedAt: new Date("2030-01-02T00:00:00.000Z"),
      rotatedFromInviteId: activeReusableInvite.id,
      useCount: 0,
      lastUsedAt: null,
    };

    const tx = {
      invite: {
        findFirst: vi.fn().mockResolvedValue(activeReusableInvite),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(newReusableInvite),
      },
    };

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({ id: actorMemberId, familyId, role: "ADMIN" }),
      },
      $transaction: vi.fn(async (cb: (txArg: typeof tx) => Promise<unknown>) => cb(tx)),
    } as never;

    const result = await createCaller(db).resetReusableInvite({ familyId });

    expect(tx.invite.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ familyId, isReusable: true, status: "PENDING" }),
        data: expect.objectContaining({ status: "REVOKED" }),
      }),
    );
    expect(tx.invite.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          familyId,
          isReusable: true,
          type: "OPEN",
          rotatedFromInviteId: activeReusableInvite.id,
        }),
      }),
    );
    expect(result).toMatchObject({
      id: newReusableInvite.id,
      code: newReusableInvite.code,
      isReusable: true,
      lifecycleState: "valid",
    });
  });

  it("acceptInvite allows reusable invites even when expiresAt is in the past and increments usage", async () => {
    const reusableInvite = {
      id: "clh0000000000000000007030",
      code: "REUSABLE_JOIN_CODE",
      type: "OPEN",
      status: "PENDING",
      familyId,
      invitedEmail: null,
      createdById: "creator-1",
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
      claimedAt: null,
      claimedById: null,
      claimMemberId: null,
      revokedAt: null,
      isReusable: true,
      useCount: 0,
      lastUsedAt: null,
    };
    const tx = {
      user: {
        create: vi.fn().mockResolvedValue({ id: "user-new", email: "new@example.com" }),
      },
      invite: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      familyMember: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "member-new" }),
      },
    };
    const db = {
      invite: {
        findUnique: vi.fn().mockResolvedValue(reusableInvite),
      },
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(async (cb: (txArg: typeof tx) => Promise<unknown>) => cb(tx)),
    } as never;

    const result = await inviteRouter.createCaller({
      db,
      session: null,
      headers: new Headers(),
    } as never).acceptInvite({
      code: reusableInvite.code,
      email: "new@example.com",
      password: "password123",
      name: "New User",
    });

    expect(result).toMatchObject({ userId: "user-new", email: "new@example.com" });
    expect(tx.invite.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: reusableInvite.id, isReusable: true, status: "PENDING" }),
        data: expect.objectContaining({
          useCount: { increment: 1 },
        }),
      }),
    );
  });

  it("getByCode accepts reusable invites without treating past expiresAt as invalid", async () => {
    const reusableInvite = {
      id: "clh0000000000000000007040",
      code: "REUSABLE_PUBLIC_CODE",
      familyId,
      type: "OPEN",
      invitedEmail: null,
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
      status: "PENDING",
      claimedAt: null,
      revokedAt: null,
      isReusable: true,
      family: {
        id: familyId,
        name: "Ng",
        description: "Family description",
      },
    };

    const db = {
      invite: {
        findUnique: vi.fn().mockResolvedValue(reusableInvite),
      },
    } as never;

    const result = await inviteRouter.createCaller({
      db,
      session: null,
      headers: new Headers(),
    } as never).getByCode({ code: reusableInvite.code });

    expect(result).toMatchObject({
      id: reusableInvite.id,
      code: reusableInvite.code,
      isReusable: true,
      family: {
        id: familyId,
      },
    });
  });
});

describe("inviteRouter.createInvite email delivery status", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  const familyId = "clh0000000000000000000003";
  const actorMemberId = "clh0000000000000000000401";

  function makeDb(invite: Record<string, unknown>) {
    return {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({ id: actorMemberId, familyId, role: "ADMIN" }),
      },
      invite: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(invite),
      },
      user: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (cb: (txArg: Record<string, never>) => Promise<unknown>) => cb({})),
    } as never;
  }

  it("returns emailDelivery.status 'sent' for EMAIL_BOUND createInvite when provider sends", async () => {
    const acceptedAt = new Date("2030-06-01T00:00:00.000Z");
    const send = vi.fn().mockResolvedValue({ driver: "zeptomail", providerMessageId: "msg-invite-1", acceptedAt });
    vi.mocked(getEmailProvider).mockReturnValue({ driver: "zeptomail", send });

    const db = makeDb({
      id: "clh0000000000000000005020",
      code: "INV_SENT_CODE",
      type: "EMAIL_BOUND",
      invitedEmail: "inv-sent@example.com",
      familyId,
      createdAt: new Date(),
      expiresAt: new Date("2030-01-08T00:00:00.000Z"),
      status: "PENDING",
      family: { name: "Test" },
    });

    const caller = createCaller(db);
    const result = await caller.createInvite({ familyId, type: "EMAIL_BOUND", invitedEmail: "inv-sent@example.com", expiresInDays: 7 });

    expect(result.emailDelivery).toMatchObject({ status: "sent" });
  });

  it("returns emailDelivery.status 'skipped' for EMAIL_BOUND createInvite when no provider configured", async () => {
    vi.mocked(getEmailProvider).mockReturnValue(null);

    const db = makeDb({
      id: "clh0000000000000000005021",
      code: "INV_SKIP_CODE",
      type: "EMAIL_BOUND",
      invitedEmail: "inv-skip@example.com",
      familyId,
      createdAt: new Date(),
      expiresAt: new Date("2030-01-08T00:00:00.000Z"),
      status: "PENDING",
      family: { name: "Test" },
    });

    const caller = createCaller(db);
    const result = await caller.createInvite({ familyId, type: "EMAIL_BOUND", invitedEmail: "inv-skip@example.com", expiresInDays: 7 });

    expect(result.emailDelivery).toMatchObject({ status: "skipped", reasonCode: "provider_not_configured" });
  });

  it("returns emailDelivery.status 'failed' for EMAIL_BOUND createInvite when provider throws", async () => {
    const send = vi.fn().mockRejectedValue(new Error("send failure"));
    vi.mocked(getEmailProvider).mockReturnValue({ driver: "zeptomail", send });

    const db = makeDb({
      id: "clh0000000000000000005022",
      code: "INV_FAIL_CODE",
      type: "EMAIL_BOUND",
      invitedEmail: "inv-fail@example.com",
      familyId,
      createdAt: new Date(),
      expiresAt: new Date("2030-01-08T00:00:00.000Z"),
      status: "PENDING",
      family: { name: "Test" },
    });

    const caller = createCaller(db);
    const result = await caller.createInvite({ familyId, type: "EMAIL_BOUND", invitedEmail: "inv-fail@example.com", expiresInDays: 7 });

    expect(result.emailDelivery).toMatchObject({ status: "failed", reasonCode: "provider_error" });
  });

  it("returns emailDelivery null for OPEN createInvite", async () => {
    const db = makeDb({
      id: "clh0000000000000000005023",
      code: "INV_OPEN_CODE",
      type: "OPEN",
      invitedEmail: null,
      familyId,
      createdAt: new Date(),
      expiresAt: new Date("2030-01-08T00:00:00.000Z"),
      status: "PENDING",
      family: { name: "Test" },
    });

    const caller = createCaller(db);
    const result = await caller.createInvite({ familyId, type: "OPEN", expiresInDays: 7 });

    expect(result.emailDelivery).toBeNull();
  });
});

describe("inviteRouter.retryEmailSend", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  const familyId = "clh0000000000000000000004";
  const inviteId = "clh0000000000000000009001";
  const membershipId = "clh0000000000000000000501";

  const pendingEmailBoundInvite = {
    id: inviteId,
    code: "RETRY_INVITE_CODE",
    type: "EMAIL_BOUND",
    invitedEmail: "retry@example.com",
    familyId,
    status: "PENDING",
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    claimedAt: null,
    revokedAt: null,
    claimMemberId: null,
    family: { name: "Retry" },
    claimMember: null,
  };

  function makeDb(invite: unknown, memberRole = "ADMIN") {
    return {
      invite: { findUnique: vi.fn().mockResolvedValue(invite) },
      familyMember: {
        findUnique: vi.fn().mockResolvedValue(
          memberRole ? { id: membershipId, familyId, userId: "user-1", role: memberRole } : null,
        ),
      },
    } as never;
  }

  it("sends email and returns 'sent' for a valid pending email-bound invite", async () => {
    const acceptedAt = new Date("2030-06-01T00:00:00.000Z");
    const send = vi.fn().mockResolvedValue({ driver: "zeptomail", providerMessageId: "retry-msg-1", acceptedAt });
    vi.mocked(getEmailProvider).mockReturnValue({ driver: "zeptomail", send });

    const caller = createCaller(makeDb(pendingEmailBoundInvite));
    const result = await caller.retryEmailSend({ inviteId });

    expect(result.emailDelivery).toMatchObject({ status: "sent" });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ event: "invite-created", to: { email: "retry@example.com" } }));
  });

  it("returns 'skipped' with provider_not_configured when no provider is set up", async () => {
    vi.mocked(getEmailProvider).mockReturnValue(null);

    const caller = createCaller(makeDb(pendingEmailBoundInvite));
    const result = await caller.retryEmailSend({ inviteId });

    expect(result.emailDelivery).toMatchObject({ status: "skipped", reasonCode: "provider_not_configured" });
  });

  it("returns 'failed' when provider send throws", async () => {
    const send = vi.fn().mockRejectedValue(new Error("network error"));
    vi.mocked(getEmailProvider).mockReturnValue({ driver: "zeptomail", send });

    const caller = createCaller(makeDb(pendingEmailBoundInvite));
    const result = await caller.retryEmailSend({ inviteId });

    expect(result.emailDelivery).toMatchObject({ status: "failed", reasonCode: "provider_error" });
  });

  it("uses claim-link-created event for claim-link invites", async () => {
    const acceptedAt = new Date("2030-06-01T00:00:00.000Z");
    const send = vi.fn().mockResolvedValue({ driver: "zeptomail", providerMessageId: "retry-cl-1", acceptedAt });
    vi.mocked(getEmailProvider).mockReturnValue({ driver: "zeptomail", send });

    const claimLinkInvite = { ...pendingEmailBoundInvite, id: "clh0000000000000000009002", claimMemberId: "clh0000000000000000000502", claimMember: { name: "Grandma Mary" } };
    const caller = createCaller(makeDb(claimLinkInvite));
    await caller.retryEmailSend({ inviteId: claimLinkInvite.id });

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ event: "claim-link-created" }));
    expect(buildClaimLinkCreatedTemplate).toHaveBeenCalledWith(expect.objectContaining({ memberName: "Grandma Mary" }));
  });

  it("throws NOT_FOUND when invite does not exist", async () => {
    const caller = createCaller(makeDb(null));

    await expect(caller.retryEmailSend({ inviteId })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws FORBIDDEN when caller is not admin or owner", async () => {
    const caller = createCaller(makeDb(pendingEmailBoundInvite, "MEMBER"));

    await expect(caller.retryEmailSend({ inviteId })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws FORBIDDEN when caller has no family membership", async () => {
    const db = {
      invite: { findUnique: vi.fn().mockResolvedValue(pendingEmailBoundInvite) },
      familyMember: { findUnique: vi.fn().mockResolvedValue(null) },
    } as never;

    await expect(createCaller(db).retryEmailSend({ inviteId })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws BAD_REQUEST when invite is OPEN (not EMAIL_BOUND)", async () => {
    const openInvite = { ...pendingEmailBoundInvite, id: "clh0000000000000000009003", type: "OPEN", invitedEmail: null };
    const caller = createCaller(makeDb(openInvite));

    await expect(caller.retryEmailSend({ inviteId: openInvite.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws BAD_REQUEST with 'expired' message when invite is expired", async () => {
    const expiredInvite = { ...pendingEmailBoundInvite, id: "clh0000000000000000009004", status: "PENDING", expiresAt: new Date("2020-01-01T00:00:00.000Z") };
    const caller = createCaller(makeDb(expiredInvite));
    const retryCall = caller.retryEmailSend({ inviteId: expiredInvite.id });

    await expect(retryCall).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(retryCall).rejects.toThrow(/expired/i);
  });

  it("throws BAD_REQUEST with 'revoked' message when invite is revoked", async () => {
    const revokedInvite = { ...pendingEmailBoundInvite, id: "clh0000000000000000009005", status: "REVOKED", revokedAt: new Date() };
    const caller = createCaller(makeDb(revokedInvite));
    const retryCall = caller.retryEmailSend({ inviteId: revokedInvite.id });

    await expect(retryCall).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(retryCall).rejects.toThrow(/revoked/i);
  });

  it("throws BAD_REQUEST with 'claimed' message when invite is already claimed", async () => {
    const claimedInvite = { ...pendingEmailBoundInvite, id: "clh0000000000000000009006", status: "CLAIMED", claimedAt: new Date() };
    const caller = createCaller(makeDb(claimedInvite));
    const retryCall = caller.retryEmailSend({ inviteId: claimedInvite.id });

    await expect(retryCall).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(retryCall).rejects.toThrow(/claimed/i);
  });
});

