import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifyDomainOwnershipMock, mockDb } = vi.hoisted(() => ({
  verifyDomainOwnershipMock: vi.fn(),
  mockDb: {
    familyMember: {
      findUnique: vi.fn(),
    },
    domain: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: mockDb,
}));

vi.mock("~/server/domain-verification", () => ({
  verifyDomainOwnership: verifyDomainOwnershipMock,
}));

import { domainRouter } from "~/server/api/routers/domain";

function createCaller(userId = "user-1") {
  return domainRouter.createCaller({
    session: {
      user: { id: userId },
    },
    headers: new Headers(),
  } as never);
}

describe("domainRouter", () => {
  const familyId = "clh0000000000000000001001";
  const domainId = "clh0000000000000000002001";
  const token = "verify-token-123";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    mockDb.familyMember.findUnique.mockReset();
    mockDb.domain.findUnique.mockReset();
    mockDb.domain.update.mockReset();
  });

  it("returns DNS and HTTP challenge instructions for an unverified owner domain", async () => {
    mockDb.familyMember.findUnique.mockResolvedValue({ role: "OWNER" });
    mockDb.domain.findUnique.mockResolvedValue({
      familyId,
      domain: "fircle.app",
      verifiedAt: null,
      verificationToken: token,
    });

    const caller = createCaller();

    await expect(caller.getVerificationToken({ familyId, domainId })).resolves.toEqual({
      domain: "fircle.app",
      verificationToken: token,
      dnsRecord: {
        name: "_fircle-verification.fircle.app",
        type: "TXT",
        value: `fircle-verification=${token}`,
      },
      httpChallenge: {
        method: "GET",
        url: "https://fircle.app/.well-known/fircle-verification",
        expectedBody: token,
      },
    });
  });

  it("rejects verification when the caller is not the family owner", async () => {
    mockDb.familyMember.findUnique.mockResolvedValue({ role: "MEMBER" });

    const caller = createCaller();

    await expect(
      caller.verifyDomain({
        familyId,
        domainId,
        verificationMethod: "dns",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only the family owner can perform this action",
    });

    expect(mockDb.domain.findUnique).not.toHaveBeenCalled();
    expect(verifyDomainOwnershipMock).not.toHaveBeenCalled();
  });

  it("marks the domain verified after a successful DNS proof check", async () => {
    verifyDomainOwnershipMock.mockResolvedValue({
      status: "verified",
      method: "dns",
      durationMs: 25,
      message: "DNS TXT verification record matched",
    });

    mockDb.familyMember.findUnique.mockResolvedValue({ role: "OWNER" });
    mockDb.domain.findUnique.mockResolvedValue({
      familyId,
      domain: "fircle.app",
      verificationToken: token,
      verifiedAt: null,
    });
    mockDb.domain.update.mockResolvedValue({
      id: domainId,
      domain: "fircle.app",
      isPrimary: false,
      verifiedAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    const caller = createCaller();
    await expect(
      caller.verifyDomain({
        familyId,
        domainId,
        verificationMethod: "dns",
      }),
    ).resolves.toMatchObject({
      id: domainId,
      domain: "fircle.app",
      isPrimary: false,
    });

    expect(verifyDomainOwnershipMock).toHaveBeenCalledWith({
      domain: "fircle.app",
      token,
      method: "dns",
    });
    expect(mockDb.domain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: domainId },
      }),
    );
  });

  it("marks the domain verified after a successful HTTP proof check", async () => {
    verifyDomainOwnershipMock.mockResolvedValue({
      status: "verified",
      method: "http",
      durationMs: 18,
      message: "HTTP verification token matched",
    });

    mockDb.familyMember.findUnique.mockResolvedValue({ role: "OWNER" });
    mockDb.domain.findUnique.mockResolvedValue({
      familyId,
      domain: "fircle.app",
      verificationToken: token,
      verifiedAt: null,
    });
    mockDb.domain.update.mockResolvedValue({
      id: domainId,
      domain: "fircle.app",
      isPrimary: true,
      verifiedAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    const caller = createCaller();

    await expect(
      caller.verifyDomain({
        familyId,
        domainId,
        verificationMethod: "http",
      }),
    ).resolves.toMatchObject({
      id: domainId,
      domain: "fircle.app",
      isPrimary: true,
    });

    expect(verifyDomainOwnershipMock).toHaveBeenCalledWith({
      domain: "fircle.app",
      token,
      method: "http",
    });
  });

  it.each([
    ["pending", "Verification proof not found yet. Please check your DNS or HTTP challenge setup and try again."],
    ["invalid-proof", "Verification proof is present but does not match the expected token. Please update your DNS or HTTP challenge."],
    ["unreachable", "Verification target could not be reached. Please check domain connectivity and try again."],
    ["timeout", "Verification timed out while checking proof. Please retry shortly."],
  ] as const)("maps %s verification failures into actionable router errors", async (status, message) => {
    verifyDomainOwnershipMock.mockResolvedValue({
      status,
      method: "dns",
      durationMs: 50,
      message: `${status} message`,
    });

    mockDb.familyMember.findUnique.mockResolvedValue({ role: "OWNER" });
    mockDb.domain.findUnique.mockResolvedValue({
      familyId,
      domain: "fircle.app",
      verificationToken: token,
      verifiedAt: null,
    });

    const caller = createCaller();

    await expect(
      caller.verifyDomain({
        familyId,
        domainId,
        verificationMethod: "dns",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message,
    });

    expect(mockDb.domain.update).not.toHaveBeenCalled();
  });
});