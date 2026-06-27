"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Image, PlusCircle, Sparkles, User, Users } from "~/components/ui/icons";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { useGlobalComposer } from "~/components/feed/global-composer-provider";
import { getFeatureNavigationMetadata } from "~/lib/ffeatures/activation";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

type MobileNavItem = {
  href: string;
  label: string;
  icon: typeof House;
  prominent?: boolean;
  action?: "composer";
};

const baseItems: MobileNavItem[] = [
  { href: "/", label: "Feed", icon: House },
  { href: "/members", label: "Members", icon: Users },
  { href: "#", label: "Create", icon: PlusCircle, prominent: true, action: "composer" },
  { href: "/gallery", label: "Gallery", icon: Image },
  { href: "/profile", label: "Profile", icon: User },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  if (href === "/members" && pathname.startsWith("/member/")) {
    return true;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

type MobileBottomNavProps = {
  currentUser?: {
    name?: string | null;
    image?: string | null;
  };
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function MobileBottomNav({ currentUser }: MobileBottomNavProps) {
  const pathname = usePathname();
  const { openComposer } = useGlobalComposer();

  const managementContext = api.invite.getManagementContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const familyId = managementContext.data?.family?.id;
  const memberQuery = api.familyMember.getCurrentUserMemberProfile.useQuery(
    { familyId: familyId ?? "" },
    { enabled: Boolean(familyId), retry: false, refetchOnWindowFocus: false },
  );

  const featureActivationQuery = api.ffeatures.listActivations.useQuery(
    {
      familyId: familyId ?? "",
    },
    {
      enabled: Boolean(familyId),
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const items = useMemo(() => {
    const staticItems: MobileNavItem[] = [...baseItems];
    const createIndex = staticItems.findIndex((entry) => entry.action === "composer");
    const featureItems = getFeatureNavigationMetadata(
      featureActivationQuery.data?.activations ?? [],
    ).map<MobileNavItem>((featureNav) => ({
      href: featureNav.href,
      label: featureNav.label,
      icon: Sparkles,
    }));

    if (createIndex === -1) {
      return [...staticItems, ...featureItems];
    }

    return [
      ...staticItems.slice(0, createIndex),
      ...featureItems,
      ...staticItems.slice(createIndex),
    ];
  }, [featureActivationQuery.data?.activations]);

  const profileName = memberQuery.data?.name ?? currentUser?.name ?? undefined;
  const profileImage = memberQuery.data?.image ?? currentUser?.image ?? undefined;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-safe md:hidden">
      <ul className="mx-auto flex h-[calc(3.5rem+var(--safe-area-inset-bottom))] max-w-screen-sm items-center justify-around px-2 pb-safe">
        {items.map((item) => {
          const active = item.action === "composer" ? false : isActivePath(pathname, item.href);
          const Icon = item.icon;

          return (
            <li key={item.href} className="flex-1">
              {item.action === "composer" ? (
                <button
                  type="button"
                  title={item.label}
                  aria-label={item.label}
                  onClick={() => openComposer()}
                  className={cn(
                    "flex w-full flex-col items-center justify-center gap-0.5 py-1 text-xs font-medium",
                    "text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center rounded-full transition-colors",
                      item.prominent ? "size-9 bg-primary text-primary-foreground" : "size-8"
                    )}
                  >
                    <Icon className={cn(item.prominent ? "size-7" : "size-6")} />
                  </span>
                </button>
              ) : (
                <Link
                  href={item.href}
                  title={item.label}
                  className={cn(
                    "flex w-full flex-col items-center justify-center gap-0.5 py-1 text-xs font-medium",
                    active ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center rounded-full transition-colors",
                      item.prominent ? "size-9 bg-primary text-primary-foreground" : "size-8"
                    )}
                  >
                    {item.href === "/profile" ? (
                      <Avatar
                        className={cn(
                          "size-7",
                          active ? "ring-2 ring-foreground" : "ring-2 ring-transparent",
                        )}
                      >
                        {profileImage ? (
                          <AvatarImage src={profileImage} alt={profileName ?? "Your profile"} />
                        ) : null}
                        <AvatarFallback className="text-[10px] font-semibold">
                          {profileName ? getInitials(profileName) : <User className="size-4" />}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <Icon className={cn(item.prominent ? "size-7" : "size-6")} />
                    )}
                  </span>
                  {active && item.href !== "/profile" ? (
                    <span className="-mt-1 size-1 rounded-full bg-foreground" aria-hidden="true" />
                  ) : null}
                  {/* <span>{item.label}</span> */}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
