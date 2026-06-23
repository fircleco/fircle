import "server-only";

import { z } from "zod";

import { env } from "~/env";
import { decryptCredentials } from "~/lib/encryption";
import { getIntegrationCredentialMasterKey } from "~/server/config";
import { db as defaultDb } from "~/server/db";
import { warnAboutCloudModeR2Env } from "~/server/storage/cloud-mode-warning";

import type { R2StorageCredential, StorageConfigResolution } from "./types";

const r2StorageCredentialSchema = z.object({
  accountId: z.string().trim().min(1),
  bucket: z.string().trim().min(1),
  accessKeyId: z.string().trim().min(1),
  secretAccessKey: z.string().trim().min(1),
  publicBaseUrl: z.string().trim().url(),
});

function hasAnyR2EnvironmentValues(): boolean {
  return [
    env.R2_ACCOUNT_ID,
    env.R2_BUCKET,
    env.R2_ACCESS_KEY_ID,
    env.R2_SECRET_ACCESS_KEY,
    env.R2_PUBLIC_BASE_URL,
  ].some((value) => Boolean(value?.trim()));
}

function readEnvR2StorageCredential(): R2StorageCredential | null {
  const config = {
    accountId: env.R2_ACCOUNT_ID?.trim(),
    bucket: env.R2_BUCKET?.trim(),
    accessKeyId: env.R2_ACCESS_KEY_ID?.trim(),
    secretAccessKey: env.R2_SECRET_ACCESS_KEY?.trim(),
    publicBaseUrl: env.R2_PUBLIC_BASE_URL?.trim(),
  };

  const hasAnyValue = Object.values(config).some((value) => Boolean(value));
  if (!hasAnyValue) {
    return null;
  }

  const hasAllValues = Object.values(config).every((value) => Boolean(value));
  if (!hasAllValues) {
    throw new Error(
      "Incomplete R2 environment configuration. Set R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_PUBLIC_BASE_URL, or configure owner-managed storage credentials.",
    );
  }

  return r2StorageCredentialSchema.parse(config);
}

function readDatabaseR2StorageCredential(encryptedPayload: string): R2StorageCredential {
  const decryptedPayload = decryptCredentials<unknown>(
    encryptedPayload,
    getIntegrationCredentialMasterKey(),
  );

  return r2StorageCredentialSchema.parse(decryptedPayload);
}

export async function resolveStorageConfig(
  familyId: string,
  database = defaultDb,
): Promise<StorageConfigResolution> {
  const configuredStorage = await database.integrationCredential.findUnique({
    where: {
      familyId_category: {
        familyId,
        category: "storage",
      },
    },
    select: {
      encryptedPayload: true,
      isEnabled: true,
    },
  });

  if (configuredStorage?.isEnabled) {
    return {
      category: "storage",
      provider: "r2",
      source: "database",
      isValid: true,
      config: readDatabaseR2StorageCredential(configuredStorage.encryptedPayload),
    };
  }

  if (env.SELF_HOSTED) {
    const envCredential = readEnvR2StorageCredential();

    if (envCredential) {
      return {
        category: "storage",
        provider: "r2",
        source: "environment",
        isValid: true,
        config: envCredential,
      };
    }
  } else if (hasAnyR2EnvironmentValues()) {
    warnAboutCloudModeR2Env();
  }

  return {
    category: "storage",
    provider: "r2",
    source: "disabled",
    isValid: false,
    config: null,
  };
}
