"use client";

import Link from "next/link";
import { AlertCircle, UserRoundPlus } from "~/components/ui/icons";
import { signIn } from "next-auth/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { ThemeToggle } from "~/components/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";

export default function InviteAcceptancePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const errorType = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const acceptInvite = api.invite.acceptInvite.useMutation();

  const errorMessageByType: Record<string, string> = {
    expired: "This invite has expired. Please request a new one.",
    used: "This invite has already been used.",
    "email-conflict": "That email is already registered. Try signing in instead.",
  };

  const errorMessage = formError ?? (errorType ? errorMessageByType[errorType] : null);

  const getFormString = (formData: FormData, key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const name = getFormString(formData, "name").trim();
    const email = getFormString(formData, "email").trim();
    const password = getFormString(formData, "password");

    setIsLoading(true);
    setFormError(null);

    try {
      await acceptInvite.mutateAsync({
        code: params.code,
        name,
        email,
        password,
      });

      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!signInResult || signInResult.error) {
        setFormError("Account created, but sign-in failed. Please sign in manually.");
        router.replace("/auth/signin?error=invalid");
        return;
      }

      router.replace(callbackUrl);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("reserved for a different email")) {
          setFormError("This invite is reserved for a different email address.");
        } else if (error.message.includes("already exists")) {
          setFormError("That email is already registered. Try signing in instead.");
        } else if (error.message.includes("expired")) {
          setFormError("This invite has expired. Please request a new one.");
        } else if (error.message.includes("already been used")) {
          setFormError("This invite has already been used.");
        } else if (error.message.includes("revoked")) {
          setFormError("This invite has been revoked.");
        } else {
          setFormError("Could not accept invite. Please try again.");
        }
      } else {
        setFormError("Could not accept invite. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative isolate w-full max-w-md">
      <div className="fixed right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <section className="w-full rounded-4xl border border-border/80 bg-card/90 p-7 shadow-2xl shadow-black/10 backdrop-blur sm:p-9">
        <div className="flex flex-col gap-6">
          <header className="space-y-3 text-center sm:text-left">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance">
              You&apos;re invited to join a family
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Use invite code {params.code} to accept and create your account.
            </p>
          </header>

          <div className="rounded-3xl border border-border/80 bg-muted/50 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-border/80 bg-background/80 p-2 text-muted-foreground">
                <UserRoundPlus className="size-4" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Invited by <span className="font-semibold text-foreground">John Smith</span>
                </p>
                <p className="text-base font-semibold">The Smith Family</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  A close-knit family sharing memories, photos, and updates.
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">Relationship to family? (Optional)</p>

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertCircle className="size-5" aria-hidden="true" />
              <AlertTitle>Invite issue</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <form action="#" className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Full name
              </label>
              <Input id="name" name="name" placeholder="Your full name" autoComplete="name" required />
            </div>

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
                placeholder="Create a password"
                autoComplete="new-password"
                required
              />
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Accept & Create Account"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground sm:text-left">
            Already have an account?{" "}
            <Link
              href="/auth/signin"
              className="font-medium text-foreground underline-offset-4 transition hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

