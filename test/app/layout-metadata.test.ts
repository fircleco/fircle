import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { headersMock, resolveBrandContextFromHeadersMock } = vi.hoisted(() => ({
  headersMock: vi.fn(),
  resolveBrandContextFromHeadersMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

vi.mock("~/lib/brand-context", () => ({
  resolveBrandContextFromHeaders: resolveBrandContextFromHeadersMock,
}));

import { GET as manifestGet } from "~/app/manifest.json/route";

type ManifestPayload = {
  name: string;
  short_name: string;
  description: string;
};

function readWorkspaceFile(relativePath: string): string {
  const fullPath = path.join(process.cwd(), relativePath);
  return readFileSync(fullPath, "utf8");
}

describe("Phase 5 metadata and manifest branding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headersMock.mockResolvedValue(new Headers({ host: "ng.fircle.app" }));
  });

  it("wires metadata fields to brand-context outputs", async () => {
    const layoutSource = readWorkspaceFile("src/app/layout.tsx");

    expect(layoutSource).toContain("default: brandContext.primaryLockup");
    expect(layoutSource).toContain("template: `%s | ${brandContext.primaryLockup}`");
    expect(layoutSource).toContain("applicationName: brandContext.primaryLockup");
    expect(layoutSource).toContain("siteName: brandContext.primaryLockup");
    expect(layoutSource).toContain("title: brandContext.primaryLockup");
    expect(layoutSource).toContain("description: brandContext.appDescription");
  });

  it("returns host-aware manifest values for a mapped family host", async () => {
    resolveBrandContextFromHeadersMock.mockResolvedValue({
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
      appDescription: "The Ng Fircle: a private family space for sharing updates, photos, and memories.",
    });

    const manifestResponse = await manifestGet();
    const manifest = (await manifestResponse.json()) as ManifestPayload;

    expect(manifest.name).toBe("The Ng Fircle");
    expect(manifest.short_name).toBe("Ng");
    expect(manifest.description).toContain("The Ng Fircle");
  });

  it("returns fallback manifest values for an unknown host", async () => {
    resolveBrandContextFromHeadersMock.mockResolvedValue({
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

    const manifestResponse = await manifestGet();
    const manifest = (await manifestResponse.json()) as ManifestPayload;

    expect(manifest.name).toBe("Fircle");
    expect(manifest.short_name).toBe("Family");
    expect(manifest.description).toBe("A private family space for sharing updates, photos, and memories.");
  });
});
