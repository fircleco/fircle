import { TRPCError } from "@trpc/server";
import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { z } from "zod";

import { encryptCredentials } from "~/lib/encryption";
import { getIntegrationCredentialMasterKey } from "~/server/config";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const supportedIntegrationCategorySchema = z.literal("storage");
const supportedIntegrationProviderSchema = z.literal("r2");

const r2StorageCredentialPayloadSchema = z.object({
  accountId: z.string().trim().min(1).max(100),
  bucket: z.string().trim().min(1).max(255),
  accessKeyId: z.string().trim().min(1).max(255),
  secretAccessKey: z.string().trim().min(1).max(500),
  publicBaseUrl: z.string().trim().url(),
});

const familyScopedCategoryInputSchema = z.object({
  familyId: z.string().cuid(),
  category: supportedIntegrationCategorySchema,
});

const saveIntegrationCredentialInputSchema = familyScopedCategoryInputSchema.extend({
  provider: supportedIntegrationProviderSchema,
  payload: r2StorageCredentialPayloadSchema,
  isEnabled: z.boolean().default(true),
  testBeforeSave: z.boolean().default(true),
});

const testIntegrationCredentialInputSchema = saveIntegrationCredentialInputSchema.omit({
  testBeforeSave: true,
});

const disableIntegrationCredentialInputSchema = familyScopedCategoryInputSchema;

async function requireOwnerMembership(familyId: string, userId: string, db: { familyMember: { findUnique: (args: unknown) => Promise<{ role: string } | null> } }) {
  const membership = await db.familyMember.findUnique({
    where: {
      familyId_userId: {
        familyId,
        userId,
      },
    },
    select: {
      role: true,
    },
  });

  if (membership?.role !== "OWNER") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the family owner can manage integration credentials",
    });
  }
}

function createR2Client(payload: z.infer<typeof r2StorageCredentialPayloadSchema>) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${payload.accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: payload.accessKeyId,
      secretAccessKey: payload.secretAccessKey,
    },
  });
}

function describeR2CredentialTestError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Could not reach the storage provider.";
  }

  const statusCode =
    typeof (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === "number"
      ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
      : null;

  if (statusCode === 401 || statusCode === 403) {
    return "Storage provider rejected the authentication credentials.";
  }

  if (statusCode === 429) {
    return "Storage provider is rate-limiting requests; credentials appear valid.";
  }

  if (statusCode !== null && statusCode >= 500) {
    return "Storage provider is temporarily unavailable.";
  }

  return error.message || "Could not reach the storage provider.";
}

async function testR2StorageCredentials(payload: z.infer<typeof r2StorageCredentialPayloadSchema>) {
  const client = createR2Client(payload);

  try {
    await client.send(
      new HeadBucketCommand({
        Bucket: payload.bucket,
      }),
    );

    return {
      ok: true as const,
      message: "Storage credentials were validated.",
    };
  } catch (error) {
    return {
      ok: false as const,
      message: describeR2CredentialTestError(error),
    };
  }
}

export const integrationRouter = createTRPCRouter({
  getIntegrationCredential: protectedProcedure
    .input(familyScopedCategoryInputSchema)
    .query(async ({ ctx, input }) => {
      await requireOwnerMembership(input.familyId, ctx.session.user.id, ctx.db);

      const credential = await ctx.db.integrationCredential.findUnique({
        where: {
          familyId_category: {
            familyId: input.familyId,
            category: input.category,
          },
        },
        select: {
          id: true,
          familyId: true,
          category: true,
          provider: true,
          isEnabled: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return credential;
    }),

  testIntegrationCredential: protectedProcedure
    .input(testIntegrationCredentialInputSchema)
    .mutation(async ({ ctx, input }) => {
      await requireOwnerMembership(input.familyId, ctx.session.user.id, ctx.db);

      const result = await testR2StorageCredentials(input.payload);
      if (!result.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.message,
        });
      }

      return result;
    }),

  saveIntegrationCredential: protectedProcedure
    .input(saveIntegrationCredentialInputSchema)
    .mutation(async ({ ctx, input }) => {
      await requireOwnerMembership(input.familyId, ctx.session.user.id, ctx.db);

      if (input.isEnabled && input.testBeforeSave) {
        const testResult = await testR2StorageCredentials(input.payload);
        if (!testResult.ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: testResult.message,
          });
        }
      }

      const encryptedPayload = encryptCredentials(
        input.payload,
        getIntegrationCredentialMasterKey(),
      );

      const credential = await ctx.db.integrationCredential.upsert({
        where: {
          familyId_category: {
            familyId: input.familyId,
            category: input.category,
          },
        },
        create: {
          familyId: input.familyId,
          category: input.category,
          provider: input.provider,
          encryptedPayload,
          isEnabled: input.isEnabled,
        },
        update: {
          provider: input.provider,
          encryptedPayload,
          isEnabled: input.isEnabled,
        },
        select: {
          id: true,
          familyId: true,
          category: true,
          provider: true,
          isEnabled: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return credential;
    }),

  disableIntegrationCredential: protectedProcedure
    .input(disableIntegrationCredentialInputSchema)
    .mutation(async ({ ctx, input }) => {
      await requireOwnerMembership(input.familyId, ctx.session.user.id, ctx.db);

      const credential = await ctx.db.integrationCredential.update({
        where: {
          familyId_category: {
            familyId: input.familyId,
            category: input.category,
          },
        },
        data: {
          isEnabled: false,
        },
        select: {
          id: true,
          familyId: true,
          category: true,
          provider: true,
          isEnabled: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return credential;
    }),
});
