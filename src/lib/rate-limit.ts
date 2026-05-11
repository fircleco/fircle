/**
 * Simple in-memory sliding window rate limiter.
 *
 * Suitable for single-instance deployments (development and small production setups).
 * For multi-instance production environments, replace with a distributed solution
 * such as Upstash Redis rate limiting.
 */

type WindowEntry = {
  timestamps: number[]
  lastCleanup: number
}

const store = new Map<string, WindowEntry>()

// Prune stale keys that have had no activity within a full window
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

function getEntry(key: string): WindowEntry {
  let entry = store.get(key)
  if (!entry) {
    entry = { timestamps: [], lastCleanup: Date.now() }
    store.set(key, entry)
  }
  return entry
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterMs: number }

/**
 * Check whether a keyed request is within the allowed rate limit.
 *
 * @param key      Unique identifier for the rate-limited slot (e.g. "invite:lookup:1.2.3.4")
 * @param limit    Maximum number of requests allowed within the window
 * @param windowMs Rolling window duration in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now()
  const windowStart = now - windowMs
  const entry = getEntry(key)

  // Remove timestamps outside the current window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart)

  // Periodically clean up idle entries to prevent unbounded memory growth
  if (now - entry.lastCleanup > CLEANUP_INTERVAL_MS) {
    entry.lastCleanup = now
    if (entry.timestamps.length === 0) {
      store.delete(key)
      return { ok: true }
    }
  }

  if (entry.timestamps.length >= limit) {
    const oldestInWindow = entry.timestamps[0]!
    const retryAfterMs = Math.max(oldestInWindow + windowMs - now, 0)
    return { ok: false, retryAfterMs }
  }

  entry.timestamps.push(now)
  return { ok: true }
}

/**
 * Extract a best-effort client IP from request headers.
 * Falls back to "unknown" if no identifiable IP header is present.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  const realIp = headers.get("x-real-ip")
  if (realIp) return realIp.trim()
  return "unknown"
}
