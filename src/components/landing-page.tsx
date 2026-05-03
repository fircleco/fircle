import Link from "next/link";

import { ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";

export function LandingPage() {
  return (
    <main className="relative isolate w-full max-w-md">
      <div className="fixed right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <section className="w-full rounded-4xl border border-border/80 bg-card/90 p-7 shadow-2xl shadow-black/10 backdrop-blur sm:p-9">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start">
              <div className="inline-flex items-center rounded-full border border-border/80 bg-muted px-3 py-1 text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
                Invite-only family circle
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Fircle
              </h1>
              <p className="text-base text-muted-foreground sm:text-lg">
                Family memories, privately shared.
              </p>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              Fircle is a private social network for families. Membership is by
              invite only, so the people inside your circle stay the people you
              trust.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:flex-1">
              <Link href="/auth/signin">Sign In</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="w-full rounded-4xl border border-border/80 bg-muted/40 sm:flex-1 sm:border-transparent sm:bg-transparent"
            >
              <Link href="/auth/invite/example-family-code">I have an invite</Link>
            </Button>
          </div>

          <div className="rounded-3xl border border-border/70 bg-muted/50 px-5 py-4">
            <p className="text-sm font-medium text-foreground">What to expect</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Sign in if you already belong to a family circle, or use your invite
              link to join the right one.
            </p>
          </div>

          <Link
            href="#"
            className="text-center text-sm text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline sm:text-left"
          >
            Learn more about Fircle
          </Link>
        </div>
      </section>
    </main>
  );
}