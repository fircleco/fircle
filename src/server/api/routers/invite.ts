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
  generateInviteCode,
  getInviteExpiryDate,
  getInviteLifecycleState,
  isInviteUsable,
  validateInviteEmailBinding,
} from "~/lib/invite"
import {
  inviteLookupInputSchema,
  inviteAcceptInputSchema,
  inviteCreateInputSchema,
  inviteRevokeInputSchema,
} from "~/lib/invite-schemas"
import { normalizeEmail } from "~/lib/email"
import { checkRateLimit, getClientIp } from "~/lib/rate-limit"

export const inviteRouter = createTRPCRouter({
  /**
   * Public query: Get invite details by code for pre-acceptance viewing.
   * Returns family info and invite metadata but no sensitive claim history.
   */
  getByCode: publicProcedure
    .input(inviteLookupInputSchema)
    .query(async ({ ctx, input }) => {
      // Rate limit: 30 lookups per minute per IP
      const ip = getClientIp(ctx.headers)
      const lookupRateLimit = checkRateLimit(`invite:lookup:${ip}`, 30, 60_000)
      if (!lookupRateLimit.ok) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many requests. Please try again later.",
        })
      }

      const invite = await ctx.db.invite.findUnique({
        where: { code: input.code },
        include: { family: true },
      })

      if (!invite) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invite not found",
        })
      }

      const state = getInviteLifecycleState({
        status: invite.status,
        expiresAt: invite.expiresAt,
        claimedAt: invite.claimedAt,
        revokedAt: invite.revokedAt,
      })

      // Map lifecycle state to user-facing error codes
      if (state === "revoked") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This invite has been revoked",
        })
      }

      if (state === "claimed") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This invite has already been used",
        })
      }

      if (state === "expired") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "This invite has expired",
        })
      }

      return {
        id: invite.id,
        code: invite.code,
        family: {
          id: invite.family.id,
          name: invite.family.name,
          description: invite.family.description,
        },
        type: invite.type,
        invitedEmail: invite.invitedEmail,
        expiresAt: invite.expiresAt,
      }
    }),

  /**
   * Public mutation: Accept invite and create account in a transaction.
   * Validates invite state, email binding, and account uniqueness.
   */
  acceptInvite: publicProcedure
    .input(inviteAcceptInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Rate limit: 5 acceptance attempts per 15 minutes per IP
      const ip = getClientIp(ctx.headers)
      const acceptRateLimit = checkRateLimit(`invite:accept:${ip}`, 5, 15 * 60_000)
      if (!acceptRateLimit.ok) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many requests. Please try again later.",
        })
      }

      // Fetch invite with all necessary fields
      const invite = await ctx.db.invite.findUnique({
        where: { code: input.code },
      })

      if (!invite) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invite not found",
        })
      }

      // Check invite usability
      if (!isInviteUsable(invite)) {
        const state = getInviteLifecycleState(invite)
        if (state === "revoked") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This invite has been revoked",
          })
        }
        if (state === "claimed") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This invite has already been used",
          })
        }
        if (state === "expired") {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "This invite has expired",
          })
        }
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This invite is not valid",
        })
      }

      // Validate email binding
      const bindingCheck = validateInviteEmailBinding(
        {
          type: invite.type,
          invitedEmail: invite.invitedEmail,
        },
        input.email,
      )

      if (!bindingCheck.ok) {
        if (bindingCheck.reason === "EMAIL_MISMATCH") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This invite is reserved for a different email address",
          })
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Invite binding validation failed",
        })
      }

      // Check if email is already registered
      const existingUser = await ctx.db.user.findUnique({
        where: { email: input.email },
      })

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists. Please sign in instead.",
        })
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(input.password, 12)

      // Create user and claim invite in a transaction
      let result: {
        id: string
        email: string | null
        name: string | null
      }

      try {
        result = await ctx.db.$transaction(async (tx: Prisma.TransactionClient) => {
          // Create user
          const user = await tx.user.create({
            data: {
              name: input.name,
              email: input.email,
              password: hashedPassword,
            },
          })

          const claimedAt = new Date()

          // Claim invite atomically - only succeeds if invite is still usable.
          const claimResult = await tx.invite.updateMany({
            where: {
              id: invite.id,
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
              message: "This invite is no longer valid",
            })
          }

          // Add user to family
          await tx.familyMember.create({
            data: {
              familyId: invite.familyId,
              userId: user.id,
              role: "MEMBER",
            },
          })

          return user
        })
      } catch (error: unknown) {
        if (error instanceof TRPCError) {
          throw error
        }

        // Prisma unique violation for duplicate email under concurrent requests.
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
        `[invite:claimed] code=${invite.code} userId=${result.id} familyId=${invite.familyId} at=${new Date().toISOString()}`,
      )

      return {
        userId: result.id,
        email: result.email,
        name: result.name,
      }
    }),

  /**
   * Protected query: Resolve invite management context for current user.
   * Returns primary family and whether invite management actions are allowed.
   */
  getManagementContext: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.familyMember.findMany({
      where: { userId: ctx.session.user.id },
      include: {
        family: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    const manageableMembership = memberships.find(
      (membership) => membership.role === "ADMIN" || membership.role === "OWNER",
    )

    const selectedMembership = manageableMembership ?? memberships[0] ?? null

    return {
      family: selectedMembership
        ? {
            id: selectedMembership.family.id,
            name: selectedMembership.family.name,
          }
        : null,
      role: selectedMembership?.role ?? null,
      canManageInvites:
        selectedMembership?.role === "ADMIN" || selectedMembership?.role === "OWNER",
    }
  }),

  /**
   * Protected mutation: Create a new invite (admin-only).
   * Generates a unique code and sets expiry based on TTL.
   */
  createInvite: protectedProcedure
    .input(inviteCreateInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if user is admin or owner of the family
      const membership = await ctx.db.familyMember.findUnique({
        where: {
          familyId_userId: {
            familyId: input.familyId,
            userId: ctx.session.user.id,
          },
        },
      })

      if (!membership || (membership.role !== "ADMIN" && membership.role !== "OWNER")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to create invites for this family",
        })
      }

      // Generate unique code (retry up to 3 times in case of collision)
      let code: string
      let attempts = 0
      const maxAttempts = 3

      while (attempts < maxAttempts) {
        code = generateInviteCode()
        const existing = await ctx.db.invite.findUnique({
          where: { code },
        })
        if (!existing) break
        attempts++
      }

      if (attempts >= maxAttempts) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate unique invite code",
        })
      }

      // Create invite
      const invite = await ctx.db.invite.create({
        data: {
          code: code!,
          type: input.type,
          invitedEmail:
            input.type === "EMAIL_BOUND"
              ? normalizeEmail(input.invitedEmail!)
              : null,
          familyId: input.familyId,
          createdById: ctx.session.user.id,
          expiresAt: getInviteExpiryDate(new Date(), input.expiresInDays),
          status: "PENDING",
        },
      })

      console.log(
        `[invite:created] id=${invite.id} code=${invite.code} type=${invite.type} familyId=${invite.familyId} createdBy=${ctx.session.user.id} at=${new Date().toISOString()}`,
      )

      return {
        id: invite.id,
        code: invite.code,
        type: invite.type,
        invitedEmail: invite.invitedEmail,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      }
    }),

  /**
   * Protected query: List all invites for a family (admin-only).
   * Returns invite codes, statuses, and claim history.
   */
  listInvites: protectedProcedure
    .input(z.object({ familyId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      // Check if user is admin or owner of the family
      const membership = await ctx.db.familyMember.findUnique({
        where: {
          familyId_userId: {
            familyId: input.familyId,
            userId: ctx.session.user.id,
          },
        },
      })

      if (!membership || (membership.role !== "ADMIN" && membership.role !== "OWNER")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to view invites for this family",
        })
      }

      const invites = await ctx.db.invite.findMany({
        where: { familyId: input.familyId },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          claimedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      })

      const now = new Date()

      return invites.map((inv: typeof invites[number]) => ({
        id: inv.id,
        code: inv.code,
        type: inv.type,
        invitedEmail: inv.invitedEmail,
        status: inv.status,
        lifecycleState: getInviteLifecycleState({
          status: inv.status,
          expiresAt: inv.expiresAt,
          claimedAt: inv.claimedAt,
          revokedAt: inv.revokedAt,
        }, now),
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        createdBy: {
          id: inv.createdBy.id,
          name: inv.createdBy.name,
          email: inv.createdBy.email,
        },
        claimedAt: inv.claimedAt,
        claimedBy: inv.claimedBy
          ? {
              id: inv.claimedBy.id,
              name: inv.claimedBy.name,
              email: inv.claimedBy.email,
            }
          : null,
      }))
    }),

  /**
   * Protected mutation: Revoke an invite (admin-only).
   * Prevents further use of an invite by marking it revoked.
   */
  revokeInvite: protectedProcedure
    .input(inviteRevokeInputSchema)
    .mutation(async ({ ctx, input }) => {
      const invite = await ctx.db.invite.findUnique({
        where: { id: input.inviteId },
      })

      if (!invite) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invite not found",
        })
      }

      // Check if user is admin or owner of the family
      const membership = await ctx.db.familyMember.findUnique({
        where: {
          familyId_userId: {
            familyId: invite.familyId,
            userId: ctx.session.user.id,
          },
        },
      })

      if (!membership || (membership.role !== "ADMIN" && membership.role !== "OWNER")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to revoke invites for this family",
        })
      }

      // Revoke invite
      const revoked = await ctx.db.invite.update({
        where: { id: input.inviteId },
        data: {
          status: "REVOKED",
          revokedAt: new Date(),
        },
      })

      console.log(
        `[invite:revoked] id=${revoked.id} familyId=${invite.familyId} revokedBy=${ctx.session.user.id} at=${new Date().toISOString()}`,
      )

      return {
        id: revoked.id,
        status: revoked.status,
      }
    }),
})
