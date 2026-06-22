import bcrypt from "bcryptjs"
import * as webpush from "web-push"

import { TRPCError } from "@trpc/server"
import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3"
import { PrismaClient } from "../../../../generated/prisma"

import { env } from "~/env"
import { getMemberSlugBase, resolveUniqueMemberSlug } from "~/lib/member-slug"
import { firstFamilySetupInputSchema } from "~/lib/setup-schemas"
import { checkRateLimit, getClientIp } from "~/lib/rate-limit"
import { getConfiguredEmailDriver } from "~/server/email/provider"
import { isPushConfigured } from "~/server/push"
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc"

type SetupCheckStatus = "ok" | "warning" | "blocking"

type SetupReadinessCheck = {
  key: "database" | "auth" | "storage" | "push" | "email"
  label: string
  status: SetupCheckStatus
  message: string
  remediation?: string
}

async function probeZeptoMailCredentials(): Promise<{
  status: SetupCheckStatus
  message: string
}> {
  const apiKey = env.ZEPTOMAIL_API_KEY
  const apiBaseUrl = env.ZEPTOMAIL_API_BASE_URL ?? "https://api.zeptomail.com"
  const endpoint = `${apiBaseUrl.replace(/\/+$/, "")}/v1.1/email`

  if (!apiKey) {
    return {
      status: "blocking",
      message: "ZEPTOMAIL_API_KEY is missing.",
    }
  }

  try {
    // Intentional invalid payload: auth passes => 4xx invalid request, auth fails => 401/403.
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Zoho-enczapikey ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    })

    if (response.status === 401 || response.status === 403) {
      return {
        status: "blocking",
        message: "Email provider rejected authentication credentials.",
      }
    }

    if (response.status === 429) {
      return {
        status: "warning",
        message: "Email provider is rate-limiting requests; credentials appear valid.",
      }
    }

    if (response.status >= 500) {
      return {
        status: "warning",
        message: "Email provider is temporarily unavailable.",
      }
    }

    if (response.status >= 400) {
      return {
        status: "ok",
        message: "Email provider credentials were accepted.",
      }
    }

    return {
      status: "ok",
      message: "Email provider credentials were validated.",
    }
  } catch {
    return {
      status: "warning",
      message: "Could not reach email provider to validate credentials.",
    }
  }
}

function normalizeRequestHost(headers: Headers): string | null {
  const forwardedHost = headers.get("x-forwarded-host") ?? headers.get("host")
  if (!forwardedHost) {
    return null
  }

  const rawHost = forwardedHost.split(",")[0]?.trim()
  if (!rawHost) {
    return null
  }

  try {
    const normalized = new URL(`http://${rawHost}`).hostname.toLowerCase()
    return normalized.replace(/\.$/, "")
  } catch {
    return null
  }
}

function slugifyFamilyText(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return normalized.length > 0 ? normalized : "family"
}

