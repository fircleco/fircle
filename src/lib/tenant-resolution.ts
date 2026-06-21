import "server-only";

import { env } from "~/env";
import { db } from "~/server/db";

import { normalizeRequestHost } from "~/lib/request-host";

export type TenantResolutionState = "resolved" | "not-found" | "ambiguous" | "bootstrap-required";

/** Emits a structured JSON log line for each resolution decision. */
function logResolution(
  state: string,
  host: string | null,
  extra?: Record<string, unknown>,
) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      ctx: "tenant-resolution",
      state,
      host,
      ...extra,
    }),
  );
}

export type TenantResolutionResult =
  | {
      state: "resolved";
      host: string;
      canonicalHost: string;
      domain: {
        id: string;
        familyId: string;
        domain: string;
        isPrimary: boolean;
        verifiedAt: Date | null;
      };
      family: {
        id: string;
        name: string;
        slug: string;
      };
    }
  | {
      state: "not-found";
      host: string | null;
    }
  | {
      state: "ambiguous";
      host: string;
    }
  | {
      state: "bootstrap-required";
      host: string | null;
    };

export async function resolveTenantFromHeaders(headers: Headers): Promise<TenantResolutionResult> {
  const host = normalizeRequestHost(headers);

  const existingFamily = await db.family.findFirst({
    select: { id: true },
  });

  if (!existingFamily && env.SELF_HOSTED) {
    logResolution("bootstrap-required", host);
    return {
      state: "bootstrap-required",
      host,
    };
  }

  if (!host) {
    logResolution("not-found", null, { reason: "no-host" });
    return {
      state: "not-found",
      host,
    };
  }

  const matches = await db.domain.findMany({
    where: {
      domain: host,
    },
    select: {
      id: true,
      familyId: true,
      domain: true,
      isPrimary: true,
      verifiedAt: true,
      family: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (matches.length > 1) {
    logResolution("ambiguous", host, { matchCount: matches.length });
    return {
      state: "ambiguous",
      host,
    };
  }

  const match = matches[0];
  if (!match) {
    logResolution("not-found", host, { reason: "no-domain-record" });
    return {
      state: "not-found",
      host,
    };
  }

  if (env.NODE_ENV === "production" && !match.verifiedAt) {
    logResolution("not-found", host, { reason: "unverified-domain", domainId: match.id });
    return {
      state: "not-found",
      host,
    };
  }

  const primaryDomain = await db.domain.findFirst({
    where: {
      familyId: match.familyId,
      isPrimary: true,
    },
    select: {
      domain: true,
    },
  });

  const canonicalHost = primaryDomain?.domain ?? match.domain;

  logResolution("resolved", host, {
    familyId: match.familyId,
    familySlug: match.family.slug,
    canonicalHost,
    redirect: canonicalHost !== host,
  });

  return {
    state: "resolved",
    host,
    canonicalHost,
    domain: {
      id: match.id,
      familyId: match.familyId,
      domain: match.domain,
      isPrimary: match.isPrimary,
      verifiedAt: match.verifiedAt,
    },
    family: match.family,
  };
}