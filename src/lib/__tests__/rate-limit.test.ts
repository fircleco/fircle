import { describe, it, expect } from "vitest";
import { checkRateLimit, getClientIp } from "~/lib/rate-limit";

// ─── checkRateLimit ───────────────────────────────────────────────────────────

describe("checkRateLimit", () => {
  // Use unique keys per test to avoid cross-test interference from the module-level store
  let keyCounter = 0;
  const freshKey = () => `test:rl:${++keyCounter}:${Math.random()}`;

  it("allows requests below the limit", () => {
    const key = freshKey();
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, 5, 60_000).ok).toBe(true);
    }
  });

  it("blocks the request that exceeds the limit", () => {
    const key = freshKey();
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, 5, 60_000);
    }
    const result = checkRateLimit(key, 5, 60_000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("allows requests again after the window expires", async () => {
    const key = freshKey();
    const windowMs = 50; // 50 ms window
    const limit = 2;

    checkRateLimit(key, limit, windowMs);
    checkRateLimit(key, limit, windowMs);
    expect(checkRateLimit(key, limit, windowMs).ok).toBe(false);

    // Wait for the window to expire
    await new Promise((r) => setTimeout(r, windowMs + 10));

    expect(checkRateLimit(key, limit, windowMs).ok).toBe(true);
  });

  it("isolates different keys independently", () => {
    const key1 = freshKey();
    const key2 = freshKey();
    for (let i = 0; i < 3; i++) {
      checkRateLimit(key1, 3, 60_000);
    }
    // key1 exhausted, key2 should still be fresh
    expect(checkRateLimit(key1, 3, 60_000).ok).toBe(false);
    expect(checkRateLimit(key2, 3, 60_000).ok).toBe(true);
  });
});

// ─── getClientIp ──────────────────────────────────────────────────────────────

describe("getClientIp", () => {
  it("returns the first IP from x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientIp(headers)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const headers = new Headers({ "x-real-ip": "9.10.11.12" });
    expect(getClientIp(headers)).toBe("9.10.11.12");
  });

  it('returns "unknown" when no IP header is present', () => {
    const headers = new Headers();
    expect(getClientIp(headers)).toBe("unknown");
  });
});