async function resolveUniqueFamilySlug(tx: Pick<PrismaClient, "family">, baseSlug: string): Promise<string> {
  let attempt = 0

  while (attempt < 1000) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`
    const existingFamily = await tx.family.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })

    if (!existingFamily) {
      return candidate
    }

    attempt += 1
  }

  throw new Error("Could not resolve a unique family slug")
}

export const setupRouter = createTRPCRouter({
  getBootstrapStatus: publicProcedure.query(async ({ ctx }) => {
    if (!env.SELF_HOSTED) {
      return {
        selfHosted: false,
        requiresSetup: false,
      }
    }

    const existingFamily = await ctx.db.family.findFirst({
      select: { id: true },
    })

    return {
      selfHosted: true,
      requiresSetup: !existingFamily,
    }
  }),

  getSetupReadiness: publicProcedure.query(async () => {
    if (!env.SELF_HOSTED) {
      return {
        selfHosted: false,
        checks: [] as SetupReadinessCheck[],
        hasBlocking: false,
        canProceed: false,
      }
    }

    const checks: SetupReadinessCheck[] = []

    // 1) Database readiness
    const readinessDbProbe = new PrismaClient({
      datasources: {
        db: {
          url: env.DATABASE_URL,
        },
      },
      log: ["error"],
    })

    try {
      await readinessDbProbe.$connect()
      await readinessDbProbe.$queryRawUnsafe("SELECT 1")
      checks.push({
        key: "database",
        label: "Database",
        status: "ok",
        message: "Database connection is healthy.",
      })
    } catch {
      checks.push({
        key: "database",
        label: "Database",
        status: "blocking",
        message: "Database connection failed.",
        remediation: "Verify DATABASE_URL and ensure the database server is reachable.",
      })
    } finally {
      await readinessDbProbe.$disconnect().catch(() => undefined)
    }

    // 2) Auth secret readiness
    if (env.AUTH_SECRET) {
      checks.push({
        key: "auth",
        label: "Auth secret",
        status: "ok",
        message: "AUTH_SECRET is configured.",
      })
    } else {
      const isBlocking = env.NODE_ENV === "production"
      checks.push({
        key: "auth",
        label: "Auth secret",
        status: isBlocking ? "blocking" : "warning",
        message: isBlocking
          ? "AUTH_SECRET is missing in production."
          : "AUTH_SECRET is not set (allowed in development).",
        remediation: "Set AUTH_SECRET to a strong random value before production use.",
      })
    }

    // 3) Storage readiness (R2 credential + bucket access probe)
    try {
      const storageProbeClient = new S3Client({
        region: "auto",
        endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        forcePathStyle: true,
        credentials: {
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        },
      })

      await storageProbeClient.send(
        new HeadBucketCommand({
          Bucket: env.R2_BUCKET,
        }),
      )

      checks.push({
        key: "storage",
        label: "Object storage",
        status: "ok",
        message: "Object storage credentials are valid and bucket is reachable.",
      })
    } catch (error) {
      const probeMessage = error instanceof Error ? ` (${error.message})` : ""
      checks.push({
        key: "storage",
        label: "Object storage",
        status: "blocking",
        message: `Storage provider is not ready.${probeMessage}`,
        remediation:
          "For self-hosted installs, verify R2_* environment variables. For cloud deployments, configure owner-managed storage credentials in Settings > Integrations.",
      })
    }

    // 4) Push/VAPID readiness (presence + syntax validation)
    if (!isPushConfigured()) {
      const isBlocking = env.NODE_ENV === "production"
      checks.push({
        key: "push",
        label: "Web Push (VAPID)",
        status: isBlocking ? "blocking" : "warning",
        message: isBlocking
          ? "VAPID keys are required in production."
          : "VAPID keys are not configured (push notifications disabled).",
        remediation:
          "Set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT.",
      })
    } else {
      try {
        const subject = env.VAPID_SUBJECT
        const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        const privateKey = env.VAPID_PRIVATE_KEY

        if (!subject || !publicKey || !privateKey) {
          throw new Error("VAPID keys are missing.")
        }

        webpush.setVapidDetails(
          subject,
          publicKey,
          privateKey,
        )

        checks.push({
          key: "push",
          label: "Web Push (VAPID)",
          status: "ok",
          message: "VAPID subject and keys are configured with valid format.",
        })
      } catch (error) {
        const isBlocking = env.NODE_ENV === "production"
        const detail = error instanceof Error ? ` (${error.message})` : ""
        checks.push({
          key: "push",
          label: "Web Push (VAPID)",
          status: isBlocking ? "blocking" : "warning",
          message: `VAPID configuration is invalid.${detail}`,
          remediation:
            "Regenerate and set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT.",
        })
      }
    }

    // 5) Email readiness (optional unless configured)
    try {
      const configuredDriver = getConfiguredEmailDriver()

      if (!configuredDriver) {
        checks.push({
          key: "email",
          label: "Transactional email",
          status: "warning",
          message: "No email driver configured.",
          remediation: "Set EMAIL_DRIVER and provider keys to enable email invites/notifications.",
        })
      } else if (configuredDriver === "zeptomail") {
        const probe = await probeZeptoMailCredentials()
        checks.push({
          key: "email",
          label: "Transactional email",
          status: probe.status,
          message: probe.message,
          remediation:
            probe.status === "blocking"
              ? "Verify EMAIL_DRIVER, ZEPTOMAIL_API_KEY, ZEPTOMAIL_ACCOUNT_ID, and ZEPTOMAIL_API_BASE_URL."
              : undefined,
        })
      }
    } catch {
      checks.push({
        key: "email",
        label: "Transactional email",
        status: "blocking",
        message: "Email provider configuration is invalid.",
        remediation: "Verify EMAIL_DRIVER and provider-specific env variables.",
      })
    }

    const hasBlocking = checks.some((check) => check.status === "blocking")

    return {
      selfHosted: true,
      checks,
      hasBlocking,
      canProceed: !hasBlocking,
    }
  }),

  bootstrapFirstFamily: publicProcedure
    .input(firstFamilySetupInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!env.SELF_HOSTED) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "First-family bootstrap is available only in self-hosted mode.",
        })
      }

      const ip = getClientIp(ctx.headers)
      const setupRateLimit = checkRateLimit(`setup:first-family:${ip}`, 5, 15 * 60_000)
      if (!setupRateLimit.ok) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many setup attempts. Please try again later.",
        })
      }

      const hasAnyFamily = await ctx.db.family.findFirst({
        select: { id: true },
      })

      if (hasAnyFamily) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This instance is already configured. Sign in to continue.",
        })
      }

      const hashedPassword = await bcrypt.hash(input.password, 12)

      const created = await ctx.db.$transaction(async (tx) => {
        const familySlug = await resolveUniqueFamilySlug(
          tx,
          slugifyFamilyText(input.familyName),
        )

        const family = await tx.family.create({
          data: {
            name: input.familyName,
            slug: familySlug,
          },
          select: {
            id: true,
            name: true,
          },
        })

        const user = await tx.user.create({
          data: {
            familyId: family.id,
            email: input.email,
            password: hashedPassword,
          },
          select: {
            id: true,
            email: true,
          },
        })

        const memberSlug = await resolveUniqueMemberSlug(
          tx,
          family.id,
          getMemberSlugBase(input.ownerName, input.ownerNickname),
        )

        await tx.familyMember.create({
          data: {
            familyId: family.id,
            userId: user.id,
            name: input.ownerName,
            nickname: input.ownerNickname ?? null,
            slug: memberSlug,
            role: "OWNER",
          },
          select: {
            id: true,
          },
        })

        const installationHost = normalizeRequestHost(ctx.headers)
        if (!installationHost) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Unable to determine the installation host for this setup.",
          })
        }

        await tx.domain.upsert({
          where: {
            domain: installationHost,
          },
          update: {
            familyId: family.id,
            isPrimary: true,
            verifiedAt: new Date(),
          },
          create: {
            familyId: family.id,
            domain: installationHost,
            isPrimary: true,
            verifiedAt: new Date(),
          },
        })

        return {
          family,
          user,
        }
      })

      return {
        family: created.family,
        user: created.user,
      }
    }),
})
