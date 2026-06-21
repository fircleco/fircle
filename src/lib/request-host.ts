export function normalizeRequestHost(headers: Headers): string | null {
  const forwardedHost = headers.get("x-request-host") ?? headers.get("x-forwarded-host") ?? headers.get("host")

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

export function resolveRequestProtocol(headers: Headers): "http" | "https" {
  const forwardedProto = headers.get("x-forwarded-proto")

  return forwardedProto === "http" || forwardedProto === "https" ? forwardedProto : "https"
}

export function buildAbsoluteUrl(headers: Headers, host: string, path: string): string {
  const protocol = resolveRequestProtocol(headers)
  const normalizedPath = path.startsWith("/") ? path : `/${path}`

  return `${protocol}://${host}${normalizedPath}`
}