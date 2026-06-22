import { describe, expect, it } from "vitest";

import { decryptCredentials, encryptCredentials } from "~/lib/encryption";

describe("credential encryption", () => {
  it("round-trips encrypted payloads", () => {
    const payload = {
      accountId: "acc_123",
      bucket: "family-media",
      accessKeyId: "key-123",
      secretAccessKey: "secret-123",
      publicBaseUrl: "https://example.r2.dev",
    };

    const encryptedPayload = encryptCredentials(payload, "test-secret-key");

    expect(encryptedPayload).not.toContain("acc_123");
    expect(decryptCredentials<typeof payload>(encryptedPayload, "test-secret-key")).toEqual(payload);
  });

  it("rejects payloads decrypted with the wrong key", () => {
    const encryptedPayload = encryptCredentials({ hello: "world" }, "test-secret-key");

    expect(() => decryptCredentials(encryptedPayload, "different-secret-key")).toThrow();
  });
});