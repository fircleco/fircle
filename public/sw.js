// @ts-nocheck

/** @typedef {{ title?: string; body?: string; url?: string }} PushPayload */

const sw = globalThis;

const DEFAULT_NOTIFICATION_URL = "/notifications";

/**
 * @param {string} targetUrl
 */
function toAbsoluteUrl(targetUrl) {
  try {
    return new URL(targetUrl, sw.location.origin).toString();
  } catch {
    return new URL(DEFAULT_NOTIFICATION_URL, sw.location.origin).toString();
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
      url: payload.url || DEFAULT_NOTIFICATION_URL,
    },
  };

  event.waitUntil(sw.registration.showNotification(title, options));
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
        if ("focus" in client) {
          const focusedUrl = new URL(client.url);

          if (focusedUrl.origin === sw.location.origin) {
            await client.focus();
            if ("navigate" in client) {
              await client.navigate(targetUrl);
            }
            return;
          }
        }
      }

      await sw.clients.openWindow(targetUrl);
    })(),
  );
}

sw.addEventListener("push", onPush);
sw.addEventListener("notificationclick", onNotificationClick);