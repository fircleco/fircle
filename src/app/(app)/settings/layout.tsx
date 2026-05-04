"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "~/lib/utils";

const settingsNav = [
  { href: "/settings", label: "Family Settings" },
  { href: "/settings/invites", label: "Invites" },
  { href: "/settings/roles", label: "Roles" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/settings") {
    return pathname === "/settings";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 font-semibold text-2xl tracking-tight">Settings</h1>

      <div className="flex flex-col gap-6 md:flex-row">
        {/* Settings side nav — desktop */}
        <nav
          aria-label="Settings navigation"
          className="shrink-0 md:w-52"
        >
          {/* Mobile: horizontal tab strip */}
          <ul className="flex gap-1 overflow-x-auto rounded-xl border bg-card/60 p-1 md:flex-col md:overflow-x-visible">
            {settingsNav.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <li key={item.href} className="flex-1 md:flex-none">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    {item.label}
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
