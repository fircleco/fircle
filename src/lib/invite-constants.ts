export const INVITE_DEFAULT_TTL_DAYS = 14
export const CLAIM_DEFAULT_TTL_DAYS = 30

export const INVITE_TYPES = ["OPEN", "EMAIL_BOUND"] as const
export const INVITE_STATUSES = ["PENDING", "CLAIMED", "EXPIRED", "REVOKED"] as const

export type InviteTypeValue = (typeof INVITE_TYPES)[number]
export type InviteStatusValue = (typeof INVITE_STATUSES)[number]
