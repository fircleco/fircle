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

type SetupStep = 1 | 2 | 3;

type ReadinessCheck = {
  key: string;
  label: string;
  status: "ok" | "warning" | "blocking";
  message: string;
  remediation?: string;
};

const stepMeta: Array<{ step: SetupStep; title: string; description: string }> = [
  {
    step: 1,
    title: "Environment check",
    description: "Confirm this server is ready for first-time setup.",
  },
  {
    step: 2,
    title: "Family details",
    description: "Name your family instance.",
  },
  {
    step: 3,
    title: "Owner account",
    description: "Create the first owner login.",
  },
];

export default function FirstFamilySetupPage() {
  const router = useRouter();
  const statusQuery = api.setup.getBootstrapStatus.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const readinessQuery = api.setup.getSetupReadiness.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const setupMutation = api.setup.bootstrapFirstFamily.useMutation();

  const [step, setStep] = useState<SetupStep>(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerNickname, setOwnerNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const isLoading = statusQuery.isLoading || setupMutation.isPending;

  const alreadyConfigured = useMemo(
    () => Boolean(statusQuery.data && !statusQuery.data.requiresSetup),
    [statusQuery.data],
  );

  const setupChecks: ReadinessCheck[] = readinessQuery.data?.checks ?? [];
  const hasSetupStateError = Boolean(statusQuery.error || readinessQuery.error);
  const hasBlockingChecks = setupChecks.some((check) => check.status === "blocking");
  const isSelfHosted = readinessQuery.data?.selfHosted !== false;
  const submitDisabled =
    isLoading ||
    alreadyConfigured ||
    readinessQuery.isLoading ||
    hasSetupStateError ||
    !isSelfHosted ||
    hasBlockingChecks;

  const canContinueFromStep1 =
    !statusQuery.isLoading &&
    !readinessQuery.isLoading &&
    !hasSetupStateError &&
    !alreadyConfigured &&
    isSelfHosted &&
    !hasBlockingChecks;

  const canContinueFromStep2 = familyName.trim().length > 0;
  const canSubmit =
    !submitDisabled &&
    familyName.trim().length > 0 &&
    ownerName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 8;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    const normalizedFamilyName = familyName.trim();
    const normalizedOwnerName = ownerName.trim();
    const normalizedOwnerNickname = ownerNickname.trim();
    const normalizedEmail = email.trim().toLowerCase();

    setFormError(null);

    try {
      await setupMutation.mutateAsync({
        familyName: normalizedFamilyName,
        ownerName: normalizedOwnerName,
        ownerNickname: normalizedOwnerNickname.length > 0 ? normalizedOwnerNickname : undefined,
        email: normalizedEmail,
        password,
      });

      const result = await signIn("credentials", {
        email: normalizedEmail,
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

          {/* {statusQuery.isLoading ? (
            <p className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader className="size-4 animate-spin" />
              Checking setup status...
            </p>
          ) : null} */}

          {!readinessQuery.isLoading && !isSelfHosted ? (
            <Alert>
              <AlertCircle className="size-5" aria-hidden="true" />
              <AlertTitle>Setup unavailable</AlertTitle>
              <AlertDescription>
                This deployment is not running in self-hosted mode. Use regular sign in.
              </AlertDescription>
            </Alert>
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

          {statusQuery.error ? (
            <Alert variant="destructive">
              <AlertCircle className="size-5" aria-hidden="true" />
              <AlertTitle>Setup status unavailable</AlertTitle>
              <AlertDescription>
                Could not verify setup status because the server database is unavailable. Check DATABASE_URL and
                database connectivity, then refresh.
              </AlertDescription>
            </Alert>
          ) : null}

          {readinessQuery.error ? (
            <Alert variant="destructive">
              <AlertCircle className="size-5" aria-hidden="true" />
              <AlertTitle>Readiness check failed</AlertTitle>
              <AlertDescription>
                Environment readiness checks could not run due to a server error. Fix database connectivity and try
                again.
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

          <section className="space-y-3 rounded-2xl border border-border/80 bg-muted/40 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Setup progress</p>
            <ol className="space-y-2">
              {stepMeta.map((item) => {
                const isCurrent = step === item.step;
                const isDone = step > item.step;

                return (
                  <li key={item.step} className="flex items-start gap-3">
                    <span
                      className={
                        isDone
                          ? "mt-0.5 inline-flex size-6 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-semibold"
                          : isCurrent
                            ? "mt-0.5 inline-flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold"
                            : "mt-0.5 inline-flex size-6 items-center justify-center rounded-full border border-border text-xs font-semibold text-muted-foreground"
                      }
                    >
                      {item.step}
                    </span>
                    <div>
                      <p className={isCurrent ? "font-medium text-sm" : "font-medium text-muted-foreground text-sm"}>
                        {item.title}
                      </p>
                      <p className="text-muted-foreground text-xs">{item.description}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <form action="#" className="space-y-4" onSubmit={handleSubmit}>
            <input type="hidden" name="familyName" value={familyName} readOnly />
            <input type="hidden" name="ownerName" value={ownerName} readOnly />
            <input type="hidden" name="ownerNickname" value={ownerNickname} readOnly />
            <input type="hidden" name="email" value={email} readOnly />

            {step === 1 ? (
              <section className="space-y-4 rounded-2xl border border-border/80 bg-card/70 p-4">
                <div>
                  <h2 className="font-medium text-sm">Step 1: Environment check</h2>
                  <p className="text-muted-foreground text-xs">
                    Setup can continue only when there are no blocking readiness issues.
                  </p>
                  {readinessQuery.isLoading ? (
                    <p className="flex items-center gap-2 mt-4 text-muted-foreground text-xs">
                      <Loader className="size-4 animate-spin" />
                      Running environment readiness checks...
                    </p>
                  ) : null}
                </div>

                {isSelfHosted && setupChecks.length > 0 ? (
                  <div className="space-y-3">
                    <ul className="space-y-2">
                      {setupChecks.map((check) => (
                        <li key={check.key} className="rounded-lg border border-border/70 bg-card/80 p-2">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium text-xs">{check.label}</p>
                            <span
                              className={
                                check.status === "ok"
                                  ? "text-emerald-600 text-xs font-medium"
                                  : check.status === "warning"
                                    ? "text-amber-600 text-xs font-medium"
                                    : "text-destructive text-xs font-medium"
                              }
                            >
                              {check.status.toUpperCase()}
                            </span>
                          </div>
                          <p className="mt-1 text-muted-foreground text-xs">{check.message}</p>
                          {check.remediation ? (
                            <p className="mt-1 text-xs">Fix: {check.remediation}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    {hasBlockingChecks ? (
                      <p className="text-destructive text-xs">
                        Resolve blocking checks before continuing.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </section>
            ) : null}

            {step === 2 ? (
              <section className="space-y-4 rounded-2xl border border-border/80 bg-card/70 p-4">
                <h2 className="font-medium text-sm">Step 2: Family details</h2>
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
                    value={familyName}
                    onChange={(event) => setFamilyName(event.target.value)}
                    disabled={isLoading || alreadyConfigured}
                  />
                </div>
              </section>
            ) : null}

            {step === 3 ? (
              <section className="space-y-4 rounded-2xl border border-border/80 bg-card/70 p-4">
                <h2 className="font-medium text-sm">Step 3: Owner account</h2>
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
                    value={ownerName}
                    onChange={(event) => setOwnerName(event.target.value)}
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
                    value={ownerNickname}
                    onChange={(event) => setOwnerNickname(event.target.value)}
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
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
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
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={isLoading || alreadyConfigured}
                  />
                </div>
              </section>
            ) : null}

            <div className="flex items-center gap-2">
              {step > 1 ? (
                <Button type="button" variant="outline" onClick={() => setStep((step - 1) as SetupStep)}>
                  Back
                </Button>
              ) : null}

              {step === 1 ? (
                <Button
                  type="button"
                  className="ml-auto"
                  onClick={() => setStep(2)}
                  disabled={!canContinueFromStep1}
                >
                  Continue
                </Button>
              ) : null}

              {step === 2 ? (
                <Button
                  type="button"
                  className="ml-auto"
                  onClick={() => setStep(3)}
                  disabled={!canContinueFromStep2 || submitDisabled}
                >
                  Continue
                </Button>
              ) : null}

              {step === 3 ? (
                <Button type="submit" size="lg" className="ml-auto" disabled={!canSubmit}>
                  {setupMutation.isPending ? "Setting up..." : "Complete setup"}
                </Button>
              ) : null}
            </div>
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
