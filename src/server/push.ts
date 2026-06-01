import * as webpush from "web-push"
import { env } from "~/env"

export type PushOutcome = "SENT" | "FAILED" | "INVALID_SUBSCRIPTION"

export interface PushPayload {
  title: string
  body: string
  targetUrl?: string
  icon?: string
  badge?: string
  tag?: string
}

export interface PushSubscriptionData {
  endpoint: string
  p256dh: string
  auth: string
}

interface PushResult {
  outcome: PushOutcome
  providerMessageId?: string
  errorMessage?: string
}

type WebPushErrorLike = Error & {
  statusCode?: number
}

function isWebPushError(error: unknown): error is WebPushErrorLike {
  return error instanceof Error && "statusCode" in error
}

export function isPushConfigured() {
  return Boolean(
    env.VAPID_PRIVATE_KEY &&
      env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      env.VAPID_SUBJECT,
  )
}

/**
 * Initialize VAPID settings once on module load.
 * Called automatically on first import.
 */
function initializeVapid() {
  if (!isPushConfigured()) {
    console.warn(
      "[push:init] VAPID keys not configured; push dispatch will be skipped",
    )
    return
  }

  const subject = env.VAPID_SUBJECT
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = env.VAPID_PRIVATE_KEY

  if (!subject || !publicKey || !privateKey) {
    return
  }

  try {
    webpush.setVapidDetails(
      subject,
      publicKey,
      privateKey,
    )
  } catch (error) {
    console.error(
      "[push:init] Failed to set VAPID details:",
      error instanceof Error ? error.message : String(error),
    )
  }
}

/**
 * Send a web push notification to a subscription.
 * Returns a typed outcome for delivery-log tracking.
 */
export async function sendPush(
  subscription: PushSubscriptionData,
  payload: PushPayload,
): Promise<PushResult> {
  // Ensure VAPID is initialized
  if (!isPushConfigured()) {
    return {
      outcome: "FAILED",
      errorMessage: "VAPID keys not configured",
    }
  }

  try {
    const response = await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon,
        badge: payload.badge,
        tag: payload.tag,
        ...(payload.targetUrl && { data: { targetUrl: payload.targetUrl } }),
      }),
    )

    // Successful send
    return {
      outcome: "SENT",
      providerMessageId: response?.headers?.["x-goog-message-id"] ?? undefined,
    }
  } catch (error) {
    // Handle webpush-specific errors
    if (isWebPushError(error)) {
      const statusCode = error.statusCode

      // Terminal errors: subscription is invalid/expired
      if (statusCode === 404 || statusCode === 410) {
        return {
          outcome: "INVALID_SUBSCRIPTION",
          errorMessage: `Terminal error: ${statusCode} ${error.message}`,
        }
      }

      // Transient/other errors
      return {
        outcome: "FAILED",
        errorMessage: `${statusCode} ${error.message}`,
      }
    }

    // Unexpected error
    return {
      outcome: "FAILED",
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  }
}

// Initialize VAPID settings on module load
initializeVapid()
