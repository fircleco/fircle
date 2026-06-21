import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mockEnv, mockDb } = vi.hoisted(() => ({
  mockEnv: {
    SELF_HOSTED: true,
    NODE_ENV: "development",
  },
  mockDb: {
    family: {
      findFirst: vi.fn(),
    },
    domain: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("~/env", () => ({
  env: mockEnv,
}));

vi.mock("~/server/db", () => ({
  db: mockDb,
}));

import { resolveTenantFromHeaders } from "~/lib/tenant-resolution";

describe("resolveTenantFromHeaders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.family.findFirst.mockResolvedValue({ id: "family-seeded" });
    mockDb.domain.findFirst.mockResolvedValue(null);
    mockEnv.NODE_ENV = "development";
  });

  it("resolves explicit mapped platform-style subdomain", async () => {
    const host = "ng.fircle.app";

    mockDb.domain.findMany.mockResolvedValue([
      {
        id: "domain-1",
        familyId: "family-1",
        domain: host,
        isPrimary: true,
        verifiedAt: new Date("2030-01-01T00:00:00.000Z"),
        family: { id: "family-1", name: "Ng Family", slug: "ng" },
      },
    ]);
    mockDb.domain.findFirst.mockResolvedValue({ domain: host });

    const headers = new Headers({ host });
    const result = await resolveTenantFromHeaders(headers);

    expect(result).toMatchObject({
      state: "resolved",
      host,
      canonicalHost: host,
      family: { id: "family-1", slug: "ng" },
      domain: { domain: host, familyId: "family-1" },
    });
  });

  it("resolves explicit mapped custom-domain", async () => {
    const host = "family.example.com";

    mockDb.domain.findMany.mockResolvedValue([
      {
        id: "domain-2",
        familyId: "family-2",
        domain: host,
        isPrimary: false,
        verifiedAt: new Date("2030-01-01T00:00:00.000Z"),
        family: { id: "family-2", name: "Patel Family", slug: "patel" },
      },
    ]);
    mockDb.domain.findFirst.mockResolvedValue({ domain: "patel.fircle.app" });

    const headers = new Headers({ host });
    const result = await resolveTenantFromHeaders(headers);

    expect(result).toMatchObject({
      state: "resolved",
      host,
      canonicalHost: "patel.fircle.app",
      family: { id: "family-2", slug: "patel" },
      domain: { domain: host, familyId: "family-2" },
    });
  });

  it("resolves explicit mapped self-host root-domain", async () => {
    const host = "localhost";

    mockDb.domain.findMany.mockResolvedValue([
      {
        id: "domain-3",
        familyId: "family-3",
        domain: host,
        isPrimary: true,
        verifiedAt: null,
        family: { id: "family-3", name: "Local Family", slug: "local-family" },
      },
    ]);
    mockDb.domain.findFirst.mockResolvedValue({ domain: host });

    const headers = new Headers({ host });
    const result = await resolveTenantFromHeaders(headers);

    expect(result).toMatchObject({
      state: "resolved",
      host,
      canonicalHost: host,
      family: { id: "family-3", slug: "local-family" },
      domain: { domain: host, familyId: "family-3" },
    });
  });

  it("returns not-found when host is unmapped", async () => {
    const host = "unknown.example.com";

    mockDb.domain.findMany.mockResolvedValue([]);

    const headers = new Headers({ host });
    const result = await resolveTenantFromHeaders(headers);

    expect(result).toEqual({
      state: "not-found",
      host,
    });
  });

  it("blocks unverified mapped domains in production", async () => {
    const host = "family.example.com";

    mockEnv.NODE_ENV = "production";
    mockDb.domain.findMany.mockResolvedValue([
      {
        id: "domain-4",
        familyId: "family-4",
        domain: host,
        isPrimary: true,
        verifiedAt: null,
        family: { id: "family-4", name: "Kim Family", slug: "kim" },
      },
    ]);

    const headers = new Headers({ host });
    const result = await resolveTenantFromHeaders(headers);

    expect(result).toEqual({
      state: "not-found",
      host,
    });
    expect(mockDb.domain.findFirst).not.toHaveBeenCalled();
  });
});
