import { beforeEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({
  SELF_HOSTED: true,
  R2_ACCOUNT_ID: undefined as string | undefined,
  R2_BUCKET: undefined as string | undefined,
  R2_ACCESS_KEY_ID: undefined as string | undefined,
  R2_SECRET_ACCESS_KEY: undefined as string | undefined,
  R2_PUBLIC_BASE_URL: undefined as string | undefined,
}));

const decryptCredentialsMock = vi.hoisted(() => vi.fn());
const getIntegrationCredentialMasterKeyMock = vi.hoisted(() => vi.fn(() => "test-master-key"));

vi.mock("server-only", () => ({}));

vi.mock("~/env", () => ({
  env: envMock,
}));

vi.mock("~/lib/encryption", () => ({
  decryptCredentials: decryptCredentialsMock,
}));

vi.mock("~/server/config", () => ({
  getIntegrationCredentialMasterKey: getIntegrationCredentialMasterKeyMock,
}));

import { resolveStorageConfig } from "~/server/storage/config-resolver";

describe("resolveStorageConfig", () => {
  beforeEach(() => {
    envMock.SELF_HOSTED = true;
    envMock.R2_ACCOUNT_ID = undefined;
    envMock.R2_BUCKET = undefined;
    envMock.R2_ACCESS_KEY_ID = undefined;
    envMock.R2_SECRET_ACCESS_KEY = undefined;
    envMock.R2_PUBLIC_BASE_URL = undefined;
    decryptCredentialsMock.mockReset();
    getIntegrationCredentialMasterKeyMock.mockClear();
    vi.restoreAllMocks();
  });

  it("returns the encrypted database credential for a family when enabled", async () => {
    decryptCredentialsMock.mockReturnValue({
      accountId: "account-1",
      bucket: "family-media",
      accessKeyId: "key-1",
      secretAccessKey: "secret-1",
      publicBaseUrl: "https://example.r2.dev",
    });

    const findUnique = vi.fn().mockResolvedValue({
      encryptedPayload: "encrypted-payload",
      isEnabled: true,
    });
    const fakeDb = {
      integrationCredential: {
        findUnique,
      },
    };

    await expect(resolveStorageConfig("family-1", fakeDb as never)).resolves.toEqual({
      category: "storage",
      provider: "r2",
      source: "database",
      isValid: true,
      config: {
        accountId: "account-1",
        bucket: "family-media",
        accessKeyId: "key-1",
        secretAccessKey: "secret-1",
        publicBaseUrl: "https://example.r2.dev",
      },
    });

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        familyId_category: {
          familyId: "family-1",
          category: "storage",
        },
      },
      select: {
        encryptedPayload: true,
        isEnabled: true,
      },
    });
    expect(getIntegrationCredentialMasterKeyMock).toHaveBeenCalledTimes(1);
    expect(decryptCredentialsMock).toHaveBeenCalledWith("encrypted-payload", "test-master-key");
  });

  it("falls back to self-hosted env credentials when no database credential exists", async () => {
    envMock.SELF_HOSTED = true;
    envMock.R2_ACCOUNT_ID = "account-2";
    envMock.R2_BUCKET = "family-media";
    envMock.R2_ACCESS_KEY_ID = "key-2";
    envMock.R2_SECRET_ACCESS_KEY = "secret-2";
    envMock.R2_PUBLIC_BASE_URL = "https://example.r2.dev";

    const findUnique = vi.fn().mockResolvedValue(null);
    const fakeDb = {
      integrationCredential: {
        findUnique,
      },
    };

    await expect(resolveStorageConfig("family-1", fakeDb as never)).resolves.toEqual({
      category: "storage",
      provider: "r2",
      source: "environment",
      isValid: true,
      config: {
        accountId: "account-2",
        bucket: "family-media",
        accessKeyId: "key-2",
        secretAccessKey: "secret-2",
        publicBaseUrl: "https://example.r2.dev",
      },
    });
  });

  it("returns disabled in cloud mode and warns once when env credentials are present", async () => {
    envMock.SELF_HOSTED = false;
    envMock.R2_ACCOUNT_ID = "account-3";
    envMock.R2_BUCKET = "family-media";
    envMock.R2_ACCESS_KEY_ID = "key-3";
    envMock.R2_SECRET_ACCESS_KEY = "secret-3";
    envMock.R2_PUBLIC_BASE_URL = "https://example.r2.dev";

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const findUnique = vi.fn().mockResolvedValue(null);
    const fakeDb = {
      integrationCredential: {
        findUnique,
      },
    };

    await expect(resolveStorageConfig("family-1", fakeDb as never)).resolves.toEqual({
      category: "storage",
      provider: "r2",
      source: "disabled",
      isValid: false,
      config: null,
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
