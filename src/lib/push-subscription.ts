export type PushSubscriptionPayload = {
  endpoint: string
  expirationTime?: number | null
  keys: {
    p256dh: string
    auth: string
  }
}

export function isBrowserPushSupported() {
  if (typeof window === "undefined") {
    return false
  }

  return (
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  )
}

export function getNotificationPermissionState(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported"
  }

  return Notification.permission
}

function isLikelyElectronBrowser() {
  if (typeof navigator === "undefined") {
    return false
  }

  return /\bElectron\/\d+/i.test(navigator.userAgent)
}

async function ensureServiceWorkerReady() {
  const existingRegistration = await navigator.serviceWorker.getRegistration("/")

  if (!existingRegistration) {
    await navigator.serviceWorker.register("/sw.js")
  }

  return navigator.serviceWorker.ready
}

function shouldRetrySubscription(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  const normalized = error.message.toLowerCase()

  return (
    error.name === "AbortError" ||
    normalized.includes("registration failed") ||
    normalized.includes("push service error")
  )
}

async function recoverServiceWorkerRegistration() {
  const registrations = await navigator.serviceWorker.getRegistrations()

  await Promise.all(registrations.map((registration) => registration.unregister()))

  await navigator.serviceWorker.register("/sw.js")

  return navigator.serviceWorker.ready
}

function mapSubscribeError(error: unknown) {
  if (!(error instanceof Error)) {
    return new Error("Push subscription failed due to an unknown browser error")
  }

  const browserMessage = error.message.trim()
  const normalized = browserMessage.toLowerCase()

  if (
    error.name === "NotAllowedError" ||
    normalized.includes("permission denied") ||
    normalized.includes("push service error")
  ) {
    if (isLikelyElectronBrowser()) {
      return new Error(
        "Browser blocked push subscription in this environment. VS Code's integrated browser (Electron) has limited Push API support and may behave like incognito mode. Open the app in regular Chrome or Edge and try again.",
      )
    }

    if (normalized.includes("push service error")) {
      return new Error(
        "Browser push subscription failed at the push service. Confirm you are using a regular browser profile, allow push messaging for this browser, and verify network/policy rules are not blocking push endpoints (FCM). If needed, clear site data for localhost and retry.",
      )
    }

    return new Error(
      `Browser push subscription was blocked by the browser: ${browserMessage || "permission denied"}`,
    )
  }

  if (error.name === "NotSupportedError") {
    return new Error(
      "Push subscription is not supported in this browser context. Ensure the app runs on HTTPS (or localhost) in a full browser profile.",
    )
  }

  return new Error(browserMessage || "Failed to subscribe to push notifications")
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const normalized = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(normalized)
  const outputArray = new Uint8Array(rawData.length)

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index)
  }

  return outputArray
}

function toPayload(subscription: PushSubscription): PushSubscriptionPayload {
  const json = subscription.toJSON()
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth

  if (!p256dh || !auth) {
    throw new Error("Push subscription is missing encryption keys")
  }

  return {
    endpoint: subscription.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: {
      p256dh,
      auth,
    },
  }
}

export async function subscribeBrowserPush(vapidPublicKey: string) {
  if (!isBrowserPushSupported()) {
    throw new Error("Browser push is not supported")
  }

  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)

  try {
    const registration = await ensureServiceWorkerReady()
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        })
      } catch (subscribeError) {
        if (!shouldRetrySubscription(subscribeError)) {
          throw subscribeError
        }

        const recoveredRegistration = await recoverServiceWorkerRegistration()
        subscription = await recoveredRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        })
      }
    }

    return toPayload(subscription)
  } catch (error) {
    throw mapSubscribeError(error)
  }
}

export async function getCurrentBrowserPushSubscription() {
  if (!isBrowserPushSupported()) {
    return null
  }

  const registration = await ensureServiceWorkerReady()
  const subscription = await registration.pushManager.getSubscription()

  return subscription ? toPayload(subscription) : null
}

export async function unsubscribeBrowserPush(targetEndpoint?: string) {
  if (!isBrowserPushSupported()) {
    return false
  }

  const registration = await ensureServiceWorkerReady()
  const subscription = await registration.pushManager.getSubscription()

  if (!subscription) {
    return false
  }

  if (targetEndpoint && subscription.endpoint !== targetEndpoint) {
    return false
  }

  return subscription.unsubscribe()
}
