import {
  DEFAULT_NOTIFICATION_URL,
  getPayloadTargetUrl,
  resolveOfflineNavigationFallback,
  toAbsoluteSameOriginUrl,
} from "~/lib/sw-routing";
import { describe, expect, it } from "vitest";

describe("service worker routing helpers", () => {
  it("maps payload target URL with expected precedence", () => {
    expect(getPayloadTargetUrl({ url: "/a", targetUrl: "/b" })).toBe("/a");
    expect(getPayloadTargetUrl({ targetUrl: "/b" })).toBe("/b");
    expect(getPayloadTargetUrl({ data: { url: "/c" } })).toBe("/c");
    expect(getPayloadTargetUrl({ data: { targetUrl: "/d" } })).toBe("/d");
    expect(getPayloadTargetUrl({})).toBe(DEFAULT_NOTIFICATION_URL);
  });

  it("normalizes same-origin URLs and falls back for external/malformed targets", () => {
    expect(toAbsoluteSameOriginUrl("/post/abc", "https://fircle.test")).toBe(
      "https://fircle.test/post/abc",
    );
    expect(toAbsoluteSameOriginUrl("https://evil.example/phish", "https://fircle.test")).toBe(
      `https://fircle.test${DEFAULT_NOTIFICATION_URL}`,
    );
    expect(toAbsoluteSameOriginUrl("https://[::1", "https://fircle.test")).toBe(
      `https://fircle.test${DEFAULT_NOTIFICATION_URL}`,
    );
  });

  it("resolves offline fallback by preferring cached navigation over shell", () => {
    const cachedNavigation = new Response("cached navigation", { status: 200 });
    const shellFallback = new Response("shell fallback", { status: 200 });

    expect(resolveOfflineNavigationFallback(cachedNavigation, shellFallback)).toBe(cachedNavigation);
    expect(resolveOfflineNavigationFallback(undefined, shellFallback)).toBe(shellFallback);
    expect(resolveOfflineNavigationFallback(undefined, undefined)).toBeUndefined();
  });
});
