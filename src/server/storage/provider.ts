import "server-only";

import { env } from "~/env";

import { R2StorageProvider } from "./r2-storage-provider";
import type { StorageProvider } from "./types";

let cachedProvider: StorageProvider | null = null;

export function createStorageProvider(): StorageProvider {
  switch (env.STORAGE_DRIVER) {
    case "r2":
      return new R2StorageProvider();
    default: {
      const exhaustiveCheck: never = env.STORAGE_DRIVER;
      throw new Error(`Unsupported storage driver: ${String(exhaustiveCheck)}`);
    }
  }
}

export function getStorageProvider(): StorageProvider {
  if (!cachedProvider) {
    cachedProvider = createStorageProvider();
  }
  return cachedProvider;
}
