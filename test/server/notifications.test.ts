import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, sendPushMock, isPushConfiguredMock } = vi.hoisted(() => ({
  dbMock: {
    notificationDeliveryLog: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    notificationPreference: {
      findFirst: vi.fn(),
    },
    pushSubscription: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    comment: {
      findUnique: vi.fn(),
    },
    mediaTag: {
      findUnique: vi.fn(),
    },
  },
  sendPushMock: vi.fn(),
  isPushConfiguredMock: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: dbMock,
}));

vi.mock("~/server/push", () => ({
  sendPush: sendPushMock,
  isPushConfigured: isPushConfiguredMock,
}));

import {
  createNotifications,
  dispatchPushForNotifications,
  type NotificationSeed,
} from "~/server/notifications";

type NotificationTxMock = {
  notification: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  notificationDeliveryLog: {
    createMany: ReturnType<typeof vi.fn>;
  };
};

function createTxMock(): NotificationTxMock {
  return {
    notification: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "notification-1" }),
    },
    notificationDeliveryLog: {
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
  };
}

describe("notifications module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPushConfiguredMock.mockReturnValue(true);
  });

  it("creates IN_APP and PUSH delivery logs when push is configured", async () => {
    const tx = createTxMock();
    const seeds: NotificationSeed[] = [
      {
        familyId: "clh0000000000000000000002",
        recipientMemberId: "clh0000000000000000000301",
        actorMemberId: "clh0000000000000000000302",
        category: "MENTION",
        eventType: "POST_MENTION_CREATED",
        sourceType: "postMention",
        sourceId: "post-1",
        title: "Mention",
        body: "You were mentioned",
      },
    ];

    const created = await createNotifications(tx as never, seeds);

    expect(created).toEqual([
      expect.objectContaining({
        id: "notification-1",
        eventType: "POST_MENTION_CREATED",
      }),
    ]);
    expect(tx.notificationDeliveryLog.createMany).toHaveBeenCalledWith({
      data: [
        {
          notificationId: "notification-1",
          channel: "IN_APP",
          status: "QUEUED",
        },
        {
          notificationId: "notification-1",
          channel: "PUSH",
          status: "PENDING",
        },
      ],
    });
  });

  it("marks PUSH delivery as SKIPPED when interaction type is disabled", async () => {
    dbMock.notificationDeliveryLog.findFirst.mockResolvedValue({
      id: "delivery-1",
      attemptCount: 0,
    });
    dbMock.notificationPreference.findFirst.mockResolvedValue({
      isEnabled: false,
    });

    await dispatchPushForNotifications([
      {
        id: "notification-1",
        familyId: "clh0000000000000000000002",
        recipientMemberId: "clh0000000000000000000301",
        eventType: "POST_LIKED",
        title: "Post liked",
        body: "Someone liked your post",
        sourceType: "postLike",
        sourceId: "post-1",
      },
    ]);

    expect(sendPushMock).not.toHaveBeenCalled();
    expect(dbMock.notificationDeliveryLog.update).toHaveBeenCalledWith({
      where: { id: "delivery-1" },
      data: {
        status: "SKIPPED",
        errorMessage: "Push disabled for this interaction type",
      },
    });
  });

  it("moves delivery log from QUEUED to SENT when provider send succeeds", async () => {
    dbMock.notificationDeliveryLog.findFirst.mockResolvedValue({
      id: "delivery-1",
      attemptCount: 1,
    });
    dbMock.notificationPreference.findFirst.mockResolvedValue(null);
    dbMock.pushSubscription.findMany.mockResolvedValue([
      {
        endpoint: "https://push.example.com/sub-1",
        p256dh: "p256dh",
        auth: "auth",
      },
    ]);
    sendPushMock.mockResolvedValue({
      outcome: "SENT",
      providerMessageId: "provider-123",
    });

    await dispatchPushForNotifications([
      {
        id: "notification-1",
        familyId: "clh0000000000000000000002",
        recipientMemberId: "clh0000000000000000000301",
        eventType: "INVITE_CREATED",
        title: "Invite created",
        body: "An invite was created",
        sourceType: "invite",
        sourceId: "invite-1",
      },
    ]);

    expect(dbMock.notificationDeliveryLog.update).toHaveBeenNthCalledWith(1, {
      where: { id: "delivery-1" },
      data: {
        status: "QUEUED",
        errorMessage: null,
      },
    });

    expect(dbMock.notificationDeliveryLog.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: "delivery-1" },
        data: expect.objectContaining({
          status: "SENT",
          attemptCount: 2,
          providerMessageId: "provider-123",
          errorMessage: null,
        }),
      }),
    );

    expect(dbMock.pushSubscription.updateMany).toHaveBeenCalledWith({
      where: { endpoint: "https://push.example.com/sub-1" },
      data: {
        lastUsedAt: expect.any(Date),
      },
    });
  });

  it("cleans up invalid subscriptions and marks delivery as SKIPPED", async () => {
    dbMock.notificationDeliveryLog.findFirst.mockResolvedValue({
      id: "delivery-1",
      attemptCount: 0,
    });
    dbMock.notificationPreference.findFirst.mockResolvedValue(null);
    dbMock.pushSubscription.findMany.mockResolvedValue([
      {
        endpoint: "https://push.example.com/stale-sub",
        p256dh: "p256dh",
        auth: "auth",
      },
    ]);
    sendPushMock.mockResolvedValue({
      outcome: "INVALID_SUBSCRIPTION",
      errorMessage: "Terminal error: 410 Gone",
    });

    await dispatchPushForNotifications([
      {
        id: "notification-1",
        familyId: "clh0000000000000000000002",
        recipientMemberId: "clh0000000000000000000301",
        eventType: "SYSTEM_EVENT",
        title: "System",
        body: "Body",
        sourceType: "system",
        sourceId: "sys-1",
      },
    ]);

    expect(dbMock.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: {
        endpoint: "https://push.example.com/stale-sub",
      },
    });
    expect(dbMock.notificationDeliveryLog.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: "delivery-1" },
        data: expect.objectContaining({
          status: "SKIPPED",
          errorMessage: "Terminal error: 410 Gone",
        }),
      }),
    );
  });
});
