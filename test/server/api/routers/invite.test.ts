import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: {},
}));

vi.mock("~/server/notifications", () => ({
  createNotifications: vi.fn().mockResolvedValue(undefined),
  getClaimedAdminMemberIds: vi.fn().mockResolvedValue(["clh0000000000000000000302"]),
  getClaimedMemberIds: vi.fn().mockResolvedValue([]),
}));

import { inviteRouter } from "~/server/api/routers/invite";
import { createNotifications, getClaimedAdminMemberIds } from "~/server/notifications";

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
  });
});
