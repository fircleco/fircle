import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: {},
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
}));

import { inviteRouter } from "~/server/api/routers/invite";
import {
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
        name: "Ng Family",
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
        familyName: "Ng Family",
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
        name: "Ng Family",
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
        name: "Ng Family",
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
