import bcrypt from "bcryptjs"
import { TRPCError } from "@trpc/server"
import type { Prisma } from "../../../../generated/prisma"
import { z } from "zod"

import { env } from "~/env"
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc"
import {
  generateInviteCode,
  getInviteExpiryDate,
  getInviteLifecycleState,
  getReusableInviteLifecycleState,
  isInviteUsable,
  isReusableInvite,
  isReusableInviteUsable,
  validateInviteEmailBinding,
} from "~/lib/invite"
import {
  getActiveReusableInviteInputSchema,
  inviteLookupInputSchema,
  inviteAcceptInputSchema,
  inviteCreateInputSchema,
  inviteRevokeInputSchema,
  resetReusableInviteInputSchema,
  retryEmailSendInputSchema,
} from "~/lib/invite-schemas"
import { normalizeEmail } from "~/lib/email"
import { formatFamilyLockup } from "~/lib/family-name"
import { checkRateLimit, getClientIp } from "~/lib/rate-limit"
import { getMemberSlugBase, resolveUniqueMemberSlug } from "~/lib/member-slug"
import { findTenantUserByEmail } from "~/lib/tenant-users"
import {
  buildClaimLinkCreatedTemplate,
  buildFailedDeliveryResult,
  buildInviteCreatedTemplate,
  buildSentDeliveryResult,
  buildSkippedDeliveryResult,
  getEmailProvider,
  resolveAppBaseUrlFromHeaders,
  type EmailDeliveryResult,
} from "~/server/email"
import {
  createNotifications,
  dispatchPushForNotifications,
  getClaimedAdminMemberIds,
} from "~/server/notifications"

const REUSABLE_INVITE_FUTURE_EXPIRY = new Date("2999-12-31T00:00:00.000Z")

function buildReusableInviteSummary(invite: {
  id: string
  code: string
  familyId: string
  isReusable: boolean
  status: "PENDING" | "CLAIMED" | "EXPIRED" | "REVOKED"
  createdAt: Date
  updatedAt: Date
  revokedAt: Date | null
  rotatedFromInviteId: string | null
  useCount: number
  lastUsedAt: Date | null
}) {
  return {
    id: invite.id,
    code: invite.code,
    familyId: invite.familyId,
    isReusable: true as const,
    status: invite.status,
    lifecycleState: getReusableInviteLifecycleState(invite),
    createdAt: invite.createdAt,
    updatedAt: invite.updatedAt,
    revokedAt: invite.revokedAt,
    rotatedFromInviteId: invite.rotatedFromInviteId,
    useCount: invite.useCount,
    lastUsedAt: invite.lastUsedAt,
  }
}

