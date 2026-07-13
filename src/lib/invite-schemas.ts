import { z } from "zod"

import { normalizeEmail } from "~/lib/email"
import {
  INVITE_DEFAULT_TTL_DAYS,
  INVITE_TYPES,
  INVITE_STATUSES,
  CLAIM_DEFAULT_TTL_DAYS,
} from "~/lib/invite"

export const inviteCodeSchema = z
  .string()
  .trim()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "Invite code format is invalid")

export const inviteLookupInputSchema = z.object({
  code: inviteCodeSchema,
})

export const inviteAcceptInputSchema = z.object({
  code: inviteCodeSchema,
  name: z.string().trim().min(1).max(120),
  email: z.string().email().transform(normalizeEmail),
  password: z.string().min(8).max(72),
})

export const inviteCreateInputSchema = z
  .object({
    familyId: z.string().cuid(),
    type: z.enum(INVITE_TYPES),
    invitedEmail: z
      .string()
      .email()
      .transform(normalizeEmail)
      .optional(),
    expiresInDays: z
      .number()
      .int()
      .min(1)
      .max(90)
      .default(INVITE_DEFAULT_TTL_DAYS),
  })
  .superRefine((value, ctx) => {
    if (value.type === "EMAIL_BOUND" && !value.invitedEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["invitedEmail"],
        message: "Email-bound invites require invitedEmail",
      })
    }
  })

export const inviteRevokeInputSchema = z.object({
  inviteId: z.string().cuid(),
})

export type InviteLookupInput = z.infer<typeof inviteLookupInputSchema>
export type InviteAcceptInput = z.infer<typeof inviteAcceptInputSchema>
export type InviteCreateInput = z.infer<typeof inviteCreateInputSchema>
export type InviteRevokeInput = z.infer<typeof inviteRevokeInputSchema>

export const retryEmailSendInputSchema = z.object({
  inviteId: z.string().cuid(),
})

export type RetryEmailSendInput = z.infer<typeof retryEmailSendInputSchema>

export const reusableInviteLifecycleStateSchema = z.enum(["valid", "revoked", "invalid"])

export const getActiveReusableInviteInputSchema = z.object({
  familyId: z.string().cuid(),
})

export const resetReusableInviteInputSchema = z.object({
  familyId: z.string().cuid(),
})

export const reusableInviteSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  familyId: z.string(),
  isReusable: z.literal(true),
  status: z.enum(INVITE_STATUSES),
  lifecycleState: reusableInviteLifecycleStateSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  revokedAt: z.date().nullable(),
  rotatedFromInviteId: z.string().nullable(),
  useCount: z.number().int().nonnegative(),
  lastUsedAt: z.date().nullable(),
})

export type GetActiveReusableInviteInput = z.infer<typeof getActiveReusableInviteInputSchema>
export type ResetReusableInviteInput = z.infer<typeof resetReusableInviteInputSchema>
export type ReusableInviteSummary = z.infer<typeof reusableInviteSummarySchema>

// ─── Claim schemas ────────────────────────────────────────────────────────────

const internalMediaUrlSchema = z
  .string()
  .max(2048)
  .refine((value) => value.startsWith("/api/media/r2/"), "Invalid url")

const memberImageInputSchema = z.union([z.string().url().max(2048), internalMediaUrlSchema])

export const createUnclaimedMemberInputSchema = z.object({
  familyId: z.string().cuid(),
  name: z.string().trim().min(1).max(120),
  /** Optional family-friendly display handle used for profile slug generation. */
  nickname: z.string().trim().min(1).max(60).optional(),
  /** Optional email for future claim-link binding. Not stored on `User`. */
  email: z
    .string()
    .email()
    .transform(normalizeEmail)
    .optional(),
  /** When true and email is not provided, create an OPEN claim invite automatically. */
  generateClaimInvite: z.boolean().optional(),
  /** Optional URL for the member's profile image. */
  image: memberImageInputSchema.optional(),
})

export const createClaimLinkInputSchema = z.object({
  familyMemberId: z.string().cuid(),
  /** When set the claim link becomes EMAIL_BOUND and only accepts this address. */
  invitedEmail: z
    .string()
    .email()
    .transform(normalizeEmail)
    .optional(),
  expiresInDays: z
    .number()
    .int()
    .min(1)
    .max(365)
    .default(CLAIM_DEFAULT_TTL_DAYS),
})

export const claimLinkLookupInputSchema = z.object({
  code: inviteCodeSchema,
})

export const claimMemberInputSchema = z
  .object({
    code: inviteCodeSchema,
    email: z.string().email().transform(normalizeEmail),
    password: z.string().min(8).max(72),
    confirmPassword: z.string().min(8).max(72),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export type CreateUnclaimedMemberInput = z.infer<typeof createUnclaimedMemberInputSchema>
export type CreateClaimLinkInput = z.infer<typeof createClaimLinkInputSchema>
export type ClaimLinkLookupInput = z.infer<typeof claimLinkLookupInputSchema>
export type ClaimMemberInput = z.infer<typeof claimMemberInputSchema>
