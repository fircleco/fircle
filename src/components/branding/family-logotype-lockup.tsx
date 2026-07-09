"use client";

import { useLogotypeFontStylesheet } from "~/lib/branding/font-loader";
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
  useLogotypeFontStylesheet(fontName);

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
