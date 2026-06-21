/**
 * Rejects host strings containing control characters, null bytes, line breaks,
 * or embedded whitespace — all indicators of a host-header injection attempt.
 * Returns the original string when safe, null when it must be rejected.
 */
export function sanitizeHostInput(raw: string): string | null {
  // Reject control chars (0x00–0x1f), DEL (0x7f), and any whitespace
  if (/[\x00-\x1f\x7f\s]/.test(raw)) return null;
  // Hostname max is 253 chars per RFC 1035; allow a few more for :port
  if (raw.length > 263) return null;
  return raw;
}

export function normalizeRequestHost(headers: Headers): string | null {
  const forwardedHost = headers.get("x-request-host") ?? headers.get("x-forwarded-host") ?? headers.get("host")

  if (!forwardedHost) {
    return null
  }

  const raw = forwardedHost.split(",")[0]?.trim()
  if (!raw) {
    return null
  }

  // Reject injection attempts before handing off to the URL parser
  if (!sanitizeHostInput(raw)) {
    return null
  }

  try {
    const normalized = new URL(`http://${raw}`).hostname.toLowerCase()
    return normalized.replace(/\.$/, "")
  } catch {
    return null
  }
}

export function resolveRequestProtocol(headers: Headers): "http" | "https" {
  const forwardedProto = headers.get("x-forwarded-proto")

  return forwardedProto === "http" || forwardedProto === "https" ? forwardedProto : "https"
}

export function buildAbsoluteUrl(headers: Headers, host: string, path: string): string {
  const protocol = resolveRequestProtocol(headers)
  const normalizedPath = path.startsWith("/") ? path : `/${path}`

  return `${protocol}://${host}${normalizedPath}`
}