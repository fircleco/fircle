import { env } from "~/env";

export function resolveAppBaseUrlFromHeaders(headers: Headers): string | null {
  const origin = normalizeHttpUrl(headers.get("origin"));
  if (origin) {
    return origin;
  }

  const forwardedHost = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!forwardedHost) {
    return null;
  }

  const forwardedProto = headers.get("x-forwarded-proto");
  const protocol =
    forwardedProto === "https" || forwardedProto === "http"
      ? forwardedProto
      : env.NODE_ENV === "production"
        ? "https"
        : "http";

  return `${protocol}://${forwardedHost}`;
}

function normalizeHttpUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
}
