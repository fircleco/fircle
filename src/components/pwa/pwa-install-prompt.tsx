"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

import { Button } from "~/components/ui/button";
import { ArrowRight, X } from "~/components/ui/icons";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

const DISMISS_STORAGE_KEY = "fircle:pwa-install-dismissed";

function isStandaloneMode() {
  if (typeof window === "undefined") {
    return false;
  }

  const mediaQuery = window.matchMedia("(display-mode: standalone)").matches;
  const navigatorStandalone =
    typeof navigator !== "undefined" &&
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

  return mediaQuery || navigatorStandalone;
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const isDismissed = useMemo(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return window.localStorage.getItem(DISMISS_STORAGE_KEY) === "1";
  }, []);

  useEffect(() => {
    if (isStandaloneMode() || isDismissed) {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setIsOpen(true);
    };

    const handleAppInstalled = () => {
      setInstallEvent(null);
      setIsOpen(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [isDismissed]);

  function handleDismiss() {
    setIsOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, "1");
    }
  }

  async function handleInstall() {
    if (!installEvent) {
      return;
    }

    setIsInstalling(true);

    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;

      if (choice.outcome === "accepted") {
        setIsOpen(false);
      }

      setInstallEvent(null);
    } catch (error) {
      console.error("PWA install prompt failed", error);
    } finally {
      setIsInstalling(false);
    }
  }

  if (!isOpen || !installEvent) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border bg-card p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border bg-muted/40 p-1">
            <Image
              src="/icon.png"
              alt="Fircle logo"
              width={30}
              height={30}
              className="rounded-xl"
              priority
            />
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium text-sm">Install Fircle app</p>
            <p className="text-muted-foreground text-xs">
              Install to your home screen for faster access and better push notification reliability.
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleDismiss}>
            Not now
          </Button>
          <Button type="button" onClick={() => void handleInstall()} disabled={isInstalling}>
            {isInstalling ? "Installing..." : "Install app"}
            {!isInstalling ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
          </Button>
        </div>
      </div>
    </div>
  );
}
