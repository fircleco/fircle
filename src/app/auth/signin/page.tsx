"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export default function SignInPage() {
  const [isLoading, setIsLoading] = useState(false);
  const searchParams = useSearchParams();
  const showError = searchParams.get("error") === "invalid";

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    setIsLoading(true);
  };

  return (
    <main className="relative isolate w-full max-w-md">
      <div className="fixed right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <section className="w-full rounded-4xl border border-border/80 bg-card/90 p-7 shadow-2xl shadow-black/10 backdrop-blur sm:p-9">
        <div className="flex flex-col gap-6">
          <header className="space-y-2 text-center sm:text-left">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance">
              Sign In
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Enter your family credentials
            </p>
          </header>

          {showError ? (
            <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>Invalid email or password. Please try again.</p>
            </div>
          ) : null}

          <form action="#" className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="email@family.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Password"
                autoComplete="current-password"
                required
              />
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>

            <div className="text-center sm:text-left">
              <Link
                href="#"
                className="text-sm text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          </form>

          <p className="text-center text-sm text-muted-foreground sm:text-left">
            Don&apos;t have an account?{" "}
            <Link
              href="/"
              className="font-medium text-foreground underline-offset-4 transition hover:underline"
            >
              Request an invite
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
