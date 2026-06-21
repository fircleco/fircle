import "server-only";

import { env } from "~/env";
import { db } from "~/server/db";

import { normalizeRequestHost } from "~/lib/request-host";

export type TenantResolutionState = "resolved" | "not-found" | "ambiguous" | "bootstrap-required";

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
    return {
      state: "bootstrap-required",
      host,
    };
  }

  if (!host) {
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
    return {
      state: "ambiguous",
      host,
    };
  }

  const match = matches[0];
  if (!match) {
    return {
      state: "not-found",
      host,
    };
  }

  if (env.NODE_ENV === "production" && !match.verifiedAt) {
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

  return {
    state: "resolved",
    host,
    canonicalHost: primaryDomain?.domain ?? match.domain,
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