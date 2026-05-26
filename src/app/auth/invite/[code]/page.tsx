"use client";

import Link from "next/link";
import { AlertCircle, UserRoundPlus } from "~/components/ui/icons";
import { signIn } from "next-auth/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { ThemeToggle } from "~/components/theme-toggle";
import { beginNavigationProgress } from "~/components/nav/navigation-progress";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";

type InvitePageState = "loading" | "valid" | "expired" | "claimed" | "revoked" | "invalid";

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function sanitizeCallbackUrl(rawCallbackUrl: string | null) {
  const value = rawCallbackUrl?.trim();

  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

function mapInviteStateFromErrorMessage(message: string): InvitePageState {
  const normalized = message.toLowerCase();
  if (normalized.includes("expired")) return "expired";
  if (normalized.includes("already been used") || normalized.includes("claimed")) {
    return "claimed";
  }
  if (normalized.includes("revoked")) return "revoked";
  if (normalized.includes("not found")) return "invalid";
  return "invalid";
}

function mapAcceptInviteErrorMessage(message: string): string {
  if (message.includes("reserved for a different email")) {
    return "This invite is reserved for a different email address.";
  }
  if (message.includes("already exists")) {
    return "That email is already registered. Try signing in instead.";
  }
  if (message.includes("expired")) {
    return "This invite has expired. Please request a new one.";
  }
  if (message.includes("already been used")) {
    return "This invite has already been used.";
  }
  if (message.includes("revoked")) {
    return "This invite has been revoked.";
  }
  if (message.includes("not found")) {
    return "This invite link is invalid.";
  }
  return "Could not accept invite. Please try again.";
}

function getInviteStateMessage(state: InvitePageState): string {
  if (state === "expired") return "This invite has expired. Please request a new one.";
  if (state === "claimed") return "This invite has already been used.";
  if (state === "revoked") return "This invite has been revoked.";
  if (state === "invalid") return "This invite link is invalid.";
  return "";
}

export default function InviteAcceptancePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const errorType = searchParams.get("error");
  const callbackUrl = sanitizeCallbackUrl(searchParams.get("callbackUrl"));

  const inviteQuery = api.invite.getByCode.useQuery(
    { code: params.code },
    {
      retry: false,
      refetchOnWindowFocus: false,
    },
  );
  const acceptInvite = api.invite.acceptInvite.useMutation();

  const errorMessageByType: Record<string, string> = {
    expired: "This invite has expired. Please request a new one.",
    used: "This invite has already been used.",
    invalid: "This invite link is invalid.",
    revoked: "This invite has been revoked.",
    "email-conflict": "That email is already registered. Try signing in instead.",
  };

  const queryState: InvitePageState = inviteQuery.isLoading
    ? "loading"
    : inviteQuery.data
      ? "valid"
      : mapInviteStateFromErrorMessage(inviteQuery.error?.message ?? "");

  const stateErrorMessage = queryState === "valid" || queryState === "loading"
    ? null
    : getInviteStateMessage(queryState);

  const errorMessage =
    formError ??
    stateErrorMessage ??
    (errorType ? errorMessageByType[errorType] : null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading || queryState !== "valid") {
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
        callbackUrl,
      });

      if (!signInResult || signInResult.error) {
        const next = new URLSearchParams();
        next.set("error", "invalid");
        next.set("callbackUrl", callbackUrl);
        beginNavigationProgress();
        router.replace(`/auth/signin?${next.toString()}`);
        return;
      }

      beginNavigationProgress();
      router.replace(signInResult.url ?? callbackUrl);
    } catch (error) {
      if (error instanceof Error) {
        setFormError(mapAcceptInviteErrorMessage(error.message));
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
                {inviteQuery.isLoading ? (
                  <>
                    <p className="text-sm text-muted-foreground">Checking invite details...</p>
                    <p className="text-base font-semibold">Loading family</p>
                  </>
                ) : inviteQuery.data ? (
                  <>
                    <p className="text-sm text-muted-foreground">Valid invite</p>
                    <p className="text-base font-semibold">{inviteQuery.data.family.name}</p>
                    {inviteQuery.data.family.description ? (
                      <p className="text-sm leading-6 text-muted-foreground">
                        {inviteQuery.data.family.description}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Invite status</p>
                    <p className="text-base font-semibold capitalize">{queryState}</p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {getInviteStateMessage(queryState)}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertCircle className="size-5" aria-hidden="true" />
              <AlertTitle>Invite issue</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          {queryState === "valid" ? (
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
          ) : (
            <Button asChild size="lg" className="w-full">
              <Link href="/auth/signin">Go to sign in</Link>
            </Button>
          )}

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

