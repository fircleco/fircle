"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { LogoutButton } from "~/components/auth/logout-button";
import { Logout } from "~/components/ui/icons";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

const settingsNav = [
  { href: "/settings", label: "Account", adminOnly: false },
  { href: "/settings/family", label: "Family Settings", adminOnly: true },
  { href: "/settings/invites", label: "Invites", adminOnly: true },
  { href: "/settings/roles", label: "Roles", adminOnly: true },
];

const adminOnlySettingsPaths = ["/settings/family", "/settings/invites", "/settings/roles"];

function isActivePath(pathname: string, href: string) {
  if (href === "/settings") {
    return pathname === "/settings" || pathname === "/settings/account" || pathname.startsWith("/settings/account/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const managementContext = api.invite.getManagementContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const selectedFamilyId = managementContext.data?.family?.id ?? null;
  const canManageSettings =
    managementContext.data?.role === "OWNER" || managementContext.data?.role === "ADMIN";
  const currentPathIsAdminOnly = adminOnlySettingsPaths.some((restrictedPath) =>
    restrictedPath === "/settings"
      ? pathname === "/settings"
      : pathname === restrictedPath || pathname.startsWith(`${restrictedPath}/`),
  );

  useEffect(() => {
    if (
      !managementContext.isLoading &&
      selectedFamilyId &&
      !canManageSettings &&
      currentPathIsAdminOnly
    ) {
      router.replace("/settings");
    }
  }, [
    canManageSettings,
    currentPathIsAdminOnly,
    managementContext.isLoading,
    router,
    selectedFamilyId,
  ]);

  const visibleSettingsNav = settingsNav.filter((item) => !item.adminOnly || canManageSettings);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-semibold text-2xl tracking-tight">Settings</h1>
        <LogoutButton variant="outline" size="sm" className="gap-2">
          <Logout className="size-4" />
          <span>Log out</span>
        </LogoutButton>
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        {/* Settings side nav — desktop */}
        <nav
          aria-label="Settings navigation"
          className="shrink-0 md:w-52"
        >
          {/* Mobile: horizontal tab strip */}
          <ul className="flex gap-1 overflow-x-auto rounded-xl border bg-card/60 p-1 md:flex-col md:overflow-x-visible">
            {visibleSettingsNav.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <li key={item.href} className="min-w-0 flex-1 md:flex-none">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block min-w-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <span className="block truncate whitespace-nowrap">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Content area */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
