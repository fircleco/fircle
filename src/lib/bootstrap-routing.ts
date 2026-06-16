type ResolveUnauthenticatedAppRedirectInput = {
  callbackUrl: string;
  isSelfHosted: boolean;
  hasExistingFamily: boolean;
};

export function resolveUnauthenticatedAppRedirect({
  callbackUrl,
  isSelfHosted,
  hasExistingFamily,
}: ResolveUnauthenticatedAppRedirectInput): string {
  if (isSelfHosted && !hasExistingFamily) {
    return "/auth/setup";
  }

  const next = new URLSearchParams();
  next.set("callbackUrl", callbackUrl);
  return `/auth/signin?${next.toString()}`;
}
