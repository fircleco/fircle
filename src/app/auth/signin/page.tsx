"use client";

import Link from "next/link";
import { AlertCircle } from "~/components/ui/icons";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { ThemeToggle } from "~/components/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export default function SignInPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const errorType = searchParams.get("error");
  const claimSuccess = searchParams.get("claimed") === "1";

  const errorMessageByType: Record<string, string> = {
    invalid: "Invalid email or password. Please try again.",
    CredentialsSignin: "Invalid email or password. Please try again.",
    AccessDenied: "You do not have permission to sign in.",
    SessionRequired: "Please sign in to continue.",
  };

  const errorMessage = formError ?? (errorType ? errorMessageByType[errorType] : null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const email = getFormString(formData, "email").trim();
    const password = getFormString(formData, "password");

    setIsLoading(true);
    setFormError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    if (!result || result.error) {
      const next = new URLSearchParams();
      next.set("error", "invalid");
      next.set("callbackUrl", callbackUrl);
      router.replace(`/auth/signin?${next.toString()}`);
      setIsLoading(false);
      return;
    }

    router.replace(result.url ?? callbackUrl);
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

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertCircle className="size-5" aria-hidden="true" />
              <AlertTitle>Sign-in failed</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          {claimSuccess ? (
            <Alert>
              <AlertCircle className="size-5" aria-hidden="true" />
              <AlertTitle>Profile claimed</AlertTitle>
              <AlertDescription>
                Your family profile is ready. Sign in with the account you just created to continue.
              </AlertDescription>
            </Alert>
          ) : null}

          <form action="#" className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                name="email"
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
                name="password"
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
              href="/auth"
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
