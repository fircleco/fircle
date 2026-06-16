"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ThemeToggle } from "~/components/theme-toggle";
import { beginNavigationProgress } from "~/components/nav/navigation-progress";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { AlertCircle, Loader } from "~/components/ui/icons";
import { Input } from "~/components/ui/input";
import { Logo } from "~/components/ui/logo";
import { api } from "~/trpc/react";

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export default function FirstFamilySetupPage() {
  const router = useRouter();
  const statusQuery = api.invite.getBootstrapStatus.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const setupMutation = api.invite.bootstrapFirstFamily.useMutation();

  const [formError, setFormError] = useState<string | null>(null);
  const isLoading = statusQuery.isLoading || setupMutation.isPending;

  const alreadyConfigured = useMemo(
    () => Boolean(statusQuery.data && !statusQuery.data.requiresSetup),
    [statusQuery.data],
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading || alreadyConfigured) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const familyName = getFormString(formData, "familyName").trim();
    const ownerName = getFormString(formData, "ownerName").trim();
    const ownerNickname = getFormString(formData, "ownerNickname").trim();
    const email = getFormString(formData, "email").trim().toLowerCase();
    const password = getFormString(formData, "password");

    setFormError(null);

    try {
      await setupMutation.mutateAsync({
        familyName,
        ownerName,
        ownerNickname: ownerNickname.length > 0 ? ownerNickname : undefined,
        email,
        password,
      });

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/",
      });

      beginNavigationProgress();
      if (!result?.error) {
        router.replace(result?.url ?? "/");
        return;
      }

      router.replace("/auth/signin");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not complete setup.";
      setFormError(message);
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
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <Logo className="h-8 w-auto text-foreground" aria-hidden="true" />
              <span className="font-semibold text-2xl leading-none tracking-tight">Fircle</span>
            </div>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance">
              Set up your family instance
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Create your first and only family plus owner account in one step.
            </p>
          </header>

          {statusQuery.isLoading ? (
            <p className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader className="size-4 animate-spin" />
              Checking setup status...
            </p>
          ) : null}

          {alreadyConfigured ? (
            <Alert>
              <AlertCircle className="size-5" aria-hidden="true" />
              <AlertTitle>Instance already configured</AlertTitle>
              <AlertDescription>
                Initial setup has already been completed. You can sign in with your existing account.
              </AlertDescription>
            </Alert>
          ) : null}

          {formError ? (
            <Alert variant="destructive">
              <AlertCircle className="size-5" aria-hidden="true" />
              <AlertTitle>Setup failed</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}

          <form action="#" className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="familyName" className="text-sm font-medium">
                Family name
              </label>
              <Input
                id="familyName"
                name="familyName"
                type="text"
                autoComplete="organization"
                placeholder="The Shittabey Family"
                required
                disabled={isLoading || alreadyConfigured}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="ownerName" className="text-sm font-medium">
                Owner full name
              </label>
              <Input
                id="ownerName"
                name="ownerName"
                type="text"
                autoComplete="name"
                placeholder="Emma Shittabey"
                required
                disabled={isLoading || alreadyConfigured}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="ownerNickname" className="text-sm font-medium">
                Profile nickname (optional)
              </label>
              <Input
                id="ownerNickname"
                name="ownerNickname"
                type="text"
                placeholder="Em"
                disabled={isLoading || alreadyConfigured}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Owner email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@family.com"
                required
                disabled={isLoading || alreadyConfigured}
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
                autoComplete="new-password"
                minLength={8}
                placeholder="At least 8 characters"
                required
                disabled={isLoading || alreadyConfigured}
              />
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={isLoading || alreadyConfigured}>
              {setupMutation.isPending ? "Setting up..." : "Complete setup"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground sm:text-left">
            Already configured?{" "}
            <Link href="/auth/signin" className="underline underline-offset-4 hover:text-foreground">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
