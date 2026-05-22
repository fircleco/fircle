import bcrypt from "bcryptjs"
import { TRPCError } from "@trpc/server"
import { type Prisma } from "../../../../generated/prisma"
import { z } from "zod"

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc"
import {
  generateClaimToken,
  CLAIM_DEFAULT_TTL_DAYS,
  getClaimLifecycleState,
  isMemberAlreadyClaimed,
  isClaimInvite,
  validateClaimEmailBinding,
  CLAIM_ERROR_CODES,
} from "~/lib/invite"
import {
  createUnclaimedMemberInputSchema,
  createClaimLinkInputSchema,
  claimLinkLookupInputSchema,
  claimMemberInputSchema,
} from "~/lib/invite-schemas"
import { getInviteExpiryDate } from "~/lib/invite"
import { checkRateLimit, getClientIp } from "~/lib/rate-limit"
import { getMemberSlugBase, resolveUniqueMemberSlug, slugifyMemberText } from "~/lib/member-slug"

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolves the calling user's membership in a family. Returns null if not a member. */
async function getMembership(
  db: Prisma.TransactionClient,
  familyId: string,
  userId: string,
) {
  return db.familyMember.findUnique({
    where: { familyId_userId: { familyId, userId } },
  })
}

/** Throws FORBIDDEN if the user is not owner/admin of the family. */
async function requireAdminMembership(
  db: Prisma.TransactionClient,
  familyId: string,
  userId: string,
) {
  const membership = await getMembership(db, familyId, userId)

  const role = membership?.role
  if (role !== "ADMIN" && role !== "OWNER") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to perform this action in this family",
    })
  }

  return membership!
}

/** Throws FORBIDDEN if the user is not the owner of the family. */
async function requireOwnerMembership(
  db: Prisma.TransactionClient,
  familyId: string,
  userId: string,
) {
  const membership = await getMembership(db, familyId, userId)

  if (membership?.role !== "OWNER") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the family owner can perform this action",
    })
  }

  return membership
}

