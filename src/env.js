import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const isZeptoMailDriver =
  process.env.EMAIL_DRIVER?.trim().toLowerCase() === "zeptomail";
const isProduction = process.env.NODE_ENV === "production";

const hasAnyPushEnv = Boolean(
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
    process.env.VAPID_PRIVATE_KEY ??
    process.env.VAPID_SUBJECT,
);

const requiresPushEnv = isProduction || hasAnyPushEnv;

const selfHostedFlagSchema = z.preprocess((value) => {
  if (value === undefined) {
    return true;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }

  return value;
}, z.boolean());

const domainVerificationEnabledSchema = z.preprocess((value) => {
  if (value === undefined) {
    return true;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }

  return value;
}, z.boolean());

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    DATABASE_URL: z.string().url(),
    SELF_HOSTED: selfHostedFlagSchema,
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    STORAGE_DRIVER: z.enum(["r2"]).default("r2"),
    DOMAIN_VERIFICATION_ENABLED: domainVerificationEnabledSchema,
    DOMAIN_VERIFICATION_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(20_000).default(5_000),
    DOMAIN_VERIFICATION_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(3),
    DOMAIN_VERIFICATION_RETRY_DELAY_MS: z.coerce.number().int().min(100).max(5_000).default(500),
    R2_ACCOUNT_ID: z.string().optional(),
    R2_BUCKET: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_PUBLIC_BASE_URL: z.string().url().optional(),
    EMAIL_DRIVER: z.enum(["zeptomail"]).optional(),
    EMAIL_FROM_ADDRESS: z
      .string()
      .email()
      .optional()
      .refine((value) => !isZeptoMailDriver || Boolean(value), {
        message: "EMAIL_FROM_ADDRESS is required when EMAIL_DRIVER=zeptomail",
      }),
    EMAIL_FROM_NAME: z
      .string()
      .min(1)
      .optional()
      .refine((value) => !isZeptoMailDriver || Boolean(value), {
        message: "EMAIL_FROM_NAME is required when EMAIL_DRIVER=zeptomail",
      }),
    ZEPTOMAIL_API_KEY: z.string().optional().refine((value) => !isZeptoMailDriver || Boolean(value), {
      message: "ZEPTOMAIL_API_KEY is required when EMAIL_DRIVER=zeptomail",
    }),
    ZEPTOMAIL_ACCOUNT_ID: z
      .string()
      .optional()
      .refine((value) => !isZeptoMailDriver || Boolean(value), {
        message: "ZEPTOMAIL_ACCOUNT_ID is required when EMAIL_DRIVER=zeptomail",
      }),
    ZEPTOMAIL_API_BASE_URL: z.string().url().optional(),
    VAPID_PRIVATE_KEY: z
      .string()
      .optional()
      .refine((value) => !requiresPushEnv || Boolean(value), {
        message:
          "VAPID_PRIVATE_KEY is required in production (and whenever any VAPID env is configured)",
      }),
    VAPID_SUBJECT: z
      .string()
      .optional()
      .refine((value) => !requiresPushEnv || Boolean(value), {
        message:
          "VAPID_SUBJECT is required in production (and whenever any VAPID env is configured)",
      })
      .refine((value) => !value || value.startsWith("mailto:") || /^https?:\/\//.test(value), {
        message: "VAPID_SUBJECT must be a mailto: or http(s) URL",
      }),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z
      .string()
      .optional()
      .refine((value) => !requiresPushEnv || Boolean(value), {
        message:
          "NEXT_PUBLIC_VAPID_PUBLIC_KEY is required in production (and whenever any VAPID env is configured)",
      }),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    SELF_HOSTED: process.env.SELF_HOSTED,
    NODE_ENV: process.env.NODE_ENV,
    STORAGE_DRIVER: process.env.STORAGE_DRIVER,
    DOMAIN_VERIFICATION_ENABLED: process.env.DOMAIN_VERIFICATION_ENABLED,
    DOMAIN_VERIFICATION_TIMEOUT_MS: process.env.DOMAIN_VERIFICATION_TIMEOUT_MS,
    DOMAIN_VERIFICATION_MAX_ATTEMPTS: process.env.DOMAIN_VERIFICATION_MAX_ATTEMPTS,
    DOMAIN_VERIFICATION_RETRY_DELAY_MS: process.env.DOMAIN_VERIFICATION_RETRY_DELAY_MS,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_BUCKET: process.env.R2_BUCKET,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL,
    EMAIL_DRIVER: process.env.EMAIL_DRIVER,
    EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS,
    EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,
    ZEPTOMAIL_API_KEY: process.env.ZEPTOMAIL_API_KEY,
    ZEPTOMAIL_ACCOUNT_ID: process.env.ZEPTOMAIL_ACCOUNT_ID,
    ZEPTOMAIL_API_BASE_URL: process.env.ZEPTOMAIL_API_BASE_URL,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
