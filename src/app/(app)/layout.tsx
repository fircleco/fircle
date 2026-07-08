import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { MembershipGuard } from "~/components/auth/membership-guard";
import { DesktopSidebar } from "~/components/nav/desktop-sidebar";
import { GlobalComposerProvider } from "~/components/feed/global-composer-provider";
import { MobileBottomNav } from "~/components/nav/mobile-bottom-nav";
import { MobileHeader } from "~/components/nav/mobile-header";
import { RightSidebarShell } from "~/components/nav/right-sidebar-shell";
import { PushPermissionRequest } from "~/components/pwa/push-permission-request";
import { env } from "~/env";
import { resolveBrandContextFromTenantResolution } from "~/lib/brand-context";
import { resolveUnauthenticatedAppRedirect } from "~/lib/bootstrap-routing";
import { buildAbsoluteUrl } from "~/lib/request-host";
import { resolveTenantFromHeaders } from "~/lib/tenant-resolution";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const callbackUrl = requestHeaders.get("x-current-path") ?? "/";
  const resolution = await resolveTenantFromHeaders(requestHeaders);

  if (resolution.state === "bootstrap-required") {
    redirect("/auth/setup");
  }

  if (resolution.state === "not-found" || resolution.state === "ambiguous") {
    redirect("/tenant-not-found");
  }

  if (resolution.canonicalHost !== resolution.host) {
    redirect(buildAbsoluteUrl(requestHeaders, resolution.canonicalHost, callbackUrl));
  }

  const brandContext = resolveBrandContextFromTenantResolution(resolution);

  const session = await auth();

  if (!session?.user) {
    const hasExistingFamily = env.SELF_HOSTED
      ? Boolean(
          await db.family.findFirst({
            select: { id: true },
          }),
        )
      : true;

    redirect(
      resolveUnauthenticatedAppRedirect({
        callbackUrl,
        isSelfHosted: env.SELF_HOSTED,
        hasExistingFamily,
      }),
    );
  }

  return (
    <GlobalComposerProvider>
      <MembershipGuard primaryLockup={brandContext.primaryLockup}>
        <PushPermissionRequest />
        <div className="flex min-h-dvh bg-background">
          <DesktopSidebar primaryLockup={brandContext.primaryLockup} />
          <div className="flex min-w-0 flex-1 flex-col md:pl-72">
            <MobileHeader primaryLockup={brandContext.primaryLockup} />
            <div className="flex min-h-0 flex-1">
              <main className="min-w-0 flex-1 overflow-y-auto pb-[calc(4rem+var(--safe-area-inset-bottom))] md:pb-0">
                {children}
              </main>
              <RightSidebarShell />
            </div>
            <MobileBottomNav currentUser={{ name: session.user.name, image: session.user.image }} />
          </div>
        </div>
      </MembershipGuard>
    </GlobalComposerProvider>
  );
}
