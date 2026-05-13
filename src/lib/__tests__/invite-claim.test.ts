import { describe, it, expect } from "vitest";
import {
  isClaimInvite,
  isMemberAlreadyClaimed,
  getClaimLifecycleState,
  validateClaimEmailBinding,
  generateClaimToken,
  getInviteExpiryDate,
  CLAIM_DEFAULT_TTL_DAYS,
  CLAIM_ERROR_CODES,
} from "~/lib/invite";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
const past = new Date(Date.now() - 1); // 1 ms in the past

function makePendingInvite(overrides: object = {}) {
  return {
    status: "PENDING" as const,
    expiresAt: future,
    claimedAt: null,
    revokedAt: null,
    claimMemberId: "cuid-member-1",
    ...overrides,
  };
}

// ─── isClaimInvite ─────────────────────────────────────────────────────────────

describe("isClaimInvite", () => {
  it("returns true when claimMemberId is set", () => {
    expect(isClaimInvite({ claimMemberId: "cuid-member-1" })).toBe(true);
  });

  it("returns false when claimMemberId is null", () => {
    expect(isClaimInvite({ claimMemberId: null })).toBe(false);
  });
});

// ─── isMemberAlreadyClaimed ────────────────────────────────────────────────────

describe("isMemberAlreadyClaimed", () => {
  it("returns true when member has a linked userId", () => {
    expect(isMemberAlreadyClaimed({ userId: "user-id-abc" })).toBe(true);
  });

  it("returns false when userId is null (unclaimed member)", () => {
    expect(isMemberAlreadyClaimed({ userId: null })).toBe(false);
  });
});

// ─── getClaimLifecycleState ────────────────────────────────────────────────────

describe("getClaimLifecycleState", () => {
  it('returns "invalid" when invite is null (unknown token)', () => {
    expect(getClaimLifecycleState(null)).toBe("invalid");
  });

  it('returns "valid" for a PENDING invite with a future expiry', () => {
    expect(getClaimLifecycleState(makePendingInvite())).toBe("valid");
  });

  it('returns "expired" when expiresAt is in the past', () => {
    const invite = makePendingInvite({ expiresAt: past });
    expect(getClaimLifecycleState(invite)).toBe("expired");
  });

  it('returns "expired" when status is EXPIRED', () => {
    const invite = makePendingInvite({ status: "EXPIRED" });
    expect(getClaimLifecycleState(invite)).toBe("expired");
  });

  it('returns "revoked" when revokedAt is set', () => {
    const invite = makePendingInvite({ revokedAt: new Date() });
    expect(getClaimLifecycleState(invite)).toBe("revoked");
  });

  it('returns "revoked" when status is REVOKED', () => {
    const invite = makePendingInvite({ status: "REVOKED" });
    expect(getClaimLifecycleState(invite)).toBe("revoked");
  });

  it('returns "claimed" when claimedAt is set', () => {
    const invite = makePendingInvite({ claimedAt: new Date(), status: "CLAIMED" });
    expect(getClaimLifecycleState(invite)).toBe("claimed");
  });

  it('returns "claimed" when status is CLAIMED', () => {
    const invite = makePendingInvite({ status: "CLAIMED" });
    expect(getClaimLifecycleState(invite)).toBe("claimed");
  });

  // Expiry evaluated using the provided `now` reference
  it("respects the provided `now` date for expiry evaluation", () => {
    const justExpiredNow = new Date("2030-01-01T00:00:00.000Z");
    const invite = makePendingInvite({
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });
    // expiresAt <= now → expired
    expect(getClaimLifecycleState(invite, justExpiredNow)).toBe("expired");
  });
});

// ─── validateClaimEmailBinding ─────────────────────────────────────────────────

describe("validateClaimEmailBinding", () => {
  describe("OPEN invite (no email binding)", () => {
    it("accepts any email when the invite is OPEN", () => {
      const result = validateClaimEmailBinding(
        { type: "OPEN", invitedEmail: null },
        "anyone@example.com",
      );
      expect(result.ok).toBe(true);
    });
  });

  describe("EMAIL_BOUND invite", () => {
    it("accepts matching email (case-insensitive)", () => {
      const result = validateClaimEmailBinding(
        { type: "EMAIL_BOUND", invitedEmail: "alice@example.com" },
        "ALICE@EXAMPLE.COM",
      );
      expect(result.ok).toBe(true);
    });

    it("rejects non-matching email with EMAIL_MISMATCH", () => {
      const result = validateClaimEmailBinding(
        { type: "EMAIL_BOUND", invitedEmail: "alice@example.com" },
        "bob@example.com",
      );
      expect(result.ok).toBe(false);
      expect((result as { ok: false; reason: string }).reason).toBe(
        CLAIM_ERROR_CODES.EMAIL_MISMATCH,
      );
    });

    it("rejects when invitedEmail is null with MISSING_BOUND_EMAIL", () => {
      const result = validateClaimEmailBinding(
        { type: "EMAIL_BOUND", invitedEmail: null },
        "alice@example.com",
      );
      expect(result.ok).toBe(false);
      expect((result as { ok: false; reason: string }).reason).toBe(
        CLAIM_ERROR_CODES.MISSING_BOUND_EMAIL,
      );
    });
  });
});

// ─── getInviteExpiryDate ───────────────────────────────────────────────────────

describe("getInviteExpiryDate", () => {
  it("adds the default TTL days from the given date", () => {
    const now = new Date("2030-01-01T00:00:00.000Z");
    const expiry = getInviteExpiryDate(now, CLAIM_DEFAULT_TTL_DAYS);
    const expected = new Date("2030-01-31T00:00:00.000Z");
    expect(expiry.toISOString()).toBe(expected.toISOString());
  });

  it("accepts custom TTL", () => {
    const now = new Date("2030-06-01T00:00:00.000Z");
    const expiry = getInviteExpiryDate(now, 7);
    const expected = new Date("2030-06-08T00:00:00.000Z");
    expect(expiry.toISOString()).toBe(expected.toISOString());
  });
});

// ─── generateClaimToken ────────────────────────────────────────────────────────

describe("generateClaimToken", () => {
  it("produces a non-empty URL-safe string", () => {
    const token = generateClaimToken();
    expect(token).toBeTruthy();
    expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
  });

  it("produces unique tokens on successive calls", () => {
    const tokens = Array.from({ length: 20 }, () => generateClaimToken());
    const unique = new Set(tokens);
    expect(unique.size).toBe(tokens.length);
  });
});
