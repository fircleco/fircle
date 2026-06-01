import { beforeEach, describe, expect, it, vi } from "vitest";

const { envMock, sendNotificationMock, setVapidDetailsMock } = vi.hoisted(() => ({
  envMock: {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-key",
    VAPID_PRIVATE_KEY: "private-key",
    VAPID_SUBJECT: "mailto:test@example.com",
  },
  sendNotificationMock: vi.fn(),
  setVapidDetailsMock: vi.fn(),
}));

vi.mock("~/env", () => ({
  env: envMock,
}));

vi.mock("web-push", () => ({
  sendNotification: sendNotificationMock,
  setVapidDetails: setVapidDetailsMock,
}));

import { isPushConfigured, sendPush } from "~/server/push";

describe("push module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "public-key";
    envMock.VAPID_PRIVATE_KEY = "private-key";
    envMock.VAPID_SUBJECT = "mailto:test@example.com";
  });

  it("reports push configured only when all VAPID vars are present", () => {
    expect(isPushConfigured()).toBe(true);

    envMock.VAPID_PRIVATE_KEY = undefined;
    expect(isPushConfigured()).toBe(false);
  });

  it("maps successful provider response to SENT outcome", async () => {
    sendNotificationMock.mockResolvedValue({
      headers: {
        "x-goog-message-id": "msg-123",
      },
    });

    const result = await sendPush(
      {
        endpoint: "https://push.example.com/sub-1",
        p256dh: "p256dh",
        auth: "auth",
      },
      {
        title: "Title",
        body: "Body",
        targetUrl: "/post/1",
      },
    );

    expect(result).toEqual({
      outcome: "SENT",
      providerMessageId: "msg-123",
    });
    expect(sendNotificationMock).toHaveBeenCalledTimes(1);
  });

  it("maps 404/410 provider errors to INVALID_SUBSCRIPTION", async () => {
    const providerError = Object.assign(new Error("Gone"), { statusCode: 410 });
    sendNotificationMock.mockRejectedValue(providerError);

    const result = await sendPush(
      {
        endpoint: "https://push.example.com/sub-1",
        p256dh: "p256dh",
        auth: "auth",
      },
      {
        title: "Title",
        body: "Body",
      },
    );

    expect(result).toEqual({
      outcome: "INVALID_SUBSCRIPTION",
      errorMessage: "Terminal error: 410 Gone",
    });
  });

  it("maps non-terminal provider errors to FAILED", async () => {
    const providerError = Object.assign(new Error("Service Unavailable"), {
      statusCode: 503,
    });
    sendNotificationMock.mockRejectedValue(providerError);

    const result = await sendPush(
      {
        endpoint: "https://push.example.com/sub-1",
        p256dh: "p256dh",
        auth: "auth",
      },
      {
        title: "Title",
        body: "Body",
      },
    );

    expect(result).toEqual({
      outcome: "FAILED",
      errorMessage: "503 Service Unavailable",
    });
  });

  it("returns FAILED when VAPID keys are not configured", async () => {
    envMock.NEXT_PUBLIC_VAPID_PUBLIC_KEY = undefined;
    envMock.VAPID_PRIVATE_KEY = undefined;
    envMock.VAPID_SUBJECT = undefined;

    const result = await sendPush(
      {
        endpoint: "https://push.example.com/sub-1",
        p256dh: "p256dh",
        auth: "auth",
      },
      {
        title: "Title",
        body: "Body",
      },
    );

    expect(sendNotificationMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      outcome: "FAILED",
      errorMessage: "VAPID keys not configured",
    });
  });
});
