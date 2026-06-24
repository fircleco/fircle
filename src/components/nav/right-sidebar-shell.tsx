import Link from "next/link";

const baseSections = [
  {
    title: "Quick Access",
    items: [
      {
        label: "Family Settings",
        href: "/settings/family",
        description: "Manage family profile details and preferences.",
      },
      {
        label: "Invites",
        href: "/settings/invites",
        description: "Review invite links and pending invite access.",
      },
      {
        label: "Members",
        href: "/members",
        description: "Browse member profiles and identities.",
      },
    ],
  },
  {
    title: "Helpful Pages",
    items: [
      {
        label: "Notifications",
        href: "/notifications",
        description: "Catch up on recent mentions and activity.",
      },
      {
        label: "Gallery",
        href: "/gallery",
        description: "View photos and videos shared by your family.",
      },
    ],
  },
] as const;

// Optional content slots intentionally remain manual and empty for now.
const optionalItems: Array<{ label: string; href: string; description?: string }> = [];

export function RightSidebarShell() {
  return (
    <aside
      aria-label="Right sidebar"
      className="hidden border-border xl:flex xl:w-80 xl:shrink-0 xl:flex-col xl:border-l"
    >
      <div className="h-full overflow-y-auto p-4">
        <div className="space-y-4">
          {baseSections.map((section) => (
            <section key={section.title} className="rounded-2xl border border-border bg-card/60 p-4">
              <h2 className="mb-3 font-semibold text-sm tracking-wide text-muted-foreground uppercase">
                {section.title}
              </h2>

              <ul className="space-y-3">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block rounded-xl border border-transparent p-2 transition-colors hover:border-border hover:bg-muted/50"
                    >
                      <p className="font-medium text-sm text-foreground">{item.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="rounded-2xl border border-dashed border-border bg-card/40 p-4">
            <h2 className="mb-2 font-semibold text-sm tracking-wide text-muted-foreground uppercase">
              More for You
            </h2>

            {optionalItems.length > 0 ? (
              <ul className="space-y-3">
                {optionalItems.map((item) => (
                  <li key={`${item.href}:${item.label}`}>
                    <Link
                      href={item.href}
                      className="block rounded-xl border border-transparent p-2 transition-colors hover:border-border hover:bg-muted/50"
                    >
                      <p className="font-medium text-sm text-foreground">{item.label}</p>
                      {item.description ? (
                        <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                No optional sidebar items are available yet.
              </p>
            )}
          </section>
        </div>
      </div>
    </aside>
  );
}
