import Link from "next/link";
import { headers } from "next/headers";
import { Logo } from "~/components/ui/logo";

import { normalizeRequestHost } from "~/lib/request-host";

export default async function TenantNotFoundPage() {
  const requestHeaders = await headers();
  const host = normalizeRequestHost(requestHeaders);

  return (
    <main className="flex flex-col gap-6 min-h-dvh items-center justify-center px-4 py-8">
      <section className="w-full max-w-lg rounded-4xl border border-border/80 bg-card/90 p-8 text-center shadow-2xl shadow-black/10 backdrop-blur">
        <div className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Tenant unavailable
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance">
            This domain is not mapped to a family
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            {host ? `No family tenant is configured for ${host}.` : "No family tenant is configured for this host."}
          </p>
          <p className="text-sm text-muted-foreground sm:text-base">
            If this is a custom domain or a self-hosted install, verify the domain mapping before trying again.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-border bg-background px-5 py-2 text-sm font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
            >
              Go to home
            </Link>
          </div>
        </div>
      </section>
      <div className="text-center">
        <p className="text-xs text-muted-foreground">Powered by</p>
        <div className="mt-1 inline-flex items-center gap-2 text-foreground">
          <Logo className="h-6 w-auto shrink-0" aria-hidden="true" />
          <p className="font-semibold text-xl leading-none tracking-tight">Fircle</p>
        </div>
      </div>
    </main>
  );
}