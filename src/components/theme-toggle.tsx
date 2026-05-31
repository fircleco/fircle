"use client";

import { Moon, Sun } from "~/components/ui/icons";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import type { ComponentProps } from "react";

import { Button } from "~/components/ui/button";

type ThemeToggleProps = ComponentProps<typeof Button>;

export function ThemeToggle({ className, ...props }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="default"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={className}
      {...props}
    >
      {mounted && isDark ? <Sun className="size-6" /> : <Moon className="size-6" />}
      <span>{mounted && isDark ? "Light" : "Dark"}</span>
    </Button>
  );
}
