// @ts-nocheck

/** @typedef {{ title?: string; body?: string; url?: string; targetUrl?: string; data?: { url?: string; targetUrl?: string } }} PushPayload */

const sw = globalThis;

const DEFAULT_NOTIFICATION_URL = "/notifications";
const SW_CACHE_PREFIX = "fircle-shell";
const SW_CACHE_VERSION = "v1";
const SW_CACHE_NAME = `${SW_CACHE_PREFIX}-${SW_CACHE_VERSION}`;
const NAVIGATION_FALLBACK_URL = "/";

/** @type {string[]} */
const PRECACHE_URLS = [
  NAVIGATION_FALLBACK_URL,
  "/manifest.json",
  "/icon.svg",
  "/icon.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
];

/**
 * @param {string} targetUrl
 */
function toAbsoluteUrl(targetUrl) {
  try {
    const parsedUrl = new URL(targetUrl, sw.location.origin);
    if (parsedUrl.origin !== sw.location.origin) {
      return new URL(DEFAULT_NOTIFICATION_URL, sw.location.origin).toString();
    }

    return parsedUrl.toString();
  } catch {
    return new URL(DEFAULT_NOTIFICATION_URL, sw.location.origin).toString();
  }
}

/**
 * @param {PushPayload} payload
 */
function getPayloadTargetUrl(payload) {
  return (
    payload.url ||
    payload.targetUrl ||
    payload.data?.url ||
    payload.data?.targetUrl ||
    DEFAULT_NOTIFICATION_URL
  );
}

function onInstall(event) {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SW_CACHE_NAME);
      await cache.addAll(PRECACHE_URLS);
      await sw.skipWaiting();
    })(),
  );
}

function onActivate(event) {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys.map((cacheKey) => {
          if (cacheKey.startsWith(SW_CACHE_PREFIX) && cacheKey !== SW_CACHE_NAME) {
            return caches.delete(cacheKey);
          }

          return Promise.resolve(false);
        }),
      );
      await sw.clients.claim();
    })(),
  );
}

function onMessage(event) {
  if (event.data?.type === "SKIP_WAITING") {
    void sw.skipWaiting();
  }
}

function onPush(event) {
  /** @type {PushPayload} */
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title || "Fircle";
  const options = {
    body: payload.body || "You have a new notification.",
    icon: "/icon.svg",
    badge: "/favicon.ico",
    data: {
      url: getPayloadTargetUrl(payload),
    },
  };

  event.waitUntil(sw.registration.showNotification(title, options));
}

function onFetch(event) {
  const request = event.request;

  if (request.mode !== "navigate") {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(request);

        if (networkResponse && networkResponse.ok) {
          const cache = await caches.open(SW_CACHE_NAME);
          void cache.put(request, networkResponse.clone());
        }

        return networkResponse;
      } catch {
        const cachedNavigation = await caches.match(request, { ignoreSearch: true });
        if (cachedNavigation) {
          return cachedNavigation;
        }

        const shellFallback = await caches.match(NAVIGATION_FALLBACK_URL);
        if (shellFallback) {
          return shellFallback;
        }

        return new Response("Offline", {
          status: 503,
          statusText: "Offline",
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
          },
        });
      }
    })(),
  );
}

function onNotificationClick(event) {
  event.notification.close();

  const targetUrl = toAbsoluteUrl(event.notification.data?.url || DEFAULT_NOTIFICATION_URL);

  event.waitUntil(
    (async () => {
      const clientsList = await sw.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clientsList) {
        const clientUrl = new URL(client.url);

        if (clientUrl.origin !== sw.location.origin) {
          continue;
        }

        if ("focus" in client) {
          await client.focus();

          if (client.url !== targetUrl && "navigate" in client) {
            try {
              await client.navigate(targetUrl);
            } catch {
              await sw.clients.openWindow(targetUrl);
            }
          }

          return;
        }
      }

      await sw.clients.openWindow(targetUrl);
    })(),
  );
}

sw.addEventListener("install", onInstall);
sw.addEventListener("activate", onActivate);
sw.addEventListener("message", onMessage);
sw.addEventListener("push", onPush);
sw.addEventListener("fetch", onFetch);
sw.addEventListener("notificationclick", onNotificationClick);