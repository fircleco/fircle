"use client";

import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { AlertCircle, Bell, Loader, ShieldAlert } from "~/components/ui/icons";
import {
  getCurrentBrowserPushSubscription,
  getNotificationPermissionState,
  isBrowserPushSupported,
  subscribeBrowserPush,
  unsubscribeBrowserPush,
} from "~/lib/push-subscription";
import { api, type RouterOutputs } from "~/trpc/react";

type PushPreferenceItem =
  RouterOutputs["notification"]["getPushInteractionPreferences"]["preferences"][number];

export default function NotificationSettingsPage() {
  const trpcUtils = api.useUtils();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const managementContext = api.invite.getManagementContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const familyId = managementContext.data?.family?.id;

  const pushStateQuery = api.notification.getPushSubscriptionState.useQuery(
    { familyId: familyId ?? "" },
    {
      enabled: Boolean(familyId),
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const preferencesQuery = api.notification.getPushInteractionPreferences.useQuery(
    { familyId: familyId ?? "" },
    {
      enabled: Boolean(familyId),
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const subscribePushMutation = api.notification.subscribePush.useMutation();
  const unsubscribePushMutation = api.notification.unsubscribePush.useMutation();
  const updatePreferencesMutation = api.notification.updatePushInteractionPreferences.useMutation();

  const capability = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        canPush: false,
        permission: "unsupported" as const,
      };
    }

    return {
      canPush: isBrowserPushSupported(),
      permission: getNotificationPermissionState(),
    };
  }, []);

  const isLoading =
    managementContext.isLoading ||
    (Boolean(familyId) && (pushStateQuery.isLoading || preferencesQuery.isLoading));

  const preferences: PushPreferenceItem[] = preferencesQuery.data?.preferences ?? [];
  const subscriptions = pushStateQuery.data?.subscriptions ?? [];

  const isSubscribing = subscribePushMutation.isPending;
  const isUnsubscribing = unsubscribePushMutation.isPending;
  const isUpdatingPreference = updatePreferencesMutation.isPending;

  async function refreshPushData() {
    await Promise.all([
      trpcUtils.notification.getPushSubscriptionState.invalidate(),
      trpcUtils.notification.getPushInteractionPreferences.invalidate(),
    ]);
  }

  async function handleEnablePush() {
    if (!familyId) {
      return;
    }

    setActionError(null);
    setActionSuccess(null);

    if (!capability.canPush) {
      setActionError("This browser does not support push notifications.");
      return;
    }

    if (!pushStateQuery.data?.isPushConfigured) {
      setActionError("Push notifications are not configured on the server.");
      return;
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      setActionError("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY in runtime configuration.");
      return;
    }

    let permission = getNotificationPermissionState();
    if (permission === "unsupported") {
      setActionError("Notifications are not supported by this browser.");
      return;
    }

    if (permission !== "granted") {
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
      setActionError(
        "Notification permission is denied. Enable notifications in browser settings and try again.",
      );
      return;
    }

    try {
      const payload = await subscribeBrowserPush(vapidPublicKey);
      await subscribePushMutation.mutateAsync({
        familyId,
        subscriptionPayload: payload,
      });
      await refreshPushData();
      setActionSuccess("Push notifications enabled for this browser.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to enable push notifications.");
    }
  }

  async function handleDisablePush() {
    if (!familyId) {
      return;
    }

    setActionError(null);
    setActionSuccess(null);

    try {
      const currentSubscription = await getCurrentBrowserPushSubscription();
      if (currentSubscription) {
        await unsubscribePushMutation.mutateAsync({
          familyId,
          endpoint: currentSubscription.endpoint,
        });
        await unsubscribeBrowserPush(currentSubscription.endpoint);
      } else {
        for (const subscription of subscriptions) {
          await unsubscribePushMutation.mutateAsync({
            familyId,
            endpoint: subscription.endpoint,
          });
        }
      }

      await refreshPushData();
      setActionSuccess("Push notifications disabled for this browser.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to disable push notifications.");
    }
  }

  async function handleTogglePreference(
    eventType: PushPreferenceItem["eventType"],
    nextValue: boolean,
  ) {
    if (!familyId) {
      return;
    }

    setActionError(null);
    setActionSuccess(null);

    try {
      await updatePreferencesMutation.mutateAsync({
        familyId,
        preferences: [{ eventType, isEnabled: nextValue }],
      });
      await refreshPushData();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to update push preference.");
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h2 className="font-semibold text-xl tracking-tight">Notification Settings</h2>
        <p className="text-muted-foreground text-sm">
          Manage browser push permissions and choose which interactions send push alerts.
        </p>
      </header>

      {managementContext.isLoading ? (
        <NotificationSettingsSkeleton />
      ) : null}

      {!managementContext.isLoading && !familyId ? (
        <Alert>
          <AlertCircle className="size-5" aria-hidden="true" />
          <AlertTitle>No active family found</AlertTitle>
          <AlertDescription>Join a family before managing notification settings.</AlertDescription>
        </Alert>
      ) : null}

      {familyId && (
        <section className="space-y-4 rounded-2xl border bg-card/60 p-5">
          <h3 className="font-medium text-base">Browser Push Status</h3>

          {capability.canPush ? (
            <div className="space-y-1 text-sm">
              <p>
                Permission status:{" "}
                <span className="font-medium capitalize">{capability.permission}</span>
              </p>
              <p>
                Active subscriptions:{" "}
                <span className="font-medium">{subscriptions.length}</span>
              </p>
            </div>
          ) : (
            <Alert>
              <ShieldAlert className="size-5" aria-hidden="true" />
              <AlertTitle>Push unavailable</AlertTitle>
              <AlertDescription>
                This browser does not support Notification, Service Worker, and PushManager APIs together.
              </AlertDescription>
            </Alert>
          )}

          {capability.permission === "denied" ? (
            <Alert>
              <ShieldAlert className="size-5" aria-hidden="true" />
              <AlertTitle>Permission denied</AlertTitle>
              <AlertDescription>
                Notifications are blocked for this site. Use browser site settings to re-enable notifications,
                then click Enable push.
              </AlertDescription>
            </Alert>
          ) : null}

          {actionError ? (
            <Alert>
              <AlertCircle className="size-5" aria-hidden="true" />
              <AlertTitle>Action failed</AlertTitle>
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          ) : null}

          {actionSuccess ? (
            <Alert>
              <Bell className="size-5" aria-hidden="true" />
              <AlertTitle>Updated</AlertTitle>
              <AlertDescription>{actionSuccess}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void handleEnablePush()}
              disabled={!capability.canPush || isSubscribing || isUnsubscribing || isLoading}
            >
              {isSubscribing ? (
                <>
                  <Loader className="mr-2 size-4 animate-spin" />
                  Enabling...
                </>
              ) : (
                "Enable Push"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleDisablePush()}
              disabled={!capability.canPush || isSubscribing || isUnsubscribing || isLoading}
            >
              {isUnsubscribing ? (
                <>
                  <Loader className="mr-2 size-4 animate-spin" />
                  Disabling...
                </>
              ) : (
                "Disable Push"
              )}
            </Button>
          </div>
        </section>
      )}

      {familyId ? (
        <section className="space-y-4 rounded-2xl border bg-card/60 p-5">
          <h3 className="font-medium text-base">Push Interaction Preferences</h3>
          <p className="text-muted-foreground text-sm">
            Choose which interaction types trigger push delivery. If no preference exists yet, it defaults to enabled.
          </p>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="space-y-2">
              {preferences.map((preference) => (
                <label
                  key={preference.eventType}
                  className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
                >
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">{preference.label}</p>
                    <p className="text-muted-foreground text-xs">{preference.category}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preference.isEnabled}
                    disabled={isUpdatingPreference || isLoading}
                    onChange={(event) =>
                      void handleTogglePreference(preference.eventType, event.currentTarget.checked)
                    }
                    className="size-4 accent-primary"
                  />
                </label>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

function NotificationSettingsSkeleton() {
  return (
    <section className="space-y-4 rounded-2xl border bg-card/70 p-5">
      <Skeleton className="h-4 w-44" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-56" />
    </section>
  );
}
