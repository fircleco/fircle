import { NextResponse, type NextRequest } from "next/server";
import { normalizeRequestHost } from "~/lib/request-host";

export function middleware(request: NextRequest) {
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
