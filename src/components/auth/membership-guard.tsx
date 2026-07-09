"use client";

import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
import { FamilyLogotypeLockup } from "~/components/branding/family-logotype-lockup";
import { Loader } from "~/components/ui/icons";
import { Logo } from "~/components/ui/logo";
import { tryParseBrandingConfig } from "~/lib/branding/branding-config";
import { normalizeFamilyNameInput } from "~/lib/family-name";

import { api } from "~/trpc/react";

export function MembershipGuard({
  children,
  primaryLockup,
}: {
  children: React.ReactNode;
  primaryLockup: string;
}) {
  const signOutTriggered = useRef(false);

  const managementContext = api.invite.getManagementContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const parsedBrandingConfig = tryParseBrandingConfig(managementContext.data?.family?.brandingConfig ?? null);
  const selectedLogotypeFontName =
    parsedBrandingConfig?.logotype.enabled ? (parsedBrandingConfig.logotype.fontName ?? null) : null;
  const selectedFamilyName = normalizeFamilyNameInput(managementContext.data?.family?.name ?? "") || "Family";

  const hasFamilyMembership = Boolean(managementContext.data?.family?.id);

  useEffect(() => {
    if (!managementContext.isFetched || hasFamilyMembership || signOutTriggered.current) {
      return;
    }

    signOutTriggered.current = true;
    void signOut({ callbackUrl: "/auth/signin" });
  }, [hasFamilyMembership, managementContext.isFetched]);

  if (managementContext.isLoading || (!hasFamilyMembership && !signOutTriggered.current)) {
    return (
      <div className="flex flex-col min-h-dvh items-center px-4 text-center text-foreground text-sm">
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          {selectedLogotypeFontName ? (
            <FamilyLogotypeLockup
              familyName={selectedFamilyName}
              fontName={selectedLogotypeFontName}
              familyNameClassName="text-4xl"
              leadingClassName="text-xs"
              trailingClassName="text-xs"
            />
          ) : (
            <p className="font-semibold text-base leading-none tracking-tight">{primaryLockup}</p>
          )}
          <Loader className="size-6 animate-spin" />
        </div>
        <div className="items-end pb-6">
          <span className="text-xs text-muted-foreground">Powered by</span>
          <div className="mt-1 flex items-center justify-center gap-2 text-foreground">
            <Logo className="h-6 w-auto shrink-0" aria-hidden="true" />
            <p className="font-semibold text-xl leading-none tracking-tight">Fircle</p>
          </div>
        </div>
      </div>
    );
  }

  return children;
}