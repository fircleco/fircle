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

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })
  }

  return toPayload(subscription)
}

export async function getCurrentBrowserPushSubscription() {
  if (!isBrowserPushSupported()) {
    return null
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()

  return subscription ? toPayload(subscription) : null
}

export async function unsubscribeBrowserPush(targetEndpoint?: string) {
  if (!isBrowserPushSupported()) {
    return false
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()

  if (!subscription) {
    return false
  }

  if (targetEndpoint && subscription.endpoint !== targetEndpoint) {
    return false
  }

  return subscription.unsubscribe()
}
