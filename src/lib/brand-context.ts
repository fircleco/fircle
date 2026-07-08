import "server-only";

import { formatFamilyDisplayName, normalizeFamilyNameInput } from "~/lib/family-name";
import { resolveTenantFromHeaders, type TenantResolutionResult } from "~/lib/tenant-resolution";

export type BrandContextState = TenantResolutionResult["state"] | "fallback";

export type BrandContext = {
  state: BrandContextState;
  host: string | null;
  canonicalHost: string | null;
  shouldRedirectToCanonical: boolean;
  familyBaseName: string | null;
  familyDisplayName: string;
  primaryLockup: string;
  appDescription: string;
};

const FALLBACK_LOCKUP = "Fircle";
const FALLBACK_APP_DESCRIPTION =
  "A private family space for sharing updates, photos, and memories.";

function resolveFamilyBaseName(value: string): string | null {
  const normalized = normalizeFamilyNameInput(value);
  return normalized.length > 0 ? normalized : null;
}

function buildResolvedBrandContext(input: {
  state: TenantResolutionResult["state"];
  host: string;
  canonicalHost: string;
  rawFamilyName: string;
}): BrandContext {
  const familyBaseName =
    resolveFamilyBaseName(input.rawFamilyName) ??
    formatFamilyDisplayName("Family", { includeArticle: false, includeSuffix: false });
  const familyDisplayName = formatFamilyDisplayName(familyBaseName, {
    includeArticle: false,
    includeSuffix: false,
  });
  const primaryLockup = `${familyDisplayName} on Fircle`;

  return {
    state: input.state,
    host: input.host,
    canonicalHost: input.canonicalHost,
    shouldRedirectToCanonical: input.host !== input.canonicalHost,
    familyBaseName,
    familyDisplayName,
    primaryLockup,
    appDescription: `${familyDisplayName} on Fircle: a private family space for sharing updates, photos, and memories.`,
  };
}

function buildFallbackBrandContext(input: {
  state: BrandContextState;
  host: string | null;
}): BrandContext {
  return {
    state: input.state,
    host: input.host,
    canonicalHost: null,
    shouldRedirectToCanonical: false,
    familyBaseName: null,
    familyDisplayName: "Family",
    primaryLockup: FALLBACK_LOCKUP,
    appDescription: FALLBACK_APP_DESCRIPTION,
  };
}

export async function resolveBrandContextFromHeaders(headers: Headers): Promise<BrandContext> {
  const tenant = await resolveTenantFromHeaders(headers);

  return resolveBrandContextFromTenantResolution(tenant);
}

export function resolveBrandContextFromTenantResolution(
  tenant: TenantResolutionResult,
): BrandContext {
  if (tenant.state === "resolved") {
    return buildResolvedBrandContext({
      state: tenant.state,
      host: tenant.host,
      canonicalHost: tenant.canonicalHost,
      rawFamilyName: tenant.family.name,
    });
  }

  return buildFallbackBrandContext({
    state: tenant.state,
    host: tenant.host,
  });
}
