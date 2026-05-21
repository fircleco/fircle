"use client";

import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { AlertCircle, ArrowRight, Loader, Security } from "~/components/ui/icons";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";

export default function AccountSettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const managementContext = api.invite.getManagementContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const familyId = managementContext.data?.family?.id;

  const changeMyPassword = api.familyMember.changeMyPassword.useMutation({
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFormError(null);
      setFormSuccess("Password updated successfully.");
    },
    onError: (error) => {
      setFormSuccess(null);
      setFormError(error.message);
    },
  });

  const isSubmitting = changeMyPassword.isPending;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!familyId) {
      setFormError("No active family context found for this account.");
      return;
    }

    if (currentPassword.trim().length === 0) {
      setFormError("Current password is required.");
      return;
    }

    if (newPassword.length < 8) {
      setFormError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError("New password and confirm password must match.");
      return;
    }

    await changeMyPassword.mutateAsync({
      familyId,
      currentPassword,
      newPassword,
      confirmPassword,
    });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h2 className="font-semibold text-xl tracking-tight">Account</h2>
        <p className="text-muted-foreground text-sm">
          Manage your account preferences and security settings.
        </p>
      </header>

      {managementContext.isLoading ? (
        <Alert>
          <Loader className="size-5 animate-spin" aria-hidden="true" />
          <AlertTitle>Loading account context</AlertTitle>
          <AlertDescription>
            We&apos;re checking your active family membership.
          </AlertDescription>
        </Alert>
      ) : null}

      {!managementContext.isLoading && !familyId ? (
        <Alert>
          <AlertCircle className="size-5" aria-hidden="true" />
          <AlertTitle>No active family found</AlertTitle>
          <AlertDescription>
            Join a family or switch family context before changing your password.
          </AlertDescription>
        </Alert>
      ) : null}

      <details className="group rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
        <summary className="flex cursor-pointer list-none items-center justify-between">
          <div className="flex items-center gap-2">
            <Security className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="font-medium text-sm uppercase tracking-wider text-muted-foreground">
              Password security
            </h2>
          </div>
          <ArrowRight
            className="size-4 text-muted-foreground transition-transform group-open:rotate-90"
            aria-hidden="true"
          />
        </summary>

        <div className="mt-4 space-y-4">
          <p className="text-muted-foreground text-xs">
            You must enter your current password before setting a new one.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="current-password" className="text-sm font-medium">
                Current password
              </label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                disabled={isSubmitting || !familyId}
                aria-invalid={formError ? true : undefined}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="new-password" className="text-sm font-medium">
                New password
              </label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                disabled={isSubmitting || !familyId}
                aria-invalid={formError ? true : undefined}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm-password" className="text-sm font-medium">
                Confirm new password
              </label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={isSubmitting || !familyId}
                aria-invalid={formError ? true : undefined}
                required
              />
            </div>

            {formError ? (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {formError}
              </p>
            ) : null}

            {formSuccess ? (
              <p role="status" aria-live="polite" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                {formSuccess}
              </p>
            ) : null}

            <div className="pt-1">
              <Button type="submit" disabled={isSubmitting || !familyId}>
                {isSubmitting ? (
                  <>
                    <Loader className="size-4 animate-spin" aria-hidden="true" />
                    Updating...
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
            </div>
          </form>
        </div>
      </details>
    </div>
  );
}
