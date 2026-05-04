"use client";

import Link from "next/link";
import { AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";

import { ThemeToggle } from "~/components/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { getClaimInvitePreviewByToken } from "~/lib/mocks/family-members";

export default function ClaimAccountPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isClaimed, setIsClaimed] = useState(false);
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const claimPreview = getClaimInvitePreviewByToken(params.token);

  const errorType = searchParams.get("error");
  const showExpiredError = errorType === "expired" || claimPreview?.status === "expired";
  const showAlreadyClaimedError = errorType === "claimed" || claimPreview?.status === "claimed";
  const showEmailConflictError = errorType === "email-conflict";

  const hasBlockingError = showExpiredError || showAlreadyClaimedError;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading || hasBlockingError) {
      return;
    }

    setIsLoading(true);
    setIsClaimed(true);
  };

  return (
    <main className="relative isolate w-full max-w-md">
      <div className="fixed right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <section className="w-full rounded-4xl border border-border/80 bg-card/90 p-7 shadow-2xl shadow-black/10 backdrop-blur sm:p-9">
        {isClaimed ? (
          <div className="space-y-5 text-center sm:text-left">
            <div className="mx-auto grid size-11 place-items-center rounded-full bg-primary/10 text-primary sm:mx-0">
              <CheckCircle2 className="size-5" aria-hidden="true" />
            </div>

            <header className="space-y-2">
              <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance">
                Profile claimed
              </h1>
              <p className="text-sm text-muted-foreground sm:text-base">
                {claimPreview?.memberName ?? "Your profile"} is now connected to your account.
              </p>
            </header>

            <p className="text-sm text-muted-foreground">
              You can continue to sign in and access your family space.
            </p>

            <Button asChild size="lg" className="w-full">
              <Link href="/auth/signin">Continue to sign in</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <header className="space-y-2 text-center sm:text-left">
              <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance">
                Claim family profile
              </h1>
              <p className="text-sm text-muted-foreground sm:text-base">
                Confirm your details to activate an existing family profile.
              </p>
            </header>

            {claimPreview ? (
              <div className="rounded-3xl border border-border/80 bg-muted/40 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl border border-border/80 bg-background/80 p-2 text-muted-foreground">
                    <ShieldCheck className="size-4" aria-hidden="true" />
                  </div>

                  <div className="space-y-2 text-sm">
                    <p className="font-semibold text-base">{claimPreview.memberName}</p>
                    <p className="text-muted-foreground">
                      {claimPreview.relationship} · {claimPreview.familyName}
                    </p>
                    <p className="text-muted-foreground">Invited by {claimPreview.invitedByName}</p>
                    <p className="text-muted-foreground">
                      Claiming this link will activate this existing profile instead of creating a
                      duplicate person.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="size-5" aria-hidden="true" />
                <AlertTitle>Claim link not recognized</AlertTitle>
                <AlertDescription>
                  This claim link does not match a known profile. Please request a new claim invite.
                </AlertDescription>
              </Alert>
            )}

            {showExpiredError ? (
              <Alert variant="destructive">
                <AlertCircle className="size-5" aria-hidden="true" />
                <AlertTitle>Claim link expired</AlertTitle>
                <AlertDescription>
                  This claim link has expired. Please request a new invite from a family member.
                </AlertDescription>
              </Alert>
            ) : null}

            {showAlreadyClaimedError ? (
              <Alert variant="destructive">
                <AlertCircle className="size-5" aria-hidden="true" />
                <AlertTitle>Profile already claimed</AlertTitle>
                <AlertDescription>
                  This profile has already been claimed. Sign in instead, or ask a family admin for
                  help.
                </AlertDescription>
              </Alert>
            ) : null}

            {showEmailConflictError ? (
              <Alert variant="destructive">
                <AlertCircle className="size-5" aria-hidden="true" />
                <AlertTitle>Email already in use</AlertTitle>
                <AlertDescription>
                  That email is already registered. Try signing in with it instead of claiming.
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
                  placeholder="Create a password"
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirm password
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  required
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isLoading || hasBlockingError || !claimPreview}
              >
                {isLoading ? "Claiming profile..." : "Claim profile and continue"}
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
        )}
      </section>
    </main>
  );
}
