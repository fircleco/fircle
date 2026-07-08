import { z } from "zod"

import { normalizeEmail } from "~/lib/email"
import { normalizeFamilyNameInput } from "~/lib/family-name"

export const firstFamilySetupInputSchema = z.object({
  familyName: z
    .string()
    .max(120)
    .transform(normalizeFamilyNameInput)
    .refine((value) => value.length > 0, {
      message: "Family name is required",
    }),
  ownerName: z.string().trim().min(1).max(120),
  ownerNickname: z.string().trim().min(1).max(60).optional(),
  email: z.string().email().transform(normalizeEmail),
  password: z.string().min(8).max(72),
})

export type FirstFamilySetupInput = z.infer<typeof firstFamilySetupInputSchema>
