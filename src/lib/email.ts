/**
 * Lowercases and trims an email for stable comparisons and storage checks.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Compares two emails using normalized values.
 */
export function emailsMatch(a: string, b: string): boolean {
  return normalizeEmail(a) === normalizeEmail(b)
}
