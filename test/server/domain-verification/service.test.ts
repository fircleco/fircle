import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { envMock, verifyDomainViaDnsMock, verifyDomainViaHttpMock, logVerificationAttemptMock } = vi.hoisted(() => ({
  envMock: {
    NODE_ENV: "production",
    DOMAIN_VERIFICATION_ENABLED: true,
    DOMAIN_VERIFICATION_TIMEOUT_MS: 5_000,
    DOMAIN_VERIFICATION_MAX_ATTEMPTS: 3,
    DOMAIN_VERIFICATION_RETRY_DELAY_MS: 500,
  },
  verifyDomainViaDnsMock: vi.fn(),
  verifyDomainViaHttpMock: vi.fn(),
  logVerificationAttemptMock: vi.fn(),
}));

vi.mock("~/env", () => ({
  env: envMock,
}));

vi.mock("~/server/domain-verification/dns", () => ({
  verifyDomainViaDns: verifyDomainViaDnsMock,
}));

vi.mock("~/server/domain-verification/http", () => ({
  verifyDomainViaHttp: verifyDomainViaHttpMock,
}));

vi.mock("~/server/domain-verification/logging", () => ({
  logVerificationAttempt: logVerificationAttemptMock,
}));

import { verifyDomainOwnership } from "~/server/domain-verification/service";
import { validateDomainVerificationTarget } from "~/server/domain-verification/target";

describe("validateDomainVerificationTarget", () => {
  it("normalizes hostnames by trimming, lowercasing, and removing a trailing dot", () => {
    expect(validateDomainVerificationTarget(" Example.COM. ", "production")).toEqual({
      ok: true,
      normalizedDomain: "example.com",
    });
  });

  it("rejects protocol, path, and port decorated values", () => {
    expect(validateDomainVerificationTarget("https://example.com:3000/path", "production")).toEqual({
      ok: false,
      message: "Domain must not include protocol, path, or port",
    });
  });

  it("rejects private production targets but allows them in development", () => {
    expect(validateDomainVerificationTarget("192.168.1.12", "production")).toEqual({
      ok: false,
      message: "Private IPv4 targets are not allowed in production",
    });
    expect(validateDomainVerificationTarget("192.168.1.12", "development")).toEqual({
      ok: true,
      normalizedDomain: "192.168.1.12",
    });
  });

  it("rejects reserved local/test hostnames in production", () => {
    expect(validateDomainVerificationTarget("staging.example", "production")).toEqual({
      ok: false,
      message: "Reserved local/test domains are not allowed in production",
    });
  });
});

describe("verifyDomainOwnership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    envMock.NODE_ENV = "production";
    envMock.DOMAIN_VERIFICATION_ENABLED = true;
    envMock.DOMAIN_VERIFICATION_TIMEOUT_MS = 5_000;
    envMock.DOMAIN_VERIFICATION_MAX_ATTEMPTS = 3;
    envMock.DOMAIN_VERIFICATION_RETRY_DELAY_MS = 500;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("short-circuits as verified when verification is disabled", async () => {
    envMock.DOMAIN_VERIFICATION_ENABLED = false;

    await expect(
      verifyDomainOwnership({
        domain: "example.com",
        token: "token-123",
        method: "dns",
      }),
    ).resolves.toMatchObject({
      status: "verified",
      method: "dns",
    });

    expect(verifyDomainViaDnsMock).not.toHaveBeenCalled();
  });

  it("rejects invalid verification targets before any outbound check", async () => {
    await expect(
      verifyDomainOwnership({
        domain: "localhost",
        token: "token-123",
        method: "dns",
      }),
    ).resolves.toMatchObject({
      status: "invalid-proof",
      method: "dns",
      message: "Localhost cannot be used for domain verification",
    });

    expect(verifyDomainViaDnsMock).not.toHaveBeenCalled();
  });

  it("retries retryable DNS results until a later attempt succeeds", async () => {
    verifyDomainViaDnsMock
      .mockResolvedValueOnce({
        status: "pending",
        method: "dns",
        durationMs: 10,
        message: "DNS TXT record not found yet",
      })
      .mockResolvedValueOnce({
        status: "verified",
        method: "dns",
        durationMs: 12,
        message: "DNS TXT verification record matched",
      });

    const promise = verifyDomainOwnership({
      domain: "Example.com",
      token: "token-123",
      method: "dns",
      maxAttempts: 2,
      retryDelayMs: 100,
    });

    await vi.runAllTimersAsync();

    await expect(promise).resolves.toMatchObject({
      status: "verified",
      method: "dns",
    });

    expect(verifyDomainViaDnsMock).toHaveBeenCalledTimes(2);
    expect(verifyDomainViaDnsMock).toHaveBeenNthCalledWith(1, {
      domain: "example.com",
      token: "token-123",
      timeoutMs: 5_000,
    });
    expect(logVerificationAttemptMock).toHaveBeenCalledTimes(2);
  });

  it("stops retrying immediately on terminal HTTP failures", async () => {
    verifyDomainViaHttpMock.mockResolvedValue({
      status: "invalid-proof",
      method: "http",
      durationMs: 20,
      message: "HTTP verification token does not match",
    });

    await expect(
      verifyDomainOwnership({
        domain: "example.com",
        token: "token-123",
        method: "http",
      }),
    ).resolves.toMatchObject({
      status: "invalid-proof",
      method: "http",
    });

    expect(verifyDomainViaHttpMock).toHaveBeenCalledTimes(1);
  });

  it("returns the final retryable result after exhausting attempts", async () => {
    verifyDomainViaDnsMock.mockResolvedValue({
      status: "timeout",
      method: "dns",
      durationMs: 15,
      message: "DNS lookup timed out",
    });

    const promise = verifyDomainOwnership({
      domain: "example.com",
      token: "token-123",
      method: "dns",
      maxAttempts: 2,
      retryDelayMs: 100,
    });

    await vi.runAllTimersAsync();

    await expect(promise).resolves.toMatchObject({
      status: "timeout",
      method: "dns",
    });

    expect(verifyDomainViaDnsMock).toHaveBeenCalledTimes(2);
  });
});