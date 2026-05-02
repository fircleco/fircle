import { DesktopSidebar } from "~/components/nav/desktop-sidebar";
import { MobileBottomNav } from "~/components/nav/mobile-bottom-nav";
import { MobileHeader } from "~/components/nav/mobile-header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <DesktopSidebar />
      <div className="flex min-w-0 flex-1 flex-col md:pl-16">
        <MobileHeader />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
        <MobileBottomNav />
      </div>
    </div>
  );
}