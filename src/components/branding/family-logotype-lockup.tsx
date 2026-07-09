"use client";

import { useEffect } from "react";

import { buildLogotypeFontStylesheetUrl } from "~/lib/branding/logotype-fonts";
import { cn } from "~/lib/utils";

type FamilyLogotypeLockupProps = {
  familyName: string;
  fontName: string;
  className?: string;
  familyNameClassName?: string;
  leadingClassName?: string;
  trailingClassName?: string;
};

export function FamilyLogotypeLockup({
  familyName,
  fontName,
  className,
  familyNameClassName,
  leadingClassName,
  trailingClassName,
}: FamilyLogotypeLockupProps) {
  const stylesheetUrl = buildLogotypeFontStylesheetUrl(fontName);

  useEffect(() => {
    if (!document.head.querySelector("link[data-logotype-font-preconnect='1']")) {
      const preconnectLink = document.createElement("link");
      preconnectLink.rel = "preconnect";
      preconnectLink.href = "https://api.fonts.coollabs.io";
      preconnectLink.crossOrigin = "anonymous";
      preconnectLink.dataset.logotypeFontPreconnect = "1";
      document.head.appendChild(preconnectLink);
    }

    if (
      document.head.querySelector(
        `link[data-logotype-font-stylesheet='1'][href='${stylesheetUrl}']`,
      )
    ) {
      return;
    }

    const stylesheetLink = document.createElement("link");
    stylesheetLink.rel = "stylesheet";
    stylesheetLink.href = stylesheetUrl;
    stylesheetLink.dataset.logotypeFontStylesheet = "1";
    document.head.appendChild(stylesheetLink);
  }, [stylesheetUrl]);

  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center px-6 text-foreground leading-none",
        className,
      )}
    >
      <span
        className={cn(
          "font-medium pointer-events-none absolute left-0 top-1/2 -translate-x-[28%] -translate-y-[98%] logo-parts-stroke text-base leading-none",
          leadingClassName,
        )}
      >
        The
      </span>
      <span
        className={cn("text-7xl leading-none", familyNameClassName)}
        style={{ fontFamily: `\"${fontName}\", cursive` }}
      >
        {familyName}
      </span>
      <span
        className={cn(
          "font-medium pointer-events-none absolute right-0 top-1/2 translate-x-[-2%] translate-y-[95%] logo-parts-stroke text-base leading-none",
          trailingClassName,
        )}
      >
        Fircle
      </span>
    </span>
  );
}
