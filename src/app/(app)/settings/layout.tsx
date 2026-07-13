"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { beginNavigationProgress } from "~/components/nav/navigation-progress";
import { LogoutButton } from "~/components/auth/logout-button";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Logout, More } from "~/components/ui/icons";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

const settingsNav = [
  { href: "/settings", label: "Account", adminOnly: false },
  { href: "/settings/notifications", label: "Notifications", adminOnly: false },
  { href: "/settings/family", label: "Family Settings", adminOnly: true },
  { href: "/settings/invites", label: "Invites", adminOnly: true },
  { href: "/settings/roles", label: "Roles", adminOnly: true },
  { href: "/settings/domain", label: "Domain", ownerOnly: true },
  { href: "/settings/integrations", label: "Integrations", ownerOnly: true },
];

const adminOnlySettingsPaths = ["/settings/family", "/settings/invites", "/settings/roles"];
const ownerOnlySettingsPaths = ["/settings/domain", "/settings/integrations"];

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
  const managementContext = api.family.getManagementContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const selectedFamilyId = managementContext.data?.family?.id ?? null;
  const isOwner = managementContext.data?.role === "OWNER";
  const canManageSettings =
    managementContext.data?.role === "OWNER" || managementContext.data?.role === "ADMIN";
  
  const currentPathIsAdminOnly = adminOnlySettingsPaths.some((restrictedPath) =>
    restrictedPath === "/settings"
      ? pathname === "/settings"
      : pathname === restrictedPath || pathname.startsWith(`${restrictedPath}/`),
  );
  
  const currentPathIsOwnerOnly = ownerOnlySettingsPaths.some((restrictedPath) =>
    pathname === restrictedPath || pathname.startsWith(`${restrictedPath}/`),
  );

  useEffect(() => {
    if (
      !managementContext.isLoading &&
      selectedFamilyId &&
      !canManageSettings &&
      currentPathIsAdminOnly
    ) {
      beginNavigationProgress();
      router.replace("/settings");
    }
    
    if (
      !managementContext.isLoading &&
      selectedFamilyId &&
      !isOwner &&
      currentPathIsOwnerOnly
    ) {
      beginNavigationProgress();
      router.replace("/settings");
    }
  }, [
    canManageSettings,
    currentPathIsAdminOnly,
    currentPathIsOwnerOnly,
    isOwner,
    managementContext.isLoading,
    router,
    selectedFamilyId,
  ]);

  const visibleSettingsNav = settingsNav.filter((item) => {
    if (item.adminOnly && !canManageSettings) return false;
    if ("ownerOnly" in item && item.ownerOnly && !isOwner) return false;
    return true;
  });

  const activeSettingsHref =
    visibleSettingsNav.find((item) => isActivePath(pathname, item.href))?.href ??
    visibleSettingsNav[0]?.href ??
    "/settings";
  const activeSettingsLabel =
    visibleSettingsNav.find((item) => item.href === activeSettingsHref)?.label ?? "Settings";

  function navigateToSettings(href: string) {
    if (href === pathname) return;
    beginNavigationProgress();
    router.push(href);
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-semibold text-3xl tracking-tight">Settings</h1>
        <LogoutButton variant="destructive" size="sm" className="gap-2">
          <Logout className="size-4" />
          <span>Log out</span>
        </LogoutButton>
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="text-sm w-full justify-between rounded-xl border bg-card/60 text-foreground"
                aria-label="Settings navigation"
              >
                <span className="truncate">{activeSettingsLabel}</span>
                <More aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) rounded-xl" align="start">
              {visibleSettingsNav.map((item) => {
                const active = item.href === activeSettingsHref;
                return (
                  <DropdownMenuItem
                    key={item.href}
                    className={cn("cursor-pointer", active && "bg-muted text-foreground")}
                    onSelect={() => navigateToSettings(item.href)}
                  >
                    {item.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <nav aria-label="Settings navigation" className="hidden shrink-0 md:block md:w-48">
          <ul className="flex gap-1 rounded-xl border bg-card/60 p-1 md:flex-col">
            {visibleSettingsNav.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <li key={item.href} className="min-w-0 md:flex-none">
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
                    <span className="block truncate">{item.label}</span>
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
