import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, encryptCredentialsMock, getIntegrationCredentialMasterKeyMock } = vi.hoisted(() => ({
  mockDb: {
    familyMember: {
      findUnique: vi.fn(),
    },
    integrationCredential: {
      upsert: vi.fn(),
    },
  },
  encryptCredentialsMock: vi.fn(() => "encrypted-payload"),
  getIntegrationCredentialMasterKeyMock: vi.fn(() => Buffer.from("x".repeat(32))),
}));

vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: mockDb,
}));

vi.mock("~/lib/encryption", () => ({
  encryptCredentials: encryptCredentialsMock,
}));

vi.mock("~/server/config", () => ({
  getIntegrationCredentialMasterKey: getIntegrationCredentialMasterKeyMock,
}));

import { integrationRouter } from "~/server/api/routers/integration";

function createCaller(userId = "user-1") {
  return integrationRouter.createCaller({
    db: mockDb,
    session: {
      user: { id: userId },
    },
    headers: new Headers(),
  } as never);
}

describe("integrationRouter input validation", () => {
  const familyId = "clh0000000000000000001001";

  const validPayload = {
    accountId: "account-id",
    bucket: "family-media",
    accessKeyId: "access-key",
    secretAccessKey: "secret-key",
    publicBaseUrl: "https://pub-xyz.r2.dev",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.familyMember.findUnique.mockReset();
    mockDb.integrationCredential.upsert.mockReset();
  });

  it("accepts known registry category/provider entries", async () => {
    mockDb.familyMember.findUnique.mockResolvedValue({ role: "OWNER" });
    mockDb.integrationCredential.upsert.mockResolvedValue({
      id: "cred-1",
      familyId,
      category: "storage",
      provider: "r2",
      isEnabled: true,
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
      updatedAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    const caller = createCaller();

    await expect(
      caller.saveIntegrationCredential({
        familyId,
        category: "storage",
        provider: "r2",
        payload: validPayload,
        isEnabled: true,
        testBeforeSave: false,
      }),
    ).resolves.toMatchObject({
      familyId,
      category: "storage",
      provider: "r2",
      isEnabled: true,
    });

    expect(mockDb.familyMember.findUnique).toHaveBeenCalledTimes(1);
    expect(mockDb.integrationCredential.upsert).toHaveBeenCalledTimes(1);
  });

  it("rejects unknown integration category", async () => {
    const caller = createCaller();

    await expect(
      caller.saveIntegrationCredential({
        familyId,
        category: "unknown-category",
        provider: "r2",
        payload: validPayload,
        isEnabled: true,
        testBeforeSave: false,
      }),
    ).rejects.toThrow(/Unknown integration category/);

    expect(mockDb.familyMember.findUnique).not.toHaveBeenCalled();
    expect(mockDb.integrationCredential.upsert).not.toHaveBeenCalled();
  });

  it("rejects providers that are not mapped to the selected category", async () => {
    const caller = createCaller();

    await expect(
      caller.saveIntegrationCredential({
        familyId,
        category: "storage",
        provider: "not-r2",
        payload: validPayload,
        isEnabled: true,
        testBeforeSave: false,
      }),
    ).rejects.toThrow(/is not supported for category 'storage'/);

    expect(mockDb.familyMember.findUnique).not.toHaveBeenCalled();
    expect(mockDb.integrationCredential.upsert).not.toHaveBeenCalled();
  });
});
