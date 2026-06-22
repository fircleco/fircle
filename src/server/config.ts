import { env } from "~/env";

import { createHash } from "node:crypto";

export function getIntegrationCredentialMasterKey(): Buffer {
  if (!env.AUTH_SECRET) {
    throw new Error("AUTH_SECRET is required to encrypt integration credentials.");
  }

  return createHash("sha256").update(env.AUTH_SECRET).digest();
}
