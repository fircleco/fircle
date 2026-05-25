import { describe, expect, it } from "vitest";

import { formatUnreadBadgeCount } from "~/components/nav/unread-badge";

describe("formatUnreadBadgeCount", () => {
  it("returns null for zero or negative counts", () => {
    expect(formatUnreadBadgeCount(0)).toBeNull();
    expect(formatUnreadBadgeCount(-1)).toBeNull();
  });

  it("returns exact values for counts from 1 to 99", () => {
    expect(formatUnreadBadgeCount(1)).toBe("1");
    expect(formatUnreadBadgeCount(42)).toBe("42");
    expect(formatUnreadBadgeCount(99)).toBe("99");
  });

  it("caps display at 99+ for larger values", () => {
    expect(formatUnreadBadgeCount(100)).toBe("99+");
    expect(formatUnreadBadgeCount(999)).toBe("99+");
  });
});
