import { TRPCError } from "@trpc/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import { verifyDomainOwnership } from "~/server/domain-verification";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Throws FORBIDDEN if the user is not the owner of the family. */
async function requireOwnerMembership(
  familyId: string,
  userId: string,
) {
  const membership = await db.familyMember.findUnique({
    where: {
      familyId_userId: { familyId, userId },
    },
  });

  if (membership?.role !== "OWNER") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the family owner can perform this action",
    });
  }

  return membership;
}

/** Generates a DNS-style verification token. */
function generateVerificationToken(): string {
  return randomBytes(16).toString("hex");
}

// ─── Input Schemas ────────────────────────────────────────────────────────────

const addDomainInputSchema = z.object({
  familyId: z.string().cuid(),
  domain: z.string().toLowerCase().min(3).max(255),
});

const listDomainsInputSchema = z.object({
  familyId: z.string().cuid(),
});

const setPrimaryDomainInputSchema = z.object({
  familyId: z.string().cuid(),
  domainId: z.string().cuid(),
});

const removeDomainInputSchema = z.object({
  familyId: z.string().cuid(),
  domainId: z.string().cuid(),
});

const getVerificationTokenInputSchema = z.object({
  familyId: z.string().cuid(),
  domainId: z.string().cuid(),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const domainRouter = createTRPCRouter({
  /**
   * Protected mutation: Add a new domain to a family (owner-only).
   * Generates a verification token and stores the domain with pending verification.
   */
  addDomain: protectedProcedure
    .input(addDomainInputSchema)
    .mutation(async ({ ctx, input }) => {
      await requireOwnerMembership(input.familyId, ctx.session.user.id);

      // Check if domain is already taken globally
      const existingDomain = await db.domain.findUnique({
        where: { domain: input.domain },
      });

      if (existingDomain) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This domain is already registered. Please choose another.",
        });
      }

      // Generate verification token
      const verificationToken = generateVerificationToken();

      // Create domain record
      const domain = await db.domain.create({
        data: {
          familyId: input.familyId,
          domain: input.domain,
          isPrimary: false,
          verificationToken,
        },
        select: {
          id: true,
          domain: true,
          isPrimary: true,
          verifiedAt: true,
          verificationToken: true,
          createdAt: true,
        },
      });

      console.log(
        `[domain:added] id=${domain.id} familyId=${input.familyId} domain=${input.domain} ownerId=${ctx.session.user.id} at=${new Date().toISOString()}`,
      );

      return domain;
    }),

  /**
   * Protected query: List domains for a family (owner/admin can list).
   */
  listDomains: protectedProcedure
    .input(listDomainsInputSchema)
    .query(async ({ ctx, input }) => {
      const membership = await db.familyMember.findUnique({
        where: {
          familyId_userId: {
            familyId: input.familyId,
            userId: ctx.session.user.id,
          },
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this family",
        });
      }

      const domains = await db.domain.findMany({
        where: { familyId: input.familyId },
        select: {
          id: true,
          domain: true,
          isPrimary: true,
          verifiedAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      });

      return domains;
    }),

  /**
   * Protected mutation: Set a domain as primary (owner-only).
   */
  setPrimaryDomain: protectedProcedure
    .input(setPrimaryDomainInputSchema)
    .mutation(async ({ ctx, input }) => {
      await requireOwnerMembership(input.familyId, ctx.session.user.id);

      const domain = await db.domain.findUnique({
        where: { id: input.domainId },
        select: { familyId: true, domain: true, verifiedAt: true },
      });

      if (!domain) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Domain not found",
        });
      }

      if (domain.familyId !== input.familyId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This domain does not belong to your family",
        });
      }

      if (!domain.verifiedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only verified domains can be set as primary",
        });
      }

      // Unset any previous primary domain for this family
      await db.domain.updateMany({
        where: { familyId: input.familyId, isPrimary: true },
        data: { isPrimary: false },
      });

      // Set new primary domain
      const updated = await db.domain.update({
        where: { id: input.domainId },
        data: { isPrimary: true },
        select: {
          id: true,
          domain: true,
          isPrimary: true,
          verifiedAt: true,
        },
      });

      console.log(
        `[domain:primary-set] id=${input.domainId} familyId=${input.familyId} domain=${domain.domain} ownerId=${ctx.session.user.id} at=${new Date().toISOString()}`,
      );

      return updated;
    }),

  /**
   * Protected mutation: Remove a domain (owner-only).
   */
  removeDomain: protectedProcedure
    .input(removeDomainInputSchema)
    .mutation(async ({ ctx, input }) => {
      await requireOwnerMembership(input.familyId, ctx.session.user.id);

      const domain = await db.domain.findUnique({
        where: { id: input.domainId },
        select: { familyId: true, domain: true, isPrimary: true },
      });

      if (!domain) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Domain not found",
        });
      }

      if (domain.familyId !== input.familyId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This domain does not belong to your family",
        });
      }

      if (domain.isPrimary) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot remove the primary domain. Set another domain as primary first.",
        });
      }

      await db.domain.delete({
        where: { id: input.domainId },
      });

      console.log(
        `[domain:removed] id=${input.domainId} familyId=${input.familyId} domain=${domain.domain} ownerId=${ctx.session.user.id} at=${new Date().toISOString()}`,
      );

      return { success: true as const };
    }),

  /**
   * Protected query: Get verification token for a domain (owner-only).
   * Returns DNS TXT record value and HTTP token instructions.
   */
  getVerificationToken: protectedProcedure
    .input(getVerificationTokenInputSchema)
    .query(async ({ ctx, input }) => {
      await requireOwnerMembership(input.familyId, ctx.session.user.id);

      const domain = await db.domain.findUnique({
        where: { id: input.domainId },
        select: {
          familyId: true,
          domain: true,
          verifiedAt: true,
          verificationToken: true,
        },
      });

      if (!domain) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Domain not found",
        });
      }

      if (domain.familyId !== input.familyId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This domain does not belong to your family",
        });
      }

      if (domain.verifiedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This domain is already verified",
        });
      }

      return {
        domain: domain.domain,
        verificationToken: domain.verificationToken,
        dnsRecord: {
          name: `_fircle-verification.${domain.domain}`,
          type: "TXT",
          value: `fircle-verification=${domain.verificationToken}`,
        },
        httpChallenge: {
          method: "GET",
          url: `https://${domain.domain}/.well-known/fircle-verification`,
          expectedBody: domain.verificationToken,
        },
      };
    }),

  /**
   * Public mutation: Verify a domain with a token.
   * This would be called after DNS/HTTP verification succeeds on the verification server.
   * For now, this is a placeholder for manual verification or external service integration.
   */
  verifyDomain: protectedProcedure
    .input(
      z.object({
        familyId: z.string().cuid(),
        domainId: z.string().cuid(),
        verificationMethod: z.enum(["dns", "http"]),
        token: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireOwnerMembership(input.familyId, ctx.session.user.id);

      const domain = await db.domain.findUnique({
        where: { id: input.domainId },
        select: {
          familyId: true,
          domain: true,
          verificationToken: true,
          verifiedAt: true,
        },
      });

      if (!domain) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Domain not found",
        });
      }

      if (domain.familyId !== input.familyId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This domain does not belong to your family",
        });
      }

      if (domain.verifiedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This domain is already verified",
        });
      }

      const verificationResult = await verifyDomainOwnership({
        domain: domain.domain,
        token: domain.verificationToken,
        method: input.verificationMethod,
      });

      if (verificationResult.status !== "verified") {
        const errorMessageByStatus: Record<string, string> = {
          pending:
            "Verification proof not found yet. Please check your DNS or HTTP challenge setup and try again.",
          "invalid-proof":
            "Verification proof is present but does not match the expected token. Please update your DNS or HTTP challenge.",
          unreachable:
            "Verification target could not be reached. Please check domain connectivity and try again.",
          timeout:
            "Verification timed out while checking proof. Please retry shortly.",
        };

        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            errorMessageByStatus[verificationResult.status] ??
            "Verification failed. Please check your DNS record or HTTP endpoint.",
        });
      }

      // Mark domain as verified
      const verified = await db.domain.update({
        where: { id: input.domainId },
        data: { verifiedAt: new Date() },
        select: {
          id: true,
          domain: true,
          isPrimary: true,
          verifiedAt: true,
        },
      });

      console.log(
        `[domain:verified] id=${input.domainId} familyId=${input.familyId} domain=${domain.domain} method=${input.verificationMethod} ownerId=${ctx.session.user.id} at=${new Date().toISOString()}`,
      );

      return verified;
    }),
});
