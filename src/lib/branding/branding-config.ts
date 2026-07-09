import { z } from "zod";

import {
  LOGOTYPE_FONT_PROVIDER,
  buildLogotypeFontStylesheetUrl,
  isLogotypeFontName,
  normalizeLogotypeFontName,
  resolveLogotypeFontName,
} from "./logotype-fonts";

const logotypeFontNameSchema = z.string().min(1).transform((value, ctx) => {
  const resolvedFontName = resolveLogotypeFontName(value);

  if (!resolvedFontName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "fontName must be one of the provided allowlist values.",
    });
    return z.NEVER;
  }

  return resolvedFontName;
});

const logotypeConfigSchema = z
  .object({
    enabled: z.boolean(),
    fontName: logotypeFontNameSchema.optional(),
    fontProvider: z.literal(LOGOTYPE_FONT_PROVIDER),
  })
  .superRefine((value, ctx) => {
    if (value.enabled && !value.fontName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fontName"],
        message: "fontName is required when logotype is enabled.",
      });
    }
  });

export const brandingConfigSchema = z.object({
  version: z.literal(1),
  logotype: logotypeConfigSchema,
});

export type BrandingConfig = z.infer<typeof brandingConfigSchema>;

export function parseBrandingConfig(value: unknown): BrandingConfig {
  return brandingConfigSchema.parse(value);
}

export function tryParseBrandingConfig(value: unknown): BrandingConfig | null {
  const result = brandingConfigSchema.safeParse(value);

  return result.success ? result.data : null;
}

export function getBrandingConfigFontStylesheetUrl(value: BrandingConfig): string | null {
  if (!value.logotype.enabled || !value.logotype.fontName) {
    return null;
  }

  return buildLogotypeFontStylesheetUrl(value.logotype.fontName);
}

export {
  isLogotypeFontName,
  normalizeLogotypeFontName,
  resolveLogotypeFontName,
};