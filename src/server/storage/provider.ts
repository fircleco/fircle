import "server-only";

import { db } from "~/server/db";

import { resolveStorageConfig } from "./config-resolver";
import { R2StorageProvider } from "./r2-storage-provider";
import type { StorageConfigResolution, StorageProvider } from "./types";

export function createStorageProvider(resolution: StorageConfigResolution): StorageProvider {
  if (!resolution.isValid || !resolution.config) {
    throw new Error(
      `Object storage is not configured for category ${resolution.category}. Configure owner-managed credentials or provide self-hosted env fallbacks.`,
    );
  }

  switch (resolution.provider) {
    case "r2":
      return new R2StorageProvider(resolution.config);
    default: {
      const exhaustiveCheck: never = resolution.provider;
      throw new Error(`Unsupported storage provider: ${String(exhaustiveCheck)}`);
    }
  }
}

export async function tryGetStorageProvider(familyId: string): Promise<StorageProvider | null> {
  const resolution = await resolveStorageConfig(familyId, db);

  if (!resolution.isValid || !resolution.config) {
    return null;
  }

  return createStorageProvider(resolution);
}

export async function getStorageProvider(familyId: string): Promise<StorageProvider> {
  const storage = await tryGetStorageProvider(familyId);

  if (!storage) {
    throw new Error(
      `Object storage is not configured for family ${familyId}. Configure owner-managed credentials or provide self-hosted env fallbacks.`,
    );
  }

  return storage;
}
