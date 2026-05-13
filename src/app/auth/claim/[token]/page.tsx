"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, ShieldCheck } from "~/components/ui/icons";

import { ThemeToggle } from "~/components/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";

function getClaimErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  return "Unable to complete the claim request.";
}

function getClaimErrorState(errorMessage: string | null) {
  if (errorMessage === "EMAIL_MISMATCH") return "emailMismatch";
  if (errorMessage === "MISSING_BOUND_EMAIL") return "missingBoundEmail";
  if (errorMessage === "An account with this email already exists. Please sign in instead.") {
    return "emailAlreadyExists";
  }

  return null;
}

export default function ClaimAccountPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const claimPreviewQuery = api.familyMember.getClaimLinkByToken.useQuery(
    { code: params.token },
    { retry: false, refetchOnWindowFocus: false },
  );

  const claimMember = api.familyMember.claimMemberProfile.useMutation({
    onSuccess: () => {
      router.replace("/auth/signin?claimed=1");
    },
    onError(error) {
      setFormError(getClaimErrorMessage(error));
    },
  });

  const previewState = claimPreviewQuery.data?.state ?? (claimPreviewQuery.isLoading ? "loading" : "invalid");
  const isValidPreview = previewState === "valid";
  const claimErrorState = getClaimErrorState(formError);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isValidPreview || claimMember.isPending) {
      return;
    }

    setFormError(null);

    await claimMember.mutateAsync({
      code: params.token,
      email,
      password,
      confirmPassword,
    });
  };

  return (
    <main className="relative isolate w-full max-w-md">
      <div className="fixed right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <section className="w-full rounded-4xl border border-border/80 bg-card/90 p-7 shadow-2xl shadow-black/10 backdrop-blur sm:p-9">
        {claimPreviewQuery.isLoading ? (
          <div className="space-y-6 text-center sm:text-left">
            <header className="space-y-2">
              <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance">
                Claim family profile
              </h1>
              <p className="text-sm text-muted-foreground sm:text-base">Loading this claim link...</p>
            </header>
          </div>
        ) : claimPreviewQuery.data?.state === "valid" ? (
          <div className="space-y-6">
            <header className="space-y-2 text-center sm:text-left">
              <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance">
                Claim family profile
              </h1>
              <p className="text-sm text-muted-foreground sm:text-base">
                Confirm your details to activate an existing family profile.
              </p>
            </header>

            <div className="rounded-3xl border border-border/80 bg-muted/40 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-border/80 bg-background/80 p-2 text-muted-foreground">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                </div>

                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-base">{claimPreviewQuery.data.member.name}</p>
                  <p className="text-muted-foreground">{claimPreviewQuery.data.family.name}</p>
                  <p className="text-muted-foreground">Prepared by a family admin</p>
                  <p className="text-muted-foreground">
                    Claiming this link will activate this existing profile instead of creating a duplicate person.
                  </p>
                </div>
              </div>
            </div>

            {claimErrorState === "emailMismatch" ? (
              <Alert variant="destructive">
                <AlertCircle className="size-5" aria-hidden="true" />
                <AlertTitle>Email mismatch</AlertTitle>
                <AlertDescription>
                  The email you entered does not match the email bound to this claim link.
                </AlertDescription>
              </Alert>
            ) : claimErrorState === "missingBoundEmail" ? (
              <Alert variant="destructive">
                <AlertCircle className="size-5" aria-hidden="true" />
                <AlertTitle>Claim link requires an email</AlertTitle>
                <AlertDescription>
                  This claim link was created with email binding, but no email is attached to the invite.
                </AlertDescription>
              </Alert>
            ) : claimErrorState === "emailAlreadyExists" ? (
              <Alert variant="destructive">
                <AlertCircle className="size-5" aria-hidden="true" />
                <AlertTitle>Email already in use</AlertTitle>
                <AlertDescription>
                  That email is already registered. Sign in with it instead of claiming.
                </AlertDescription>
              </Alert>
            ) : formError ? (
              <Alert variant="destructive">
                <AlertCircle className="size-5" aria-hidden="true" />
                <AlertTitle>Claim failed</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
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
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={!isValidPreview || claimMember.isPending}
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
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={!isValidPreview || claimMember.isPending}
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
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  disabled={!isValidPreview || claimMember.isPending}
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={!isValidPreview || claimMember.isPending}
              >
                {claimMember.isPending ? "Claiming profile..." : "Claim profile and continue"}
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

            {previewState === "invalid" ? (
              <Alert variant="destructive">
                <AlertCircle className="size-5" aria-hidden="true" />
                <AlertTitle>Claim link not recognized</AlertTitle>
                <AlertDescription>
                  This claim link does not match a known profile. Please request a new claim invite.
                </AlertDescription>
              </Alert>
            ) : null}

            {previewState === "expired" ? (
              <Alert variant="destructive">
                <AlertCircle className="size-5" aria-hidden="true" />
                <AlertTitle>Claim link expired</AlertTitle>
                <AlertDescription>
                  This claim link has expired. Please request a new invite from a family member.
                </AlertDescription>
              </Alert>
            ) : null}

            {previewState === "revoked" ? (
              <Alert variant="destructive">
                <AlertCircle className="size-5" aria-hidden="true" />
                <AlertTitle>Claim link revoked</AlertTitle>
                <AlertDescription>
                  This claim link was revoked by a family admin. Ask for a new claim invite.
                </AlertDescription>
              </Alert>
            ) : null}

            {previewState === "claimed" ? (
              <Alert variant="destructive">
                <AlertCircle className="size-5" aria-hidden="true" />
                <AlertTitle>Claim link already used</AlertTitle>
                <AlertDescription>
                  This link has already been claimed. Sign in instead, or ask a family admin for help.
                </AlertDescription>
              </Alert>
            ) : null}

            {previewState === "memberAlreadyClaimed" ? (
              <Alert variant="destructive">
                <AlertCircle className="size-5" aria-hidden="true" />
                <AlertTitle>Profile already claimed</AlertTitle>
                <AlertDescription>
                  This member already has an account. Sign in instead, or ask a family admin for help.
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
