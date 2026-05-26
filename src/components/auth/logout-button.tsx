"use client";

import { useCallback, useState } from "react";
import { signOut } from "next-auth/react";

import { Button } from "~/components/ui/button";

type UseLogoutActionOptions = {
  callbackUrl?: string;
};

export function useLogoutAction(options?: UseLogoutActionOptions) {
  const callbackUrl = options?.callbackUrl ?? "/auth/signin";
  const [isSigningOut, setIsSigningOut] = useState(false);

  const logout = useCallback(async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    try {
      await signOut({ callbackUrl });
    } catch {
      setIsSigningOut(false);
    }
  }, [callbackUrl, isSigningOut]);

  return { logout, isSigningOut };
}

type LogoutButtonProps = React.ComponentProps<typeof Button> & {
  callbackUrl?: string;
  pendingLabel?: string;
};

export function LogoutButton({
  callbackUrl,
  pendingLabel = "Logging out...",
  children,
  disabled,
  onClick,
  ...props
}: LogoutButtonProps) {
  const { logout, isSigningOut } = useLogoutAction({ callbackUrl });
  const isDisabled = disabled === true || isSigningOut;

  return (
    <Button
      type="button"
      disabled={isDisabled}
      onClick={async (event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        await logout();
      }}
      {...props}
    >
      {isSigningOut ? pendingLabel : children}
    </Button>
  );
}