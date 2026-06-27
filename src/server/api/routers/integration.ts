import { TRPCError } from "@trpc/server";
import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { z } from "zod";

import { encryptCredentials } from "~/lib/encryption";
import { getIntegrationCredentialMasterKey } from "~/server/config";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  INTEGRATION_PROVIDERS,
  validateProviderPayload,
  type IntegrationCategory,
  type IntegrationProvider,
} from "~/lib/integration-providers";

const integrationCategorySchema = z.string().trim().min(1, "Category is required.");
const integrationProviderSchema = z.string().trim().min(1, "Provider is required.");

// Generic payload schema - specific validation happens via provider registry
const integrationCredentialPayloadSchema = z.record(z.string(), z.string());

const familyScopedCategoryInputSchema = z
  .object({
    familyId: z.string().cuid(),
    category: integrationCategorySchema,
  })
  .superRefine((value, ctx) => {
    if (!(value.category in INTEGRATION_PROVIDERS)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category"],
        message: `Unknown integration category: ${value.category}`,
      });
    }
  });

function addCategoryProviderValidationIssue(
  value: { category: string; provider: string },
  ctx: z.RefinementCtx,
) {
  const categoryProviders =
    INTEGRATION_PROVIDERS[value.category as IntegrationCategory];

  if (!categoryProviders) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["category"],
      message: `Unknown integration category: ${value.category}`,
    });
    return;
  }

  if (!(value.provider in categoryProviders)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["provider"],
      message: `Provider '${value.provider}' is not supported for category '${value.category}'`,
    });
  }
}

const saveIntegrationCredentialInputBaseSchema = z
  .object({
    familyId: z.string().cuid(),
    category: integrationCategorySchema,
    provider: integrationProviderSchema,
    payload: integrationCredentialPayloadSchema,
    isEnabled: z.boolean().default(true),
    testBeforeSave: z.boolean().default(true),
  });

const saveIntegrationCredentialInputSchema = saveIntegrationCredentialInputBaseSchema.superRefine(
  addCategoryProviderValidationIssue,
);

const testIntegrationCredentialInputSchema = saveIntegrationCredentialInputBaseSchema
  .omit({
    testBeforeSave: true,
  })
  .superRefine(addCategoryProviderValidationIssue);

const disableIntegrationCredentialInputSchema = familyScopedCategoryInputSchema;
const familyScopedInputSchema = z.object({
  familyId: z.string().cuid(),
});

function validateIntegrationPayload(
  category: string,
  provider: string,
  payload: Record<string, string>,
) {
  return validateProviderPayload(
    category as IntegrationCategory,
    provider as IntegrationProvider,
    payload,
  );
}

type OwnerMembershipDb = {
  familyMember: {
    findUnique(args: {
      where: {
        familyId_userId: {
          familyId: string;
          userId: string;
        };
      };
      select: {
        role: true;
      };
    }): Promise<
      | {
          role: string;
        }
      | null
    >;
  };
};

async function requireOwnerMembership(
  familyId: string,
  userId: string,
  db: OwnerMembershipDb
): Promise<void> {
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

function createR2Client(payload: Record<string, string>) {
  const accountId = payload.accountId!;
  const accessKeyId = payload.accessKeyId!;
  const secretAccessKey = payload.secretAccessKey!;

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
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

  if (statusCode && statusCode >= 500) {
    return "Storage provider is temporarily unavailable.";
  }

  return error.message || "Could not reach the storage provider.";
}

async function testR2StorageCredentials(payload: Record<string, string>) {
  const bucket = payload.bucket!;
  const client = createR2Client(payload);

  try {
    await client.send(
      new HeadBucketCommand({
        Bucket: bucket,
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
  listIntegrationCredentials: protectedProcedure
    .input(familyScopedInputSchema)
    .query(async ({ ctx, input }) => {
      await requireOwnerMembership(input.familyId, ctx.session.user.id, ctx.db);

      const credentials = await ctx.db.integrationCredential.findMany({
        where: {
          familyId: input.familyId,
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
        orderBy: {
          updatedAt: "desc",
        },
      });

      return credentials;
    }),

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
      // Validate payload against provider schema first
      const validation = validateIntegrationPayload(
        input.category,
        input.provider,
        input.payload,
      );
      if (!validation.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validation.message ?? "Invalid credentials.",
        });
      }
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
      // Validate payload against provider schema
      const validation = validateIntegrationPayload(
        input.category,
        input.provider,
        input.payload,
      );
      if (!validation.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validation.message ?? "Invalid credentials.",
        });
      }
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
