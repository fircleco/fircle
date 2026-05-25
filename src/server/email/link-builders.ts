export function buildInvitePath(inviteCode: string): string {
  return `/auth/invite/${encodeURIComponent(inviteCode)}`;
}

export function buildClaimPath(claimToken: string): string {
  return `/auth/claim/${encodeURIComponent(claimToken)}`;
}

export function buildInviteUrl(appBaseUrl: string, inviteCode: string): string {
  return buildAppUrl(appBaseUrl, buildInvitePath(inviteCode));
}

export function buildClaimUrl(appBaseUrl: string, claimToken: string): string {
  return buildAppUrl(appBaseUrl, buildClaimPath(claimToken));
}

export function buildAppUrl(appBaseUrl: string, path: string): string {
  const base = normalizeBaseUrl(appBaseUrl);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  const url = new URL(trimmed);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("appBaseUrl must use http or https protocol.");
  }

  return url.origin;
}
