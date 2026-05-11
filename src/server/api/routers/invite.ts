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

/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-return */

export const inviteRouter = createTRPCRouter({
  /**
   * Public query: Get invite details by code for pre-acceptance viewing.
   * Returns family info and invite metadata but no sensitive claim history.
   */
  getByCode: publicProcedure
    .input(inviteLookupInputSchema)
    .query(async ({ ctx, input }) => {
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
      const result = await ctx.db.$transaction(async (tx: Prisma.TransactionClient) => {
        // Create user
        const user = await tx.user.create({
          data: {
            name: input.name,
            email: input.email,
            password: hashedPassword,
          },
        })

        // Claim invite
        await tx.invite.update({
          where: { id: invite.id },
          data: {
            status: "CLAIMED",
            claimedById: user.id,
            claimedAt: new Date(),
          },
        })

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

      return {
        userId: result.id,
        email: result.email,
        name: result.name,
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

      return {
        id: revoked.id,
        status: revoked.status,
      }
    }),
})
