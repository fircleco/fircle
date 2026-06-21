import { beforeEach, describe, expect, it, vi } from "vitest";

import { verifyDomainViaHttp } from "~/server/domain-verification/http";

describe("verifyDomainViaHttp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifies when the well-known endpoint returns the expected token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(" token-123 "),
      }),
    );

    await expect(
      verifyDomainViaHttp({
        domain: "example.com",
        token: "token-123",
        timeoutMs: 1_000,
      }),
    ).resolves.toMatchObject({
      status: "verified",
      method: "http",
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://example.com/.well-known/fircle-verification",
      expect.objectContaining({
        method: "GET",
        headers: { Accept: "text/plain" },
      }),
    );
  });

  it("returns pending when the well-known endpoint is not published yet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }),
    );

    await expect(
      verifyDomainViaHttp({
        domain: "example.com",
        token: "token-123",
        timeoutMs: 1_000,
      }),
    ).resolves.toMatchObject({
      status: "pending",
      method: "http",
    });
  });

  it("returns invalid-proof when the endpoint body does not match", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue("wrong-token"),
      }),
    );

    await expect(
      verifyDomainViaHttp({
        domain: "example.com",
        token: "token-123",
        timeoutMs: 1_000,
      }),
    ).resolves.toMatchObject({
      status: "invalid-proof",
      method: "http",
    });
  });

  it("returns unreachable for server-side endpoint failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    await expect(
      verifyDomainViaHttp({
        domain: "example.com",
        token: "token-123",
        timeoutMs: 1_000,
      }),
    ).resolves.toMatchObject({
      status: "unreachable",
      method: "http",
    });
  });

  it("returns timeout when the request aborts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" })),
    );

    await expect(
      verifyDomainViaHttp({
        domain: "example.com",
        token: "token-123",
        timeoutMs: 1_000,
      }),
    ).resolves.toMatchObject({
      status: "timeout",
      method: "http",
    });
  });
});