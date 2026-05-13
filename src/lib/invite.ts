import { randomBytes } from "node:crypto"

import { emailsMatch, normalizeEmail } from "~/lib/email"

export const INVITE_DEFAULT_TTL_DAYS = 14
export const CLAIM_DEFAULT_TTL_DAYS = 30

export const INVITE_TYPES = ["OPEN", "EMAIL_BOUND"] as const
export const INVITE_STATUSES = ["PENDING", "CLAIMED", "EXPIRED", "REVOKED"] as const

export type InviteTypeValue = (typeof INVITE_TYPES)[number]
export type InviteStatusValue = (typeof INVITE_STATUSES)[number]

export type InviteLifecycleState = "valid" | "expired" | "claimed" | "revoked"

/** All states a looked-up claim link can be in, including "not found". */
export type ClaimLifecycleState = "valid" | "expired" | "claimed" | "revoked" | "invalid"

export type InviteLifecycleRecord = {
  status: InviteStatusValue
  expiresAt: Date
  claimedAt: Date | null
  revokedAt: Date | null
}

export type InviteBindingRecord = {
  type: InviteTypeValue
  invitedEmail: string | null
}

/** Minimal shape needed to check whether an invite is a claim invite. */
export type ClaimInviteRecord = {
  claimMemberId: string | null
}

/** Minimal shape needed to check whether the target member is already claimed. */
export type ClaimMemberRecord = {
  userId: string | null
}

export const CLAIM_ERROR_CODES = {
  INVALID_TOKEN: "INVALID_TOKEN",
  EXPIRED_LINK: "EXPIRED_LINK",
  REVOKED_LINK: "REVOKED_LINK",
  LINK_ALREADY_USED: "LINK_ALREADY_USED",
  MEMBER_ALREADY_CLAIMED: "MEMBER_ALREADY_CLAIMED",
  EMAIL_MISMATCH: "EMAIL_MISMATCH",
  MISSING_BOUND_EMAIL: "MISSING_BOUND_EMAIL",
  DUPLICATE_MEMBER: "DUPLICATE_MEMBER",
  NOT_A_CLAIM_INVITE: "NOT_A_CLAIM_INVITE",
} as const

export type ClaimErrorCode = (typeof CLAIM_ERROR_CODES)[keyof typeof CLAIM_ERROR_CODES]

export function generateInviteCode(byteLength = 24): string {
  return randomBytes(byteLength).toString("base64url")
}

export function getInviteExpiryDate(
  now: Date = new Date(),
  ttlDays = INVITE_DEFAULT_TTL_DAYS,
): Date {
  const expiry = new Date(now)
  expiry.setDate(expiry.getDate() + ttlDays)
  return expiry
}

export function getInviteLifecycleState(
  invite: InviteLifecycleRecord,
  now: Date = new Date(),
): InviteLifecycleState {
  if (invite.revokedAt || invite.status === "REVOKED") {
    return "revoked"
  }

  if (invite.claimedAt || invite.status === "CLAIMED") {
    return "claimed"
  }

  if (invite.expiresAt <= now || invite.status === "EXPIRED") {
    return "expired"
  }

  return "valid"
}

export function isInviteUsable(
  invite: InviteLifecycleRecord,
  now: Date = new Date(),
): boolean {
  return invite.status === "PENDING" && getInviteLifecycleState(invite, now) === "valid"
}

export function validateInviteEmailBinding(
  invite: InviteBindingRecord,
  email: string,
): { ok: true } | { ok: false; reason: "EMAIL_MISMATCH" | "MISSING_BOUND_EMAIL" } {
  if (invite.type !== "EMAIL_BOUND") {
    return { ok: true }
  }

  if (!invite.invitedEmail) {
    return { ok: false, reason: "MISSING_BOUND_EMAIL" }
  }

  if (!emailsMatch(invite.invitedEmail, email)) {
    return { ok: false, reason: "EMAIL_MISMATCH" }
  }

  return { ok: true }
}

export function getNormalizedInviteEmail(
  type: InviteTypeValue,
  invitedEmail?: string | null,
): string | null {
  if (type === "OPEN") {
    return null
  }

  if (!invitedEmail) {
    return null
  }

  return normalizeEmail(invitedEmail)
}

// ─── Claim helpers ────────────────────────────────────────────────────────────

/**
 * Generates a URL-safe random token suitable for use as a claim link code.
 * Uses a larger default byte length than invite codes for added entropy.
 */
export function generateClaimToken(byteLength = 32): string {
  return generateInviteCode(byteLength)
}

/**
 * Returns `true` when the invite record targets a specific family member for
 * claiming. Invites with `claimMemberId = null` are standard registration
 * invites; invites with a non-null `claimMemberId` are claim invites.
 */
export function isClaimInvite(invite: ClaimInviteRecord): boolean {
  return invite.claimMemberId != null
}

/**
 * Evaluates the lifecycle state of a claim invite. Returns `"invalid"` when
 * the invite is not found (i.e., the caller passes `null`). Delegates to the
 * shared invite lifecycle logic for all other states so the semantics stay
 * consistent between registration and claim invites.
 */
export function getClaimLifecycleState(
  invite: (InviteLifecycleRecord & ClaimInviteRecord) | null,
  now: Date = new Date(),
): ClaimLifecycleState {
  if (!invite) return "invalid"
  return getInviteLifecycleState(invite, now)
}

/**
 * Returns `true` when a family member already has a linked user account,
 * meaning the profile has already been claimed and cannot be claimed again.
 */
export function isMemberAlreadyClaimed(member: ClaimMemberRecord): boolean {
  return member.userId != null
}

/**
 * Validates the email provided during claim submission against the optional
 * email binding on the invite. Delegates to the shared invite binding logic.
 *
 * Returns `{ ok: true }` when the claim email is acceptable, or
 * `{ ok: false; reason: ClaimErrorCode }` on validation failure.
 */
export function validateClaimEmailBinding(
  invite: InviteBindingRecord,
  email: string,
): { ok: true } | { ok: false; reason: ClaimErrorCode } {
  const result = validateInviteEmailBinding(invite, email)
  if (result.ok) return { ok: true }

  return {
    ok: false,
    reason:
      result.reason === "EMAIL_MISMATCH"
        ? CLAIM_ERROR_CODES.EMAIL_MISMATCH
        : CLAIM_ERROR_CODES.MISSING_BOUND_EMAIL,
  }
}
