import { z } from "zod"

import { normalizeEmail } from "~/lib/email"
import { INVITE_DEFAULT_TTL_DAYS, INVITE_TYPES } from "~/lib/invite"

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
