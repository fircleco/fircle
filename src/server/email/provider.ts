import "server-only";

import { env } from "~/env";

import { ZeptoMailEmailProvider } from "./zeptomail-provider";
import type { EmailDriver, TransactionalEmailProvider } from "./types";

let cachedProvider: TransactionalEmailProvider | null | undefined;

export function createEmailProvider(): TransactionalEmailProvider | null {
  const driver = getConfiguredEmailDriver();

  if (!driver) {
    return null;
  }

  switch (driver) {
    case "zeptomail":
      return new ZeptoMailEmailProvider();
    default: {
      const exhaustiveCheck: never = driver;
      throw new Error(
        `Unsupported transactional email driver: ${String(exhaustiveCheck)}`
      );
    }
  }
}

export function getEmailProvider(): TransactionalEmailProvider | null {
  if (cachedProvider === undefined) {
    cachedProvider = createEmailProvider();
  }

  return cachedProvider;
}

export function getConfiguredEmailDriver(): EmailDriver | null {
  const rawDriver = env.EMAIL_DRIVER;

  if (!rawDriver) {
    return null;
  }

  switch (rawDriver.toLowerCase()) {
    case "zeptomail":
      return "zeptomail";
    default:
      throw new Error(
        `Unsupported EMAIL_DRIVER value: ${rawDriver}. Expected one of: zeptomail`
      );
  }
}

export function resetTransactionalEmailProviderForTests(): void {
  cachedProvider = undefined;
}

// Backward-compatible aliases during rollout.
export const createTransactionalEmailProvider = createEmailProvider;
export const getTransactionalEmailProvider = getEmailProvider;
