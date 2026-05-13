import { describe, it, expect } from "vitest";
import {
  createUnclaimedMemberInputSchema,
  createClaimLinkInputSchema,
  claimMemberInputSchema,
} from "~/lib/invite-schemas";
import { CLAIM_DEFAULT_TTL_DAYS } from "~/lib/invite";

const VALID_CUID = "clh0000000000000000000000"; // fake but passes cuid() format loosely

// ─── createUnclaimedMemberInputSchema ────────────────────────────────────────

describe("createUnclaimedMemberInputSchema", () => {
  it("accepts a minimal valid input (name + familyId only)", () => {
    const result = createUnclaimedMemberInputSchema.safeParse({
      familyId: VALID_CUID,
      name: "Grandma Betty",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a full input with optional nickname, email, and image", () => {
    const result = createUnclaimedMemberInputSchema.safeParse({
      familyId: VALID_CUID,
      name: "Grandma Betty",
      nickname: "Nana",
      email: "betty@example.com",
      image: "https://example.com/photo.jpg",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty nickname", () => {
    const result = createUnclaimedMemberInputSchema.safeParse({
      familyId: VALID_CUID,
      name: "Betty",
      nickname: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = createUnclaimedMemberInputSchema.safeParse({
      familyId: VALID_CUID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = createUnclaimedMemberInputSchema.safeParse({
      familyId: VALID_CUID,
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = createUnclaimedMemberInputSchema.safeParse({
      familyId: VALID_CUID,
      name: "Betty",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("normalizes email to lowercase", () => {
    const result = createUnclaimedMemberInputSchema.safeParse({
      familyId: VALID_CUID,
      name: "Betty",
      email: "BETTY@EXAMPLE.COM",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("betty@example.com");
    }
  });

});

// ─── createClaimLinkInputSchema ───────────────────────────────────────────────

describe("createClaimLinkInputSchema", () => {
  it("accepts a minimal input with just familyMemberId", () => {
    const result = createClaimLinkInputSchema.safeParse({
      familyMemberId: VALID_CUID,
    });
    expect(result.success).toBe(true);
  });

  it(`defaults expiresInDays to ${CLAIM_DEFAULT_TTL_DAYS}`, () => {
    const result = createClaimLinkInputSchema.safeParse({
      familyMemberId: VALID_CUID,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expiresInDays).toBe(CLAIM_DEFAULT_TTL_DAYS);
    }
  });

  it("accepts an optional invitedEmail binding", () => {
    const result = createClaimLinkInputSchema.safeParse({
      familyMemberId: VALID_CUID,
      invitedEmail: "alice@example.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.invitedEmail).toBe("alice@example.com");
    }
  });

  it("rejects expiresInDays of 0", () => {
    const result = createClaimLinkInputSchema.safeParse({
      familyMemberId: VALID_CUID,
      expiresInDays: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects expiresInDays over 365", () => {
    const result = createClaimLinkInputSchema.safeParse({
      familyMemberId: VALID_CUID,
      expiresInDays: 366,
    });
    expect(result.success).toBe(false);
  });
});

// ─── claimMemberInputSchema ───────────────────────────────────────────────────

describe("claimMemberInputSchema", () => {
  const validCode = "a".repeat(16); // 16+ chars, URL-safe

  it("accepts a valid claim submission without email binding", () => {
    const result = claimMemberInputSchema.safeParse({
      code: validCode,
      email: "claimant@example.com",
      password: "strongpassword1",
      confirmPassword: "strongpassword1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when password and confirmPassword do not match", () => {
    const result = claimMemberInputSchema.safeParse({
      code: validCode,
      email: "claimant@example.com",
      password: "strongpassword1",
      confirmPassword: "different-password",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = claimMemberInputSchema.safeParse({
      code: validCode,
      email: "claimant@example.com",
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = claimMemberInputSchema.safeParse({
      code: validCode,
      email: "not-an-email",
      password: "strongpassword1",
      confirmPassword: "strongpassword1",
    });
    expect(result.success).toBe(false);
  });

  it("normalizes email to lowercase", () => {
    const result = claimMemberInputSchema.safeParse({
      code: validCode,
      email: "CLAIMANT@EXAMPLE.COM",
      password: "strongpassword1",
      confirmPassword: "strongpassword1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("claimant@example.com");
    }
  });

  it("rejects a code shorter than 16 characters", () => {
    const result = claimMemberInputSchema.safeParse({
      code: "short",
      email: "user@example.com",
      password: "strongpassword1",
      confirmPassword: "strongpassword1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a code with invalid characters", () => {
    const result = claimMemberInputSchema.safeParse({
      code: "abc!@#$%^&*()xyz1", // contains special chars
      email: "user@example.com",
      password: "strongpassword1",
      confirmPassword: "strongpassword1",
    });
    expect(result.success).toBe(false);
  });
});
