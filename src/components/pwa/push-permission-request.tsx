"use client";

import { useEffect } from "react";

import {
  getNotificationPermissionState,
  isBrowserPushSupported,
} from "~/lib/push-subscription";

/**
 * Silently requests notification permission once per browser session after the
 * user has logged in. Must be mounted inside the authenticated app shell so it
 * only fires for signed-in users.
 *
 * Rules:
 * - Only fires if push is supported (Notification + SW + PushManager).
 * - Only fires when the current permission state is "default" (not yet decided).
 * - Does not attempt a subscription — it only asks for permission so the user is
 *   ready to subscribe from the notification settings page.
 * - Uses a short delay so the initial page render completes first.
 * - Will not re-fire during the same session because the browser only asks once
 *   and then moves the state to "granted" or "denied".
 */
export function PushPermissionRequest() {
  useEffect(() => {
    if (!isBrowserPushSupported()) {
      return;
    }

    if (getNotificationPermissionState() !== "default") {
      return;
    }

    const timer = setTimeout(() => {
      if (getNotificationPermissionState() !== "default") {
        return;
      }

      void Notification.requestPermission();
    }, 3000);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return null;
}
