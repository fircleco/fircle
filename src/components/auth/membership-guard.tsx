"use client";

import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
import { Loader } from "~/components/ui/icons";

import { api } from "~/trpc/react";

export function MembershipGuard({ children }: { children: React.ReactNode }) {
  const signOutTriggered = useRef(false);

  const managementContext = api.invite.getManagementContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

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
        <div className="flex-1 flex items-center justify-center">
          <Loader className="size-6 animate-spin" />
        </div>
        <div className="items-end pb-6">
          <span className="text-xs text-muted-foreground">Powered by</span>
          <p className="font-semibold text-xl leading-none tracking-tight">Fircle</p>
        </div>
      </div>
    );
  }

  return children;
}