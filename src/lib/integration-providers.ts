import { z } from "zod";

/**
 * Field definition for dynamic form rendering.
 */
export interface FieldDef {
  name: string;
  label: string;
  type: "text" | "password" | "email" | "url" | "number";
  placeholder?: string;
  required?: boolean;
  description?: string;
}

/**
 * Provider definition with metadata and field schema.
 */
export interface ProviderDef {
  category: string;
  provider: string;
  label: string;
  description: string;
  fields: FieldDef[];
  payloadSchema: z.ZodSchema;
}

/**
 * Storage provider: Cloudflare R2
 */
export const storageR2Provider: ProviderDef = {
  category: "storage",
  provider: "r2",
  label: "Cloudflare R2",
  description: "S3-compatible object storage powered by Cloudflare",
  fields: [
    {
      name: "accountId",
      label: "R2 Account ID",
      type: "text",
      placeholder: "account-id",
      required: true,
      description: "Your Cloudflare R2 account ID",
    },
    {
      name: "bucket",
      label: "Bucket Name",
      type: "text",
      placeholder: "family-media",
      required: true,
      description: "Name of the R2 bucket to use for storage",
    },
    {
      name: "accessKeyId",
      label: "Access Key ID",
      type: "text",
      placeholder: "access key id",
      required: true,
      description: "R2 API token access key ID",
    },
    {
      name: "secretAccessKey",
      label: "Secret Access Key",
      type: "password",
      placeholder: "secret access key",
      required: true,
      description: "R2 API token secret access key",
    },
    {
      name: "publicBaseUrl",
      label: "Public Base URL",
      type: "url",
      placeholder: "https://pub-xyz.r2.dev",
      required: true,
      description: "Public URL prefix for accessing objects in this bucket",
    },
  ],
  payloadSchema: z.object({
    accountId: z.string().trim().min(1).max(100),
    bucket: z.string().trim().min(1).max(255),
    accessKeyId: z.string().trim().min(1).max(255),
    secretAccessKey: z.string().trim().min(1).max(500),
    publicBaseUrl: z.string().trim().url(),
  }),
};

/**
 * Provider registry organized by category.
 */
export const INTEGRATION_PROVIDERS = {
  storage: {
    r2: storageR2Provider,
    // Future: gcs, s3, azure, etc.
  },
  // Future: ai, webhook, etc.
} as const;

/**
 * Extract category type from registry.
 */
export type IntegrationCategory = keyof typeof INTEGRATION_PROVIDERS;

/**
 * Extract provider type for a given category.
 */
export type IntegrationProvider<C extends IntegrationCategory = IntegrationCategory> =
  keyof typeof INTEGRATION_PROVIDERS[C];

/**
 * Get all available categories.
 */
export function getAvailableCategories(): IntegrationCategory[] {
  return Object.keys(INTEGRATION_PROVIDERS) as IntegrationCategory[];
}

/**
 * Get all providers for a given category.
 */
export function getProvidersForCategory(category: IntegrationCategory): ProviderDef[] {
  const categoryProviders = INTEGRATION_PROVIDERS[category];
  if (!categoryProviders) {
    return [];
  }
  return Object.values(categoryProviders);
}

/**
 * Get a specific provider definition.
 */
export function getProviderDef(
  category: IntegrationCategory,
  provider: IntegrationProvider
): ProviderDef | null {
  const categoryProviders = INTEGRATION_PROVIDERS[category];
  if (!categoryProviders) {
    return null;
  }
  const prov = categoryProviders[provider as keyof typeof categoryProviders];
  return prov ?? null;
}

/**
 * Validate payload against a provider's schema.
 */
export function validateProviderPayload(
  category: IntegrationCategory,
  provider: IntegrationProvider,
  payload: unknown,
): { ok: boolean; message?: string } {
  const providerDef = getProviderDef(category, provider);
  if (!providerDef) {
    return { ok: false, message: `Unknown provider: ${category}/${provider}` };
  }

  const result = providerDef.payloadSchema.safeParse(payload);
  if (!result.success) {
    return { ok: false, message: `Invalid payload: ${result.error.message}` };
  }

  return { ok: true };
}