export const inviteRouter = createTRPCRouter({
  getActiveReusableInvite: protectedProcedure
    .input(getActiveReusableInviteInputSchema)
    .query(async ({ ctx, input }) => {
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
          message: "You do not have permission to view family invite links for this family",
        })
      }

      const activeReusableInvite = await ctx.db.invite.findFirst({
        where: {
          familyId: input.familyId,
          isReusable: true,
          claimMemberId: null,
          status: "PENDING",
          revokedAt: null,
        },
        orderBy: { createdAt: "desc" },
      })

      if (activeReusableInvite) {
        return buildReusableInviteSummary(activeReusableInvite)
      }

      const latestReusableInvite = await ctx.db.invite.findFirst({
        where: {
          familyId: input.familyId,
          isReusable: true,
          claimMemberId: null,
        },
        orderBy: { createdAt: "desc" },
      })

      if (!latestReusableInvite) {
        return null
      }

      return buildReusableInviteSummary(latestReusableInvite)
    }),

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

      const state = isReusableInvite(invite)
        ? getReusableInviteLifecycleState(invite)
        : getInviteLifecycleState({
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

      if (state === "invalid") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This invite is not valid",
        })
      }

      return {
        id: invite.id,
        code: invite.code,
        isReusable: invite.isReusable,
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
      if (isReusableInvite(invite)) {
        if (!isReusableInviteUsable(invite)) {
          const state = getReusableInviteLifecycleState(invite)
          if (state === "revoked") {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "This invite has been revoked",
            })
          }

          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This invite is not valid",
          })
        }
      } else if (!isInviteUsable(invite)) {
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
      const existingUser = await findTenantUserByEmail(ctx.db, invite.familyId, input.email)

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
      }
      let createdNotificationsFromAcceptInvite: Awaited<ReturnType<typeof createNotifications>> = []

      try {
        const transactionResult = await ctx.db.$transaction(async (tx: Prisma.TransactionClient) => {
          let createdNotifications: Awaited<ReturnType<typeof createNotifications>> = []

          // Create user
          const user = await tx.user.create({
            data: {
              familyId: invite.familyId,
              email: input.email,
              password: hashedPassword,
            },
          })

          const claimedAt = new Date()

          const claimResult = isReusableInvite(invite)
            ? await tx.invite.updateMany({
                where: {
                  id: invite.id,
                  isReusable: true,
                  status: "PENDING",
                  revokedAt: null,
                },
                data: {
                  useCount: {
                    increment: 1,
                  },
                  lastUsedAt: claimedAt,
                },
              })
            : await tx.invite.updateMany({
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
          const baseSlug = getMemberSlugBase(input.name)
          const slug = await resolveUniqueMemberSlug(tx, invite.familyId, baseSlug)

          await tx.familyMember.create({
            data: {
              familyId: invite.familyId,
              userId: user.id,
              name: input.name,
              slug,
              role: "MEMBER",
            },
          })

          const adminRecipientIds = await getClaimedAdminMemberIds(tx, invite.familyId)
          if (adminRecipientIds.length > 0) {
            createdNotifications = await createNotifications(
              tx,
              adminRecipientIds.map((recipientMemberId) => ({
                familyId: invite.familyId,
                recipientMemberId,
                actorMemberId: null,
                category: "INVITE" as const,
                eventType: "INVITE_STATUS_CHANGED" as const,
                sourceType: "invite",
                sourceId: invite.id,
                title: isReusableInvite(invite)
                  ? "A family invite link was used"
                  : "An invite was claimed",
                body: isReusableInvite(invite)
                  ? "A reusable family invite link was used to join the family."
                  : "A pending invite has been claimed.",
              })),
            )
          }

          return {
            user,
            createdNotifications,
          }
        })

        result = transactionResult.user
        createdNotificationsFromAcceptInvite = transactionResult.createdNotifications
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

        // Handle Prisma validation/client errors (e.g., schema/client mismatch)
        if (error instanceof Error) {
          const message = error.message || ""
          if (
            message.includes("Unknown argument") ||
            message.includes("prisma") ||
            message.includes("schema")
          ) {
            console.error(
              `[invite:accept-error] Prisma schema/client mismatch: ${message}`,
            )
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message:
                "A database configuration error occurred. Please try again or contact support if this persists.",
            })
          }
        }

        // Handle other unexpected errors
        console.error(
          `[invite:accept-error] Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        )
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred. Please try again.",
        })
      }

      void dispatchPushForNotifications(createdNotificationsFromAcceptInvite)

      console.log(
        `[invite:claimed] code=${invite.code} userId=${result.id} familyId=${invite.familyId} at=${new Date().toISOString()}`,
      )

      return {
        userId: result.id,
        email: result.email,
      }
    }),

  resetReusableInvite: protectedProcedure
    .input(resetReusableInviteInputSchema)
    .mutation(async ({ ctx, input }) => {
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
          message: "You do not have permission to manage family invite links for this family",
        })
      }

      const result = await ctx.db.$transaction(async (tx) => {
        const activeReusableInvite = await tx.invite.findFirst({
          where: {
            familyId: input.familyId,
            isReusable: true,
            claimMemberId: null,
            status: "PENDING",
            revokedAt: null,
          },
          orderBy: { createdAt: "desc" },
        })

        const resetAt = new Date()

        if (activeReusableInvite) {
          await tx.invite.updateMany({
            where: {
              familyId: input.familyId,
              isReusable: true,
              claimMemberId: null,
              status: "PENDING",
              revokedAt: null,
            },
            data: {
              status: "REVOKED",
              revokedAt: resetAt,
            },
          })
        }

        let code: string | undefined

        for (let attempt = 0; attempt < 3; attempt++) {
          const candidate = generateInviteCode()
          const conflict = await tx.invite.findUnique({ where: { code: candidate } })
          if (!conflict) {
            code = candidate
            break
          }
        }

        if (!code) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to generate unique invite code",
          })
        }

        const createdInvite = await tx.invite.create({
          data: {
            code,
            type: "OPEN",
            invitedEmail: null,
            familyId: input.familyId,
            createdById: ctx.session.user.id,
            expiresAt: REUSABLE_INVITE_FUTURE_EXPIRY,
            status: "PENDING",
            isReusable: true,
            rotatedFromInviteId: activeReusableInvite?.id ?? null,
          },
        })

        const adminRecipientIds = await getClaimedAdminMemberIds(tx, input.familyId, [membership.id])
        if (adminRecipientIds.length > 0) {
          const notifications = []

          if (activeReusableInvite) {
            notifications.push(
              ...adminRecipientIds.map((recipientMemberId) => ({
                familyId: input.familyId,
                recipientMemberId,
                actorMemberId: membership.id,
                category: "INVITE" as const,
                eventType: "INVITE_STATUS_CHANGED" as const,
                sourceType: "invite",
                sourceId: activeReusableInvite.id,
                title: "A family invite link was reset",
                body: "A family admin reset the reusable family invite link.",
              })),
            )
          }

          notifications.push(
            ...adminRecipientIds.map((recipientMemberId) => ({
              familyId: input.familyId,
              recipientMemberId,
              actorMemberId: membership.id,
              category: "INVITE" as const,
              eventType: "INVITE_CREATED" as const,
              sourceType: "invite",
              sourceId: createdInvite.id,
              title: "A new family invite link was created",
              body: "A family admin created a reusable family invite link.",
            })),
          )

          const createdNotifications = await createNotifications(tx, notifications)
          void dispatchPushForNotifications(createdNotifications)
        }

        return createdInvite
      })

      return buildReusableInviteSummary(result)
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

      // For email-bound invites, validate the target email
      if (input.type === "EMAIL_BOUND" && input.invitedEmail) {
        const normalizedEmail = normalizeEmail(input.invitedEmail)

        // Check if email is already a registered user
        const existingUser = await findTenantUserByEmail(ctx.db, input.familyId, normalizedEmail)
        if (existingUser) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This email address is already registered. No invite needed.",
          })
        }

        // Check if email already has a pending invite for this family
        const existingPendingInvite = await ctx.db.invite.findFirst({
          where: {
            familyId: input.familyId,
            invitedEmail: normalizedEmail,
            status: "PENDING",
            expiresAt: { gt: new Date() },
          },
        })
        if (existingPendingInvite) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "There is already a pending invite for this email address.",
          })
        }
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
        include: {
          family: {
            select: {
              name: true,
            },
          },
        },
      })

      const createdNotifications = await ctx.db.$transaction(async (tx) => {
        const adminRecipientIds = await getClaimedAdminMemberIds(tx, input.familyId, [membership.id])
        if (adminRecipientIds.length === 0) {
          return []
        }

        return createNotifications(
          tx,
          adminRecipientIds.map((recipientMemberId) => ({
            familyId: input.familyId,
            recipientMemberId,
            actorMemberId: membership.id,
            category: "INVITE" as const,
            eventType: "INVITE_CREATED" as const,
            sourceType: "invite",
            sourceId: invite.id,
            title: "A new invite was created",
            body: "A family admin created a new invite.",
          })),
        )
      })

      void dispatchPushForNotifications(createdNotifications)

      console.log(
        `[invite:created] id=${invite.id} code=${invite.code} type=${invite.type} familyId=${invite.familyId} createdBy=${ctx.session.user.id} at=${new Date().toISOString()}`,
      )

      let emailDelivery: EmailDeliveryResult | null = null

      if (invite.type === "EMAIL_BOUND" && invite.invitedEmail) {
        const emailProvider = getEmailProvider()
        const appBaseUrl = resolveAppBaseUrlFromHeaders(ctx.headers)
        const fromAddress = env.EMAIL_FROM_ADDRESS ? String(env.EMAIL_FROM_ADDRESS) : null
        const fromName = env.EMAIL_FROM_NAME
          ? String(env.EMAIL_FROM_NAME)
          : formatFamilyLockup(invite.family.name)

        if (!emailProvider) {
          console.info(
            `[invite:email-skipped] inviteId=${invite.id} reason=email-provider-not-configured`,
          )
          emailDelivery = buildSkippedDeliveryResult("provider_not_configured")
        } else if (!appBaseUrl) {
          console.warn(
            `[invite:email-skipped] inviteId=${invite.id} reason=app-base-url-unresolved`,
          )
          emailDelivery = buildSkippedDeliveryResult("base_url_unresolved")
        } else if (!fromAddress) {
          console.warn(
            `[invite:email-skipped] inviteId=${invite.id} reason=missing-from-address`,
          )
          emailDelivery = buildSkippedDeliveryResult("missing_from_address")
        } else {
          const template = buildInviteCreatedTemplate({
            familyName: invite.family.name,
            inviteCode: invite.code,
            appBaseUrl,
            expiresAt: invite.expiresAt,
          })

          try {
            const sendResult = await emailProvider.send({
              event: "invite-created",
              to: { email: invite.invitedEmail },
              from: { email: fromAddress, name: fromName },
              subject: template.subject,
              html: template.html,
              text: template.text,
              metadata: {
                client_reference: `invite-created:${invite.id}`,
                invite_id: invite.id,
                family_id: invite.familyId,
              },
            })
            emailDelivery = buildSentDeliveryResult(sendResult)
          } catch (error) {
            console.error(
              `[invite:email-send-failed] inviteId=${invite.id} familyId=${invite.familyId} reason=${error instanceof Error ? error.message : String(error)}`,
            )
            emailDelivery = buildFailedDeliveryResult(error)
          }
        }
      }

      return {
        id: invite.id,
        code: invite.code,
        type: invite.type,
        invitedEmail: invite.invitedEmail,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
        emailDelivery,
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
          createdBy: { select: { id: true, email: true } },
          claimedBy: { select: { id: true, email: true } },
          claimMember: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: "desc" },
      })

      const now = new Date()

      return invites.map((inv: typeof invites[number]) => ({
        id: inv.id,
        code: inv.code,
        type: inv.type,
        isReusable: inv.isReusable,
        isClaimInvite: inv.claimMemberId !== null,
        claimMember: inv.claimMember
          ? {
              id: inv.claimMember.id,
              name: inv.claimMember.name,
              slug: inv.claimMember.slug,
            }
          : null,
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
          name: null,
          email: inv.createdBy.email,
        },
        claimedAt: inv.claimedAt,
        claimedBy: inv.claimedBy
          ? {
              id: inv.claimedBy.id,
              name: null,
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

      const createdNotifications = await ctx.db.$transaction(async (tx) => {
        const adminRecipientIds = await getClaimedAdminMemberIds(tx, invite.familyId, [membership.id])
        if (adminRecipientIds.length === 0) {
          return []
        }

        return createNotifications(
          tx,
          adminRecipientIds.map((recipientMemberId) => ({
            familyId: invite.familyId,
            recipientMemberId,
            actorMemberId: membership.id,
            category: "INVITE" as const,
            eventType: "INVITE_STATUS_CHANGED" as const,
            sourceType: "invite",
            sourceId: invite.id,
            title: "An invite was revoked",
            body: "A family admin revoked an invite.",
          })),
        )
      })

      void dispatchPushForNotifications(createdNotifications)

      console.log(
        `[invite:revoked] id=${revoked.id} familyId=${invite.familyId} revokedBy=${ctx.session.user.id} at=${new Date().toISOString()}`,
      )

      return {
        id: revoked.id,
        status: revoked.status,
      }
    }),

  /**
   * Protected mutation: Retry sending the email for a pending email-bound invite or claim link.
   * Permission-checked and rate-limited. Returns the same EmailDeliveryResult contract.
   */
  retryEmailSend: protectedProcedure
    .input(retryEmailSendInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Rate limit: 5 retries per 5 minutes per user
      const rl = checkRateLimit(`invite:email-retry:${ctx.session.user.id}`, 5, 5 * 60_000)
      if (!rl.ok) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many retry attempts. Please wait a moment before trying again.",
        })
      }

      const invite = await ctx.db.invite.findUnique({
        where: { id: input.inviteId },
        include: {
          family: { select: { name: true } },
          claimMember: { select: { name: true } },
        },
      })

      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found." })
      }

      // Permission: caller must be admin/owner of the invite's family
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
          message: "You do not have permission to retry email sends for this family.",
        })
      }

      // Only email-bound invites with a recipient can be retried
      if (invite.type !== "EMAIL_BOUND" || !invite.invitedEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Email can only be retried for email-bound invites.",
        })
      }

      // Only valid (pending, non-expired) invites can be retried
      const lifecycleState = getInviteLifecycleState({
        status: invite.status,
        expiresAt: invite.expiresAt,
        claimedAt: invite.claimedAt,
        revokedAt: invite.revokedAt,
      })

      if (lifecycleState !== "valid") {
        const stateMessages: Record<string, string> = {
          expired: "This invite has expired. Generate a new one before retrying.",
          claimed: "This invite has already been claimed.",
          revoked: "This invite has been revoked.",
        }
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: stateMessages[lifecycleState] ?? "This invite is no longer valid.",
        })
      }

      console.log(
        `[invite:email-retry:attempt] inviteId=${invite.id} familyId=${invite.familyId} retriedBy=${ctx.session.user.id} at=${new Date().toISOString()}`,
      )

      const emailProvider = getEmailProvider()
      const appBaseUrl = resolveAppBaseUrlFromHeaders(ctx.headers)
      const fromAddress = env.EMAIL_FROM_ADDRESS ? String(env.EMAIL_FROM_ADDRESS) : null
      const fromName = env.EMAIL_FROM_NAME
        ? String(env.EMAIL_FROM_NAME)
        : formatFamilyLockup(invite.family.name)

      if (!emailProvider) {
        console.info(
          `[invite:email-retry:skipped] inviteId=${invite.id} reason=email-provider-not-configured`,
        )
        return { emailDelivery: buildSkippedDeliveryResult("provider_not_configured") }
      }

      if (!appBaseUrl) {
        console.warn(
          `[invite:email-retry:skipped] inviteId=${invite.id} reason=app-base-url-unresolved`,
        )
        return { emailDelivery: buildSkippedDeliveryResult("base_url_unresolved") }
      }

      if (!fromAddress) {
        console.warn(
          `[invite:email-retry:skipped] inviteId=${invite.id} reason=missing-from-address`,
        )
        return { emailDelivery: buildSkippedDeliveryResult("missing_from_address") }
      }

      const isClaimLinkInvite = invite.claimMemberId !== null
      const event = isClaimLinkInvite
        ? ("claim-link-created" as const)
        : ("invite-created" as const)

      const template = isClaimLinkInvite
        ? buildClaimLinkCreatedTemplate({
            familyName: invite.family.name,
            memberName: invite.claimMember?.name ?? "your family member",
            claimToken: invite.code,
            appBaseUrl,
            expiresAt: invite.expiresAt,
          })
        : buildInviteCreatedTemplate({
            familyName: invite.family.name,
            inviteCode: invite.code,
            appBaseUrl,
            expiresAt: invite.expiresAt,
          })

      try {
        const sendResult = await emailProvider.send({
          event,
          to: { email: invite.invitedEmail },
          from: { email: fromAddress, name: fromName },
          subject: template.subject,
          html: template.html,
          text: template.text,
          metadata: {
            client_reference: `${event}:retry:${invite.id}`,
            invite_id: invite.id,
            family_id: invite.familyId,
          },
        })

        console.log(
          `[invite:email-retry:succeeded] inviteId=${invite.id} familyId=${invite.familyId} retriedBy=${ctx.session.user.id} at=${new Date().toISOString()}`,
        )

        return { emailDelivery: buildSentDeliveryResult(sendResult) }
      } catch (error) {
        console.error(
          `[invite:email-retry:failed] inviteId=${invite.id} familyId=${invite.familyId} retriedBy=${ctx.session.user.id} reason=${error instanceof Error ? error.message : String(error)}`,
        )
        return { emailDelivery: buildFailedDeliveryResult(error) }
      }
    }),
})
