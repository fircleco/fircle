import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SignInForm } from "~/components/auth/signin-form";
import { buildAbsoluteUrl } from "~/lib/request-host";
import { resolveTenantFromHeaders } from "~/lib/tenant-resolution";

export default async function SignInPage() {
  const requestHeaders = await headers();
  const resolution = await resolveTenantFromHeaders(requestHeaders);
  const currentPath = requestHeaders.get("x-current-path") ?? "/auth/signin";

  if (resolution.state === "bootstrap-required") {
    redirect("/auth/setup");
  }

  if (resolution.state === "not-found" || resolution.state === "ambiguous") {
    redirect("/tenant-not-found");
  }

  if (resolution.canonicalHost !== resolution.host) {
    redirect(buildAbsoluteUrl(requestHeaders, resolution.canonicalHost, currentPath));
  }

  return <SignInForm />;
}
