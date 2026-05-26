import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { MembershipGuard } from "~/components/auth/membership-guard";
import { DesktopSidebar } from "~/components/nav/desktop-sidebar";
import { GlobalComposerProvider } from "~/components/feed/global-composer-provider";
import { MobileBottomNav } from "~/components/nav/mobile-bottom-nav";
import { MobileHeader } from "~/components/nav/mobile-header";
import { auth } from "~/server/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const requestHeaders = await headers();
  const callbackUrl = requestHeaders.get("x-current-path") ?? "/";

  if (!session?.user) {
    const next = new URLSearchParams();
    next.set("callbackUrl", callbackUrl);
    redirect(`/auth/signin?${next.toString()}`);
  }

  return (
    <GlobalComposerProvider>
      <MembershipGuard>
        <div className="flex min-h-screen">
          <DesktopSidebar />
          <div className="flex min-w-0 flex-1 flex-col md:pl-72">
            <MobileHeader />
            <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
            <MobileBottomNav />
          </div>
        </div>
      </MembershipGuard>
    </GlobalComposerProvider>
  );
}
