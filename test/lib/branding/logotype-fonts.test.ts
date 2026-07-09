import { describe, expect, it } from "vitest";

import {
  brandingConfigSchema,
  getBrandingConfigFontStylesheetUrl,
  parseBrandingConfig,
} from "~/lib/branding/branding-config";
import {
  LOGOTYPE_FONT_NAMES,
  buildLogotypeFontStylesheetUrl,
  resolveLogotypeFontName,
} from "~/lib/branding/logotype-fonts";

describe("logotype font allowlist", () => {
  it("exposes the configured allowlist", () => {
    expect(LOGOTYPE_FONT_NAMES).toContain("Manufacturing Consent");
    expect(LOGOTYPE_FONT_NAMES).toContain("Great Vibes");
  });

  it("resolves known font names and rejects unknown ones", () => {
    expect(resolveLogotypeFontName(" Manufacturing   Consent ")).toBe("Manufacturing Consent");
    expect(resolveLogotypeFontName("Not A Real Font")).toBeNull();
  });

  it("builds api.fonts.coollabs.io stylesheet URLs", () => {
    expect(buildLogotypeFontStylesheetUrl("Manufacturing Consent")).toBe(
      "https://api.fonts.coollabs.io/css2?family=Manufacturing+Consent&display=swap",
    );
  });

  it("normalizes and safely encodes stylesheet URL font names", () => {
    expect(buildLogotypeFontStylesheetUrl("  Mr   De   Haviland ")).toBe(
      "https://api.fonts.coollabs.io/css2?family=Mr+De+Haviland&display=swap",
    );
  });

  it("accepts disabled logotype configs without fontName", () => {
    const parsed = brandingConfigSchema.parse({
      version: 1,
      logotype: {
        enabled: false,
        fontProvider: "api.fonts.coollabs.io",
      },
    });

    expect(parsed.logotype.enabled).toBe(false);
    expect(getBrandingConfigFontStylesheetUrl(parsed)).toBeNull();
  });
});

describe("brandingConfig schema", () => {
  it("accepts normalized enabled logotype configs", () => {
    const parsed = brandingConfigSchema.parse({
      version: 1,
      logotype: {
        enabled: true,
        fontName: "  Manufacturing   Consent  ",
        fontProvider: "api.fonts.coollabs.io",
      },
    });

    expect(parsed.logotype.fontName).toBe("Manufacturing Consent");
    expect(getBrandingConfigFontStylesheetUrl(parsed)).toBe(
      "https://api.fonts.coollabs.io/css2?family=Manufacturing+Consent&display=swap",
    );
  });

  it("rejects enabled configs without an allowlisted font", () => {
    expect(() =>
      parseBrandingConfig({
        version: 1,
        logotype: {
          enabled: true,
          fontProvider: "api.fonts.coollabs.io",
        },
      }),
    ).toThrow(/fontName is required when logotype is enabled/);
  });

  it("rejects non-allowlisted font names", () => {
    const result = brandingConfigSchema.safeParse({
      version: 1,
      logotype: {
        enabled: true,
        fontName: "Not A Font",
        fontProvider: "api.fonts.coollabs.io",
      },
    });

    expect(result.success).toBe(false);
  });
});