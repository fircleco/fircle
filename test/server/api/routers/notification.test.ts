import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: {},
}));

import { notificationRouter } from "~/server/api/routers/notification";

function createCaller(db: unknown, userId = "user-1") {
  return notificationRouter.createCaller({
    db,
    session: {
      user: { id: userId },
    },
    headers: new Headers(),
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
});
