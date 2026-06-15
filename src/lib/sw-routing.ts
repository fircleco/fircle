export const DEFAULT_NOTIFICATION_URL = "/notifications";

export type ServiceWorkerPushPayload = {
  title?: string;
  body?: string;
  url?: string;
  targetUrl?: string;
  data?: {
    url?: string;
    targetUrl?: string;
  };
};

export function getPayloadTargetUrl(payload: ServiceWorkerPushPayload): string {
  return (
    payload.url ??
    payload.targetUrl ??
    payload.data?.url ??
    payload.data?.targetUrl ??
    DEFAULT_NOTIFICATION_URL
  );
}

export function toAbsoluteSameOriginUrl(
  targetUrl: string,
  origin: string,
  fallbackPath: string = DEFAULT_NOTIFICATION_URL,
): string {
  try {
    const parsedUrl = new URL(targetUrl, origin);
    if (parsedUrl.origin !== origin) {
      return new URL(fallbackPath, origin).toString();
    }

    return parsedUrl.toString();
  } catch {
    return new URL(fallbackPath, origin).toString();
  }
}

export function resolveOfflineNavigationFallback(
  cachedNavigation: Response | undefined,
  shellFallback: Response | undefined,
): Response | undefined {
  return cachedNavigation ?? shellFallback;
}