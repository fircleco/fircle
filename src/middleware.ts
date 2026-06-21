import { NextResponse, type NextRequest } from "next/server";
import { normalizeRequestHost, sanitizeHostInput } from "~/lib/request-host";

export function middleware(request: NextRequest) {
  // Reject requests whose host header contains control characters or whitespace
  // before any routing or resolution occurs (host-header injection guard).
  const rawHost = (
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? ""
  ).split(",")[0]?.trim() ?? "";

  if (rawHost && !sanitizeHostInput(rawHost)) {
    return new NextResponse(null, { status: 400 });
  }

  const requestHeaders = new Headers(request.headers);
  const callbackPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const requestHost = normalizeRequestHost(request.headers);

  requestHeaders.set("x-current-path", callbackPath);

  if (requestHost) {
    requestHeaders.set("x-request-host", requestHost);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
