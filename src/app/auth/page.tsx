import Link from "next/link";

import { ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";
import { Logo } from "~/components/ui/logo";

export default function AuthLandingPage() {
  return (
    <main className="relative isolate w-full max-w-md">
      <div className="fixed right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <section className="w-full rounded-4xl border border-border/80 bg-card/90 p-7 shadow-2xl shadow-black/10 backdrop-blur sm:p-9">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4 text-center sm:text-left">
            <div className="flex flex-col gap-3">
              <div className="flex gap-2 items-center justify-center sm:justify-start">
                <Logo className="h-10 w-auto text-foreground sm:h-12" aria-hidden="true" />
                <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                  Fircle
                </h1>
              </div>
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
          </div>
        </div>
      </section>
    </main>
  );
}
