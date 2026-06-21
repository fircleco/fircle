import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveTxtMock } = vi.hoisted(() => ({
  resolveTxtMock: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({
  resolveTxt: resolveTxtMock,
}));

import { verifyDomainViaDns } from "~/server/domain-verification/dns";

describe("verifyDomainViaDns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifies when the expected TXT value is present across flattened records", async () => {
    resolveTxtMock.mockResolvedValue([[" other=value "], [" fircle-verification=token-123 "]]);

    await expect(
      verifyDomainViaDns({
        domain: "example.com",
        token: "token-123",
        timeoutMs: 1_000,
      }),
    ).resolves.toMatchObject({
      status: "verified",
      method: "dns",
    });

    expect(resolveTxtMock).toHaveBeenCalledWith("_fircle-verification.example.com");
  });

  it("returns invalid-proof when a fircle record exists with the wrong token", async () => {
    resolveTxtMock.mockResolvedValue([["fircle-verification=wrong-token"]]);

    await expect(
      verifyDomainViaDns({
        domain: "example.com",
        token: "token-123",
        timeoutMs: 1_000,
      }),
    ).resolves.toMatchObject({
      status: "invalid-proof",
      method: "dns",
    });
  });

  it("returns pending when no fircle verification record is present", async () => {
    resolveTxtMock.mockResolvedValue([["v=spf1 include:_spf.example.com ~all"]]);

    await expect(
      verifyDomainViaDns({
        domain: "example.com",
        token: "token-123",
        timeoutMs: 1_000,
      }),
    ).resolves.toMatchObject({
      status: "pending",
      method: "dns",
    });
  });

  it("returns pending when DNS has no TXT data yet", async () => {
    resolveTxtMock.mockRejectedValue(Object.assign(new Error("no data"), { code: "ENODATA" }));

    await expect(
      verifyDomainViaDns({
        domain: "example.com",
        token: "token-123",
        timeoutMs: 1_000,
      }),
    ).resolves.toMatchObject({
      status: "pending",
      method: "dns",
    });
  });

  it("returns timeout when the DNS lookup times out", async () => {
    resolveTxtMock.mockRejectedValue(Object.assign(new Error("timed out"), { code: "ETIMEOUT" }));

    await expect(
      verifyDomainViaDns({
        domain: "example.com",
        token: "token-123",
        timeoutMs: 1_000,
      }),
    ).resolves.toMatchObject({
      status: "timeout",
      method: "dns",
    });
  });
});