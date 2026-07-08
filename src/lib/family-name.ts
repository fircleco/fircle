export function normalizeFamilyNameInput(value: string): string {
  const collapsedWhitespace = value.replace(/\s+/g, " ").trim();
  const withoutLeadingArticle = collapsedWhitespace.replace(/^the\s+/i, "");
  const withoutFamilySuffix = withoutLeadingArticle.replace(/\s+family$/i, "");

  return withoutFamilySuffix.trim();
}

export function formatFamilyDisplayName(
  value: string,
  options?: {
    includeArticle?: boolean;
    includeSuffix?: boolean;
  },
): string {
  const normalizedName = normalizeFamilyNameInput(value);
  if (!normalizedName) {
    return "Family";
  }

  const includeArticle = options?.includeArticle ?? true;
  const includeSuffix = options?.includeSuffix ?? true;

  return `${includeArticle ? "The " : ""}${normalizedName}${includeSuffix ? " Family" : ""}`;
}

export function formatFamilyLockup(value: string): string {
  const familyName = formatFamilyDisplayName(value, {
    includeArticle: false,
    includeSuffix: false,
  });

  if (!familyName || familyName === "Family") {
    return "Fircle";
  }

  return `${familyName} on Fircle`;
}
