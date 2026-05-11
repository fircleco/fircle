import { randomBytes } from "node:crypto"

import { emailsMatch, normalizeEmail } from "~/lib/email"

export const INVITE_DEFAULT_TTL_DAYS = 14

export const INVITE_TYPES = ["OPEN", "EMAIL_BOUND"] as const
export const INVITE_STATUSES = ["PENDING", "CLAIMED", "EXPIRED", "REVOKED"] as const

export type InviteTypeValue = (typeof INVITE_TYPES)[number]
export type InviteStatusValue = (typeof INVITE_STATUSES)[number]

export type InviteLifecycleState = "valid" | "expired" | "claimed" | "revoked"

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