const changeMyPasswordInputSchema = z
  .object({
    familyId: z.string().cuid(),
    currentPassword: z.string().min(1).max(72),
    newPassword: z.string().min(8).max(72),
    confirmPassword: z.string().min(8).max(72),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

const adminResetMemberPasswordInputSchema = z.object({
  familyId: z.string().cuid(),
  memberId: z.string().cuid(),
  temporaryPassword: z.string().min(8).max(72),
})

const internalMediaUrlSchema = z
  .string()
  .max(2048)
  .refine(
    (value) => value.startsWith("/api/media/r2/"),
    "Invalid url",
  )

const profileImageInputSchema = z.union([z.string().url().max(2048), internalMediaUrlSchema])

const updateMemberProfileInputSchema = z.object({
  familyId: z.string().cuid(),
  memberId: z.string().cuid(),
  name: z.string().trim().min(1).max(120),
  nickname: z.string().trim().max(60).nullable().optional(),
  slug: z.string().trim().min(1).max(120).optional(),
  image: profileImageInputSchema.nullable(),
})

// ─── Router ───────────────────────────────────────────────────────────────────

export const familyMemberRouter = createTRPCRouter({
  /**
   * Protected mutation: Change the current user's password in a family context.
   */
  changeMyPassword: protectedProcedure
    .input(changeMyPasswordInputSchema)
    .mutation(async ({ ctx, input }) => {
      const membership = await getMembership(
        ctx.db,
        input.familyId,
        ctx.session.user.id,
      )

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this family",
        })
      }

      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { id: true, password: true },
      })

      if (!user?.password) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Current password is incorrect",
        })
      }

      const isValidCurrentPassword = await bcrypt.compare(
        input.currentPassword,
        user.password,
      )

      if (!isValidCurrentPassword) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Current password is incorrect",
        })
      }

      const hashedPassword = await bcrypt.hash(input.newPassword, 12)

      await ctx.db.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      })

      console.log(
        `[security:password-changed] familyId=${input.familyId} memberId=${membership.id} at=${new Date().toISOString()}`,
      )

      return { success: true as const }
    }),

  /**
   * Protected mutation: Reset a claimed member's password to a temporary value.
   */
  adminResetMemberPassword: protectedProcedure
    .input(adminResetMemberPasswordInputSchema)
    .mutation(async ({ ctx, input }) => {
      const adminMembership = await requireAdminMembership(
        ctx.db,
        input.familyId,
        ctx.session.user.id,
      )

      const member = await ctx.db.familyMember.findUnique({
        where: { id: input.memberId },
        select: {
          id: true,
          familyId: true,
          userId: true,
          name: true,
        },
      })

      if (member?.familyId !== input.familyId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Family member not found",
        })
      }

      if (!member.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only claimed members can have their password reset",
        })
      }

      const hashedPassword = await bcrypt.hash(input.temporaryPassword, 12)

      await ctx.db.user.update({
        where: { id: member.userId },
        data: { password: hashedPassword },
      })

      console.log(
        `[security:admin-password-reset] actorMemberId=${adminMembership.id} targetMemberId=${member.id} familyId=${input.familyId} at=${new Date().toISOString()}`,
      )

      return { success: true as const }
    }),

  /**
   * Protected mutation: Update a family member's profile fields.
   */
  updateMemberProfile: protectedProcedure
    .input(updateMemberProfileInputSchema)
    .mutation(async ({ ctx, input }) => {
      const callerMembership = await getMembership(
        ctx.db,
        input.familyId,
        ctx.session.user.id,
      )

      if (!callerMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this family",
        })
      }

      const targetMember = await ctx.db.familyMember.findUnique({
        where: { id: input.memberId },
        select: {
          id: true,
          familyId: true,
          slug: true,
        },
      })

      if (targetMember?.familyId !== input.familyId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Family member not found",
        })
      }

      const canEditSelf = callerMembership.id === targetMember.id
      const canEditAsAdmin =
        callerMembership.role === "ADMIN" || callerMembership.role === "OWNER"

      if (!canEditSelf && !canEditAsAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to perform this action in this family",
        })
      }

      const normalizedNickname = input.nickname?.trim() ?? null
      const shouldUpdateSlug = Boolean(input.slug?.trim())

      let nextSlug = targetMember.slug
      if (shouldUpdateSlug) {
        const slugBase = slugifyMemberText(input.slug!)
        nextSlug =
          slugBase === targetMember.slug
            ? targetMember.slug
            : await resolveUniqueMemberSlug(ctx.db, input.familyId, slugBase)
      }

      const updatedMember = await ctx.db.familyMember.update({
        where: { id: targetMember.id },
        data: {
          name: input.name,
          nickname: normalizedNickname,
          slug: nextSlug,
          image: input.image,
        },
        select: {
          id: true,
          familyId: true,
          name: true,
          nickname: true,
          image: true,
          slug: true,
          userId: true,
          role: true,
        },
      })

      return {
        id: updatedMember.id,
        familyId: updatedMember.familyId,
        name: updatedMember.name,
        nickname: updatedMember.nickname,
        image: updatedMember.image,
        slug: updatedMember.slug,
        status: updatedMember.userId ? ("claimed" as const) : ("unclaimed" as const),
        role: updatedMember.role,
      }
    }),

  /**
   * Protected query: Resolve a family member profile by slug within a family.
   * Caller must be a member of the target family.
   */
  getMemberProfileBySlug: protectedProcedure
    .input(
      z.object({
        familyId: z.string().cuid(),
        slug: z.string().trim().min(1).max(120),
      }),
    )
    .query(async ({ ctx, input }) => {
      const membership = await ctx.db.familyMember.findUnique({
        where: {
          familyId_userId: {
            familyId: input.familyId,
            userId: ctx.session.user.id,
          },
        },
        select: { id: true },
      })

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this family",
        })
      }

      const member = await ctx.db.familyMember.findFirst({
        where: {
          familyId: input.familyId,
          slug: input.slug,
        },
        select: {
          id: true,
          slug: true,
          name: true,
          nickname: true,
          image: true,
          role: true,
          userId: true,
          createdAt: true,
          claimInvites: {
            where: {
              status: "PENDING",
              claimedAt: null,
              revokedAt: null,
              expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              code: true,
              invitedEmail: true,
              expiresAt: true,
            },
          },
        },
      })

      if (!member) {
        return null
      }

      return {
        id: member.id,
        slug: member.slug,
        name: member.name,
        nickname: member.nickname,
        image: member.image,
        role: member.role,
        status: member.userId ? ("claimed" as const) : ("unclaimed" as const),
        pendingClaimInvite:
          member.claimInvites[0]
            ? {
                id: member.claimInvites[0].id,
                code: member.claimInvites[0].code,
                invitedEmail: member.claimInvites[0].invitedEmail,
                expiresAt: member.claimInvites[0].expiresAt,
              }
            : null,
        createdAt: member.createdAt,
      }
    }),

  /**
   * Protected query: List members for a family the caller belongs to.
   */
  listFamilyMembers: protectedProcedure
    .input(
      z.object({
        familyId: z.string().cuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const membership = await ctx.db.familyMember.findUnique({
        where: {
          familyId_userId: {
            familyId: input.familyId,
            userId: ctx.session.user.id,
          },
        },
        select: { id: true },
      })

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this family",
        })
      }

      const members = await ctx.db.familyMember.findMany({
        where: { familyId: input.familyId },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          slug: true,
          name: true,
          nickname: true,
          image: true,
          role: true,
          userId: true,
          createdAt: true,
          claimInvites: {
            where: {
              status: "PENDING",
              claimedAt: null,
              revokedAt: null,
              expiresAt: { gt: new Date() },
            },
            select: { id: true },
            take: 1,
          },
        },
      })

      return members.map((member) => ({
        id: member.id,
        slug: member.slug,
        name: member.name,
        nickname: member.nickname,
        image: member.image,
        role: member.role,
        status: member.userId ? ("claimed" as const) : ("unclaimed" as const),
        hasPendingClaimInvite: member.claimInvites.length > 0,
        createdAt: member.createdAt,
      }))
    }),

  /**
   * Protected query: Get the current authenticated user's member profile for a family.
   * Returns the member record for the calling user in the specified family, or null if not a member.
   */
  getCurrentUserMemberProfile: protectedProcedure
    .input(
      z.object({
        familyId: z.string().cuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const member = await ctx.db.familyMember.findUnique({
        where: {
          familyId_userId: {
            familyId: input.familyId,
            userId: ctx.session.user.id,
          },
        },
        select: {
          id: true,
          slug: true,
          name: true,
          nickname: true,
          image: true,
          role: true,
          userId: true,
          createdAt: true,
        },
      })

      if (!member) {
        return null
      }

      return {
        id: member.id,
        slug: member.slug,
        name: member.name,
        nickname: member.nickname,
        image: member.image,
        role: member.role,
        status: member.userId ? ("claimed" as const) : ("unclaimed" as const),
        createdAt: member.createdAt,
      }
    }),

  /**
   * Protected mutation: Create an unclaimed family member profile.
   * Only owner/admin may create unclaimed members for a family.
   */
  createUnclaimedMember: protectedProcedure
    .input(createUnclaimedMemberInputSchema)
    .mutation(async ({ ctx, input }) => {
      await requireAdminMembership(ctx.db, input.familyId, ctx.session.user.id)

      try {
        const result = await ctx.db.$transaction(async (tx: Prisma.TransactionClient) => {
          const baseSlug = getMemberSlugBase(input.name, input.nickname)
          const slug = await resolveUniqueMemberSlug(tx, input.familyId, baseSlug)

          if (input.email) {
            const conflictingInvite = await tx.invite.findFirst({
              where: {
                type: "EMAIL_BOUND",
                invitedEmail: input.email,
                status: "PENDING",
                claimedAt: null,
                revokedAt: null,
                expiresAt: { gt: new Date() },
              },
              include: {
                claimMember: {
                  select: { id: true, name: true },
                },
              },
            })

            if (conflictingInvite) {
              throw new TRPCError({
                code: "CONFLICT",
                message:
                  conflictingInvite.claimMember?.name
                    ? `This email is already bound to an active claim invite for ${conflictingInvite.claimMember.name}.`
                    : "This email is already bound to another active claim invite.",
              })
            }
          }

          const member = await tx.familyMember.create({
            data: {
              familyId: input.familyId,
              userId: null,
              name: input.name,
              nickname: input.nickname ?? null,
              slug,
              image: input.image ?? null,
              role: "MEMBER",
            },
          })

          if (!input.email) {
            return {
              member,
              claimInvite: null,
            }
          }

          let code: string | undefined
          for (let attempt = 0; attempt < 3; attempt++) {
            const candidate = generateClaimToken()
            const conflict = await tx.invite.findUnique({ where: { code: candidate } })
            if (!conflict) {
              code = candidate
              break
            }
          }

          if (!code) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to generate a unique claim code. Please try again.",
            })
          }

          const invite = await tx.invite.create({
            data: {
              code,
              type: "EMAIL_BOUND",
              status: "PENDING",
              familyId: input.familyId,
              claimMemberId: member.id,
              invitedEmail: input.email,
              createdById: ctx.session.user.id,
              expiresAt: getInviteExpiryDate(new Date(), CLAIM_DEFAULT_TTL_DAYS),
            },
          })

          return {
            member,
            claimInvite: invite,
          }
        })

        const member = result.member

        console.log(
          `[member:created-unclaimed] id=${member.id} familyId=${member.familyId} createdBy=${ctx.session.user.id} at=${new Date().toISOString()}`,
        )

        if (result.claimInvite) {
          console.log(
            `[claim-link:auto-created] inviteId=${result.claimInvite.id} memberId=${member.id} familyId=${member.familyId} type=${result.claimInvite.type} createdBy=${ctx.session.user.id} at=${new Date().toISOString()}`,
          )
        }

        return {
          id: member.id,
          name: member.name,
          nickname: member.nickname,
          slug: member.slug,
          image: member.image,
          familyId: member.familyId,
          status: "unclaimed" as const,
          claimInvite: result.claimInvite
            ? {
                id: result.claimInvite.id,
                code: result.claimInvite.code,
                type: result.claimInvite.type,
                invitedEmail: result.claimInvite.invitedEmail,
                expiresAt: result.claimInvite.expiresAt,
              }
            : null,
        }
      } catch (error) {
        // Handle Prisma validation/client errors (e.g., schema/client mismatch)
        if (error instanceof Error) {
          const message = error.message || ""
          if (
            message.includes("Unknown argument") ||
            message.includes("prisma") ||
            message.includes("schema")
          ) {
            console.error(
              `[member:create-error] Prisma schema/client mismatch: ${message}`,
            )
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message:
                "A database configuration error occurred. Please try again or contact support if this persists.",
            })
          }
        }

        // Re-throw if it's already a TRPCError (like CONFLICT, etc.)
        if (error instanceof TRPCError) {
          throw error
        }

        // Handle other unexpected errors
        console.error(
          `[member:create-error] Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        )
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred. Please try again.",
        })
      }
    }),

  /**
   * Protected mutation: Update a family member role.
   * Only owners can change roles, and owner assignment is intentionally excluded.
   */
  updateMemberRole: protectedProcedure
    .input(
      z.object({
        memberId: z.string().cuid(),
        role: z.enum(["MEMBER", "ADMIN"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.familyMember.findUnique({
        where: { id: input.memberId },
        select: {
          id: true,
          familyId: true,
          role: true,
        },
      })

      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Family member not found" })
      }

      const callerMembership = await requireOwnerMembership(
        ctx.db,
        member.familyId,
        ctx.session.user.id,
      )

      if (member.id === callerMembership.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot change your own role",
        })
      }

      if (member.role === "OWNER") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Owner role changes require ownership transfer",
        })
      }

      const updatedMember = await ctx.db.familyMember.update({
        where: { id: member.id },
        data: { role: input.role },
        select: {
          id: true,
          role: true,
        },
      })

      return updatedMember
    }),

  /**
   * Protected mutation: Generate a claim link for an unclaimed family member.
   * Only owner/admin may issue claim links.
   * Revokes any existing active claim links for the same member before creating a new one.
   */
  createClaimLink: protectedProcedure
    .input(createClaimLinkInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Resolve the target member and check it exists
      const member = await ctx.db.familyMember.findUnique({
        where: { id: input.familyMemberId },
      })

      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Family member not found" })
      }

      // Permission: caller must be admin/owner of the member's family
      await requireAdminMembership(ctx.db, member.familyId, ctx.session.user.id)

      // Reject claim-link creation for already-claimed members
      if (isMemberAlreadyClaimed(member)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: CLAIM_ERROR_CODES.MEMBER_ALREADY_CLAIMED,
        })
      }

      // Generate a unique code (retry up to 3 times on collision)
      let code: string | undefined
      for (let attempt = 0; attempt < 3; attempt++) {
        const candidate = generateClaimToken()
        const conflict = await ctx.db.invite.findUnique({ where: { code: candidate } })
        if (!conflict) {
          code = candidate
          break
        }
      }

      if (!code) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate a unique claim code. Please try again.",
        })
      }

      const expiresAt = getInviteExpiryDate(new Date(), input.expiresInDays)
      const type = input.invitedEmail ? "EMAIL_BOUND" : "OPEN"

      if (input.invitedEmail) {
        const conflictingInvite = await ctx.db.invite.findFirst({
          where: {
            type: "EMAIL_BOUND",
            invitedEmail: input.invitedEmail,
            status: "PENDING",
            claimedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
            claimMemberId: { not: member.id },
          },
          include: {
            claimMember: {
              select: { id: true, name: true },
            },
          },
        })

        if (conflictingInvite) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              conflictingInvite.claimMember?.name
                ? `This email is already bound to an active claim invite for ${conflictingInvite.claimMember.name}.`
                : "This email is already bound to another active claim invite.",
          })
        }
      }

      // Revoke any currently active claim links for this member before creating a new one
      await ctx.db.invite.updateMany({
        where: {
          claimMemberId: member.id,
          status: "PENDING",
          revokedAt: null,
        },
        data: {
          status: "REVOKED",
          revokedAt: new Date(),
        },
      })

      const invite = await ctx.db.invite.create({
        data: {
          code,
          type,
          status: "PENDING",
          familyId: member.familyId,
          claimMemberId: member.id,
          invitedEmail: input.invitedEmail ?? null,
          createdById: ctx.session.user.id,
          expiresAt,
        },
      })

      console.log(
        `[claim-link:created] inviteId=${invite.id} memberId=${member.id} familyId=${member.familyId} type=${type} createdBy=${ctx.session.user.id} at=${new Date().toISOString()}`,
      )

      return {
        id: invite.id,
        code: invite.code,
        type: invite.type,
        invitedEmail: invite.invitedEmail,
        expiresAt: invite.expiresAt,
        memberId: member.id,
        memberName: member.name,
      }
    }),

  /**
   * Public query: Fetch claim-link preview by token for the claim page.
   * Returns enough member/family context to render the page without exposing sensitive data.
   */
  getClaimLinkByToken: publicProcedure
    .input(claimLinkLookupInputSchema)
    .query(async ({ ctx, input }) => {
      // Rate limit: 30 lookups per minute per IP
      const ip = getClientIp(ctx.headers)
      const rl = checkRateLimit(`claim:lookup:${ip}`, 30, 60_000)
      if (!rl.ok) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many requests. Please try again later.",
        })
      }

      const invite = await ctx.db.invite.findUnique({
        where: { code: input.code },
        include: {
          family: { select: { id: true, name: true } },
          claimMember: { select: { id: true, name: true, image: true, userId: true } },
          createdBy: { select: { id: true } },
        },
      })

      const state = getClaimLifecycleState(invite)

      // For non-valid states surface a minimal shape so the UI can render the
      // correct error state without leaking invite internals.
      if (state !== "valid") {
        return { state }
      }

      // At this point invite is non-null and valid
      const inv = invite!

      if (!isClaimInvite(inv)) {
        return { state: "invalid" as const }
      }

      if (isMemberAlreadyClaimed(inv.claimMember!)) {
        return { state: "memberAlreadyClaimed" as const }
      }

      return {
        state,
        invite: {
          id: inv.id,
          code: inv.code,
          type: inv.type,
          invitedEmail: inv.invitedEmail,
          expiresAt: inv.expiresAt,
        },
        member: {
          id: inv.claimMember!.id,
          name: inv.claimMember!.name,
          image: inv.claimMember!.image,
        },
        family: {
          id: inv.family.id,
          name: inv.family.name,
        },
      }
    }),

  /**
   * Public mutation: Claim an existing family member profile with a new account.
   * Validates the token, email binding, and member claim status, then creates the
   * user account and links it to the existing FamilyMember record atomically.
   */
  claimMemberProfile: publicProcedure
    .input(claimMemberInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Rate limit: 5 attempts per 15 minutes per IP
      const ip = getClientIp(ctx.headers)
      const rl = checkRateLimit(`claim:submit:${ip}`, 5, 15 * 60_000)
      if (!rl.ok) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many requests. Please try again later.",
        })
      }

      // Fetch invite with member and family
      const invite = await ctx.db.invite.findUnique({
        where: { code: input.code },
        include: {
          claimMember: true,
        },
      })

      // Unknown token
      const state = getClaimLifecycleState(invite)

      if (state === "invalid") {
        throw new TRPCError({ code: "NOT_FOUND", message: CLAIM_ERROR_CODES.INVALID_TOKEN })
      }

      if (state === "revoked") {
        throw new TRPCError({ code: "FORBIDDEN", message: CLAIM_ERROR_CODES.REVOKED_LINK })
      }

      if (state === "claimed") {
        throw new TRPCError({ code: "CONFLICT", message: CLAIM_ERROR_CODES.LINK_ALREADY_USED })
      }

      if (state === "expired") {
        throw new TRPCError({ code: "BAD_REQUEST", message: CLAIM_ERROR_CODES.EXPIRED_LINK })
      }

      // invite is non-null here
      const inv = invite!

      // Ensure this is a claim invite (not a registration invite)
      if (!isClaimInvite(inv)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: CLAIM_ERROR_CODES.NOT_A_CLAIM_INVITE })
      }

      // claimMember must exist (cascade delete guard)
      if (!inv.claimMember) {
        throw new TRPCError({ code: "NOT_FOUND", message: CLAIM_ERROR_CODES.INVALID_TOKEN })
      }

      // Reject if the member has already been claimed
      if (isMemberAlreadyClaimed(inv.claimMember)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: CLAIM_ERROR_CODES.MEMBER_ALREADY_CLAIMED,
        })
      }

      // Validate optional email binding
      const emailCheck = validateClaimEmailBinding(
        { type: inv.type, invitedEmail: inv.invitedEmail },
        input.email,
      )

      if (!emailCheck.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: emailCheck.reason,
        })
      }

      // Reject if email is already registered
      const existingUser = await ctx.db.user.findUnique({ where: { email: input.email } })
      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists. Please sign in instead.",
        })
      }

      const hashedPassword = await bcrypt.hash(input.password, 12)

      let claimedUserId: string

      try {
        claimedUserId = await ctx.db.$transaction(async (tx: Prisma.TransactionClient) => {
          // Create the user account (auth layer only — name/image live on FamilyMember)
          const user = await tx.user.create({
            data: { email: input.email, password: hashedPassword },
          })

          const claimedAt = new Date()

          // Atomically mark the invite as claimed — guard against concurrent claims
          const claimResult = await tx.invite.updateMany({
            where: {
              id: inv.id,
              status: "PENDING",
              claimedAt: null,
              revokedAt: null,
              expiresAt: { gt: claimedAt },
            },
            data: {
              status: "CLAIMED",
              claimedById: user.id,
              claimedAt,
            },
          })

          if (claimResult.count === 0) {
            throw new TRPCError({
              code: "CONFLICT",
              message: CLAIM_ERROR_CODES.LINK_ALREADY_USED,
            })
          }

          // Link the new user to the existing FamilyMember — this is the "claim"
          await tx.familyMember.update({
            where: { id: inv.claimMember!.id },
            data: { userId: user.id },
          })

          return user.id
        })
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error

        // Prisma P2002 = unique constraint violation (email race condition)
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: string }).code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "An account with this email already exists. Please sign in instead.",
          })
        }

        throw error
      }

      console.log(
        `[claim:success] inviteId=${inv.id} memberId=${inv.claimMember.id} userId=${claimedUserId} familyId=${inv.familyId} at=${new Date().toISOString()}`,
      )

      return {
        userId: claimedUserId,
        memberId: inv.claimMember.id,
        familyId: inv.familyId,
      }
    }),
})
