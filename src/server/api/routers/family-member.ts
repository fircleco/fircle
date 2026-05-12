import bcrypt from "bcryptjs"
import { TRPCError } from "@trpc/server"
import { type Prisma } from "../../../../generated/prisma"

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc"
import {
  generateClaimToken,
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

  if (!membership || (membership.role !== "ADMIN" && membership.role !== "OWNER")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to perform this action in this family",
    })
  }

  return membership
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const familyMemberRouter = createTRPCRouter({
  /**
   * Protected mutation: Create an unclaimed family member profile.
   * Only owner/admin may create unclaimed members for a family.
   */
  createUnclaimedMember: protectedProcedure
    .input(createUnclaimedMemberInputSchema)
    .mutation(async ({ ctx, input }) => {
      await requireAdminMembership(ctx.db, input.familyId, ctx.session.user.id)

      // Prevent duplicate names within the same family (case-insensitive).
      // This is a soft guard only — no unique index exists on name — so a
      // warning-level conflict is raised rather than a silent duplicate.
      const existing = await ctx.db.familyMember.findFirst({
        where: {
          familyId: input.familyId,
          name: { equals: input.name, mode: "insensitive" },
        },
      })

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A family member named "${input.name}" already exists in this family`,
        })
      }

      const member = await ctx.db.familyMember.create({
        data: {
          familyId: input.familyId,
          userId: null,
          name: input.name,
          image: input.image ?? null,
          role: "MEMBER",
        },
      })

      console.log(
        `[member:created-unclaimed] id=${member.id} familyId=${member.familyId} createdBy=${ctx.session.user.id} at=${new Date().toISOString()}`,
      )

      return {
        id: member.id,
        name: member.name,
        image: member.image,
        familyId: member.familyId,
        status: "unclaimed" as const,
      }
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
        return { state: "invalid" as const }
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
