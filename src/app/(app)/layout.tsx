import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { MembershipGuard } from "~/components/auth/membership-guard";
import { DesktopSidebar } from "~/components/nav/desktop-sidebar";
import { GlobalComposerProvider } from "~/components/feed/global-composer-provider";
import { MobileBottomNav } from "~/components/nav/mobile-bottom-nav";
import { MobileHeader } from "~/components/nav/mobile-header";
import { PushPermissionRequest } from "~/components/pwa/push-permission-request";
import { env } from "~/env";
import { resolveUnauthenticatedAppRedirect } from "~/lib/bootstrap-routing";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const requestHeaders = await headers();
  const callbackUrl = requestHeaders.get("x-current-path") ?? "/";

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
      <MembershipGuard>
        <PushPermissionRequest />
        <div className="flex min-h-dvh bg-background">
          <DesktopSidebar />
          <div className="flex min-w-0 flex-1 flex-col md:pl-72">
            <MobileHeader />
            <main className="flex-1 overflow-y-auto pb-[calc(4rem+var(--safe-area-inset-bottom))] md:pb-0">
              {children}
            </main>
            <MobileBottomNav currentUser={{ name: session.user.name, image: session.user.image }} />
          </div>
        </div>
      </MembershipGuard>
    </GlobalComposerProvider>
  );
}
