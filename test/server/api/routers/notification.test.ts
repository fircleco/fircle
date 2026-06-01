import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: {},
}));

vi.mock("~/env", () => ({
  env: {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-key",
    VAPID_PRIVATE_KEY: "private-key",
    VAPID_SUBJECT: "mailto:test@example.com",
  },
}));

import { notificationRouter } from "~/server/api/routers/notification";

function createCaller(db: unknown, userId = "user-1", headers = new Headers()) {
  return notificationRouter.createCaller({
    db,
    session: {
      user: { id: userId },
    },
    headers,
  } as never);
}

describe("notificationRouter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const familyId = "clh0000000000000000000002";
  const recipientMemberId = "clh0000000000000000000301";

  it("returns unread count scoped to the caller's family membership", async () => {
    const membershipFindUnique = vi.fn().mockResolvedValue({
      id: recipientMemberId,
      familyId,
    });
    const notificationCount = vi.fn().mockResolvedValue(4);

    const db = {
      familyMember: {
        findUnique: membershipFindUnique,
      },
      notification: {
        count: notificationCount,
      },
    } as never;

    const caller = createCaller(db);

    const result = await caller.getUnreadCount({ familyId });

    expect(result).toEqual({ count: 4 });
    expect(notificationCount).toHaveBeenCalledWith({
      where: {
        familyId,
        recipientMemberId,
        isRead: false,
      },
    });
  });

  it("returns ordered notifications with a stable cursor", async () => {
    const firstCreatedAt = new Date("2030-01-03T00:00:00.000Z");
    const secondCreatedAt = new Date("2030-01-02T00:00:00.000Z");
    const thirdCreatedAt = new Date("2030-01-01T00:00:00.000Z");

    const rows = [
      {
        id: "clh0000000000000000001003",
        familyId,
        recipientMemberId,
        actorMemberId: null,
        category: "SYSTEM",
        eventType: "SYSTEM_EVENT",
        sourceType: "system",
        sourceId: "system-1",
        title: "Newest",
        body: "Newest body",
        isRead: false,
        readAt: null,
        createdAt: firstCreatedAt,
        updatedAt: firstCreatedAt,
        actorMember: null,
      },
      {
        id: "clh0000000000000000001002",
        familyId,
        recipientMemberId,
        actorMemberId: null,
        category: "SYSTEM",
        eventType: "SYSTEM_EVENT",
        sourceType: "system",
        sourceId: "system-2",
        title: "Second",
        body: "Second body",
        isRead: false,
        readAt: null,
        createdAt: secondCreatedAt,
        updatedAt: secondCreatedAt,
        actorMember: null,
      },
      {
        id: "clh0000000000000000001001",
        familyId,
        recipientMemberId,
        actorMemberId: null,
        category: "SYSTEM",
        eventType: "SYSTEM_EVENT",
        sourceType: "system",
        sourceId: "system-3",
        title: "Third",
        body: "Third body",
        isRead: false,
        readAt: null,
        createdAt: thirdCreatedAt,
        updatedAt: thirdCreatedAt,
        actorMember: null,
      },
    ];

    const notificationFindMany = vi.fn().mockResolvedValue(rows);

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: recipientMemberId,
          familyId,
        }),
      },
      notification: {
        findMany: notificationFindMany,
      },
    } as never;

    await expect(
      createCaller(db).listByFamily({
        familyId,
        limit: 2,
      }),
    ).resolves.toMatchObject({
      items: [{ id: "clh0000000000000000001003" }, { id: "clh0000000000000000001002" }],
      nextCursor: "2030-01-02T00:00:00.000Z__clh0000000000000000001002",
    });
    expect(notificationFindMany).toHaveBeenCalledTimes(1);
    const findManyArgs = notificationFindMany.mock.calls[0]?.[0] as {
      take: number;
      where: {
        familyId: string;
        recipientMemberId: string;
      };
      orderBy: Array<Record<string, "desc">>;
    };
    expect(findManyArgs.take).toBe(3);
    expect(findManyArgs.where.familyId).toBe(familyId);
    expect(findManyArgs.where.recipientMemberId).toBe(recipientMemberId);
    expect(findManyArgs.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });

  it("rejects an invalid list cursor", async () => {
    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: recipientMemberId,
          familyId,
        }),
      },
      notification: {
        findMany: vi.fn(),
      },
    } as never;

    const caller = createCaller(db);

    await expect(
      caller.listByFamily({
        familyId,
        cursor: "invalid-cursor",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("marks a recipient-owned notification as read", async () => {
    const createdAt = new Date("2030-01-01T00:00:00.000Z");
    const unreadNotification = {
      id: "clh0000000000000000002001",
      familyId,
      recipientMemberId,
      actorMemberId: null,
      category: "MENTION",
      eventType: "POST_MENTION_CREATED",
      sourceType: "postMention",
      sourceId: "source-1",
      title: "Mention",
      body: "You were mentioned",
      isRead: false,
      readAt: null,
      createdAt,
      updatedAt: createdAt,
      actorMember: null,
    };

    const updateNotification = vi.fn().mockResolvedValue({
      ...unreadNotification,
      isRead: true,
      readAt: createdAt,
    });

    const db = {
      notification: {
        findFirst: vi.fn().mockResolvedValue(unreadNotification),
        update: updateNotification,
      },
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: recipientMemberId,
          familyId,
        }),
      },
    } as never;

    await expect(
      createCaller(db).markAsRead({
        notificationId: unreadNotification.id,
      }),
    ).resolves.toMatchObject({
      notification: {
        isRead: true,
      },
    });

    expect(updateNotification).toHaveBeenCalledTimes(1);
    const updateArgs = updateNotification.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { isRead: boolean };
    };
    expect(updateArgs.where.id).toBe(unreadNotification.id);
    expect(updateArgs.data.isRead).toBe(true);
  });

  it("returns not found when trying to mark another member's notification", async () => {
    const updateNotification = vi.fn();

    const db = {
      notification: {
        findFirst: vi.fn().mockResolvedValue({
          id: "clh0000000000000000002002",
          familyId,
          recipientMemberId: "clh0000000000000000000302",
          actorMemberId: null,
          category: "SYSTEM",
          eventType: "SYSTEM_EVENT",
          sourceType: "system",
          sourceId: "source-2",
          title: "System",
          body: "Body",
          isRead: false,
          readAt: null,
          createdAt: new Date("2030-01-01T00:00:00.000Z"),
          updatedAt: new Date("2030-01-01T00:00:00.000Z"),
          actorMember: null,
        }),
        update: updateNotification,
      },
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: recipientMemberId,
          familyId,
        }),
      },
    } as never;

    const caller = createCaller(db);

    await expect(
      caller.markAsRead({
        notificationId: "clh0000000000000000002002",
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect(updateNotification).not.toHaveBeenCalled();
  });

  it("marks all unread notifications as read for the caller", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 7 });

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: recipientMemberId,
          familyId,
        }),
      },
      notification: {
        updateMany,
      },
    } as never;

    const caller = createCaller(db);

    await expect(caller.markAllAsRead({ familyId })).resolves.toEqual({ count: 7 });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          familyId,
          recipientMemberId,
          isRead: false,
        },
      }),
    );
  });

  it("returns push subscription state for the caller membership", async () => {
    const createdAt = new Date("2030-01-01T00:00:00.000Z");
    const updatedAt = new Date("2030-01-02T00:00:00.000Z");

    const pushSubscriptionFindMany = vi.fn().mockResolvedValue([
      {
        id: "sub-1",
        endpoint: "https://push.example.com/sub-1",
        userAgent: "Chrome",
        createdAt,
        updatedAt,
        lastUsedAt: null,
      },
    ]);

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: recipientMemberId,
          familyId,
        }),
      },
      pushSubscription: {
        findMany: pushSubscriptionFindMany,
      },
    } as never;

    const result = await createCaller(db).getPushSubscriptionState({ familyId });

    expect(result.hasActiveSubscription).toBe(true);
    expect(result.subscriptions).toHaveLength(1);
    expect(pushSubscriptionFindMany).toHaveBeenCalledWith({
      where: {
        familyId,
        memberId: recipientMemberId,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        endpoint: true,
        userAgent: true,
        createdAt: true,
        updatedAt: true,
        lastUsedAt: true,
      },
    });
  });

  it("subscribes push endpoint with member-scoped upsert and user-agent", async () => {
    const pushSubscriptionUpsert = vi.fn().mockResolvedValue({
      id: "sub-2",
      endpoint: "https://push.example.com/sub-2",
      updatedAt: new Date("2030-01-02T00:00:00.000Z"),
    });

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: recipientMemberId,
          familyId,
        }),
      },
      pushSubscription: {
        upsert: pushSubscriptionUpsert,
      },
    } as never;

    const headers = new Headers({ "user-agent": "Edge Test Agent" });
    const caller = createCaller(db, "user-1", headers);

    const result = await caller.subscribePush({
      familyId,
      subscriptionPayload: {
        endpoint: "https://push.example.com/sub-2",
        keys: {
          p256dh: "p256dh-key",
          auth: "auth-key",
        },
      },
    });

    expect(result.subscription.endpoint).toBe("https://push.example.com/sub-2");
    const upsertCallArgs = pushSubscriptionUpsert.mock.calls[0]?.[0] as
      | {
          where: { endpoint: string };
          create: { familyId: string; memberId: string; userAgent: string | null };
          update: { familyId: string; memberId: string; userAgent: string | null };
        }
      | undefined;
    expect(upsertCallArgs).toBeDefined();
    expect(upsertCallArgs?.where).toEqual({
      endpoint: "https://push.example.com/sub-2",
    });
    expect(upsertCallArgs?.create).toMatchObject({
      familyId,
      memberId: recipientMemberId,
      userAgent: "Edge Test Agent",
    });
    expect(upsertCallArgs?.update).toMatchObject({
      familyId,
      memberId: recipientMemberId,
      userAgent: "Edge Test Agent",
    });
  });

  it("unsubscribes push endpoint only for caller membership", async () => {
    const pushSubscriptionDeleteMany = vi.fn().mockResolvedValue({ count: 1 });

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: recipientMemberId,
          familyId,
        }),
      },
      pushSubscription: {
        deleteMany: pushSubscriptionDeleteMany,
      },
    } as never;

    const caller = createCaller(db);

    await expect(
      caller.unsubscribePush({
        familyId,
        endpoint: "https://push.example.com/sub-2",
      }),
    ).resolves.toEqual({ removedCount: 1 });

    expect(pushSubscriptionDeleteMany).toHaveBeenCalledWith({
      where: {
        familyId,
        memberId: recipientMemberId,
        endpoint: "https://push.example.com/sub-2",
      },
    });
  });

  it("returns push interaction preferences with defaults when unset", async () => {
    const notificationPreferenceFindMany = vi.fn().mockResolvedValue([
      {
        eventType: "POST_LIKED",
        isEnabled: false,
      },
      {
        eventType: "SYSTEM_EVENT",
        isEnabled: true,
      },
    ]);

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: recipientMemberId,
          familyId,
        }),
      },
      notificationPreference: {
        findMany: notificationPreferenceFindMany,
      },
    } as never;

    const result = await createCaller(db).getPushInteractionPreferences({ familyId });

    expect(result.preferences.length).toBeGreaterThan(2);
    expect(
      result.preferences.find((preference) => preference.eventType === "POST_LIKED"),
    ).toMatchObject({
      category: "ENGAGEMENT",
      isEnabled: false,
    });
    expect(
      result.preferences.find((preference) => preference.eventType === "POST_MENTION_CREATED"),
    ).toMatchObject({
      category: "MENTION",
      isEnabled: true,
    });
    expect(notificationPreferenceFindMany).toHaveBeenCalledWith({
      where: {
        familyId,
        memberId: recipientMemberId,
        channel: "PUSH",
        eventType: {
          in: [
            "MEDIA_TAG_CREATED",
            "MEDIA_TAG_UPDATED",
            "POST_MENTION_CREATED",
            "COMMENT_MENTION_CREATED",
            "POST_COMMENT_CREATED",
            "COMMENT_REPLIED",
            "POST_LIKED",
            "COMMENT_LIKED",
            "INVITE_CREATED",
            "INVITE_STATUS_CHANGED",
            "SYSTEM_EVENT",
          ],
        },
      },
      select: {
        eventType: true,
        isEnabled: true,
      },
    });
  });

  it("updates push interaction preferences for caller membership", async () => {
    const notificationPreferenceUpsert = vi.fn().mockResolvedValue({
      eventType: "POST_LIKED",
      isEnabled: false,
    });
    const transaction = vi.fn(async (ops: Array<Promise<unknown>>) => Promise.all(ops));

    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: recipientMemberId,
          familyId,
        }),
      },
      notificationPreference: {
        upsert: notificationPreferenceUpsert,
      },
      $transaction: transaction,
    } as never;

    const caller = createCaller(db);

    await expect(
      caller.updatePushInteractionPreferences({
        familyId,
        preferences: [
          { eventType: "POST_LIKED", isEnabled: true },
          { eventType: "POST_LIKED", isEnabled: false },
          { eventType: "COMMENT_LIKED", isEnabled: false },
        ],
      }),
    ).resolves.toEqual({ updatedCount: 2 });

    expect(notificationPreferenceUpsert).toHaveBeenCalledTimes(2);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(notificationPreferenceUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          familyId_memberId_channel_eventType: {
            familyId,
            memberId: recipientMemberId,
            channel: "PUSH",
            eventType: "POST_LIKED",
          },
        },
      }),
    );
  });

  it("rejects push subscription management when caller is not in the family", async () => {
    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      pushSubscription: {
        findMany: vi.fn(),
      },
    } as never;

    await expect(
      createCaller(db).getPushSubscriptionState({ familyId }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects push preference update when caller is not in the family", async () => {
    const db = {
      familyMember: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      notificationPreference: {
        upsert: vi.fn(),
      },
      $transaction: vi.fn(),
    } as never;

    await expect(
      createCaller(db).updatePushInteractionPreferences({
        familyId,
        preferences: [{ eventType: "POST_LIKED", isEnabled: false }],
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
