import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { resolveTenantFromHeadersMock } = vi.hoisted(() => ({
  resolveTenantFromHeadersMock: vi.fn(),
}));

vi.mock("~/lib/tenant-resolution", () => ({
  resolveTenantFromHeaders: resolveTenantFromHeadersMock,
}));

import { resolveBrandContextFromHeaders } from "~/lib/brand-context";

describe("resolveBrandContextFromHeaders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds brand context for a mapped host", async () => {
    resolveTenantFromHeadersMock.mockResolvedValue({
      state: "resolved",
      host: "ng.fircle.app",
      canonicalHost: "ng.fircle.app",
      domain: {
        id: "domain-1",
        familyId: "family-1",
        domain: "ng.fircle.app",
        isPrimary: true,
        verifiedAt: new Date("2030-01-01T00:00:00.000Z"),
      },
      family: {
        id: "family-1",
        name: "The Ng Family",
        slug: "ng",
      },
    });

    const context = await resolveBrandContextFromHeaders(new Headers({ host: "ng.fircle.app" }));

    expect(context).toMatchObject({
      state: "resolved",
      host: "ng.fircle.app",
      canonicalHost: "ng.fircle.app",
      shouldRedirectToCanonical: false,
      familyBaseName: "Ng",
      familyDisplayName: "Ng",
      primaryLockup: "The Ng Fircle",
      primaryLockupParts: {
        leading: "The",
        familyName: "Ng",
        trailing: "Fircle",
      },
    });
    expect(context.appDescription).toContain("The Ng Fircle");
  });

  it("keeps fallback lockup continuity when family name normalizes to empty", async () => {
    resolveTenantFromHeadersMock.mockResolvedValue({
      state: "resolved",
      host: "family.fircle.app",
      canonicalHost: "family.fircle.app",
      domain: {
        id: "domain-3",
        familyId: "family-3",
        domain: "family.fircle.app",
        isPrimary: true,
        verifiedAt: new Date("2030-01-01T00:00:00.000Z"),
      },
      family: {
        id: "family-3",
        name: "The Family",
        slug: "family",
      },
    });

    const context = await resolveBrandContextFromHeaders(new Headers({ host: "family.fircle.app" }));

    expect(context.familyBaseName).toBe("Family");
    expect(context.familyDisplayName).toBe("Family");
    expect(context.primaryLockup).toBe("The Family Fircle");
    expect(context.primaryLockupParts).toEqual({
      leading: "The",
      familyName: "Family",
      trailing: "Fircle",
    });
  });

  it("returns fallback context when tenant is not found", async () => {
    resolveTenantFromHeadersMock.mockResolvedValue({
      state: "not-found",
      host: "unknown.example.com",
    });

    const context = await resolveBrandContextFromHeaders(
      new Headers({ host: "unknown.example.com" }),
    );

    expect(context).toEqual({
      state: "not-found",
      host: "unknown.example.com",
      canonicalHost: null,
      shouldRedirectToCanonical: false,
      familyBaseName: null,
      familyDisplayName: "Family",
      primaryLockup: "Fircle",
      primaryLockupParts: null,
      appDescription: "A private family space for sharing updates, photos, and memories.",
    });
  });

  it("indicates canonical-host redirect when host differs", async () => {
    resolveTenantFromHeadersMock.mockResolvedValue({
      state: "resolved",
      host: "family.example.com",
      canonicalHost: "ng.fircle.app",
      domain: {
        id: "domain-2",
        familyId: "family-2",
        domain: "family.example.com",
        isPrimary: false,
        verifiedAt: new Date("2030-01-01T00:00:00.000Z"),
      },
      family: {
        id: "family-2",
        name: "Ng",
        slug: "ng",
      },
    });

    const context = await resolveBrandContextFromHeaders(
      new Headers({ host: "family.example.com" }),
    );

    expect(context.shouldRedirectToCanonical).toBe(true);
    expect(context.host).toBe("family.example.com");
    expect(context.canonicalHost).toBe("ng.fircle.app");
    expect(context.primaryLockup).toBe("The Ng Fircle");
    expect(context.primaryLockupParts).toEqual({
      leading: "The",
      familyName: "Ng",
      trailing: "Fircle",
    });
  });
});
