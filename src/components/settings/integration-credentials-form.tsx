"use client";

import { useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Check, Loader, Settings } from "~/components/ui/icons";
import { api } from "~/trpc/react";

export type IntegrationCredentialFormValues = {
  familyId: string;
  category: string;
  provider: string;
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
  isEnabled: boolean;
};

interface IntegrationCredentialsFormProps {
  familyId: string;
  onSave?: (values: IntegrationCredentialFormValues) => Promise<void> | void;
  onTest?: (values: IntegrationCredentialFormValues) => Promise<void> | void;
  onCancel?: () => void;
}

function createInitialValues(familyId: string): IntegrationCredentialFormValues {
  return {
    familyId,
    category: "storage",
    provider: "r2",
    accountId: "",
    bucket: "",
    accessKeyId: "",
    secretAccessKey: "",
    publicBaseUrl: "",
    isEnabled: true,
  };
}

function validateValues(values: IntegrationCredentialFormValues): string | null {
  if (!values.category.trim()) {
    return "Category is required.";
  }

  if (!values.provider.trim()) {
    return "Provider is required.";
  }

  if (!values.isEnabled) {
    return null;
  }

  if (!values.accountId.trim()) {
    return "R2 Account ID is required.";
  }

  if (!values.bucket.trim()) {
    return "R2 bucket is required.";
  }

  if (!values.accessKeyId.trim()) {
    return "R2 Access Key ID is required.";
  }

  if (!values.secretAccessKey.trim()) {
    return "R2 Secret Access Key is required.";
  }

  if (!values.publicBaseUrl.trim()) {
    return "R2 Public Base URL is required.";
  }

  return null;
}

export function IntegrationCredentialsForm({ familyId, onSave, onTest, onCancel }: IntegrationCredentialsFormProps) {
  const [values, setValues] = useState(() => createInitialValues(familyId));
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const utils = api.useUtils();

  const credentialQuery = api.integration.getIntegrationCredential.useQuery(
    {
      familyId,
      category: values.category,
    },
    {
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const saveIntegrationCredentialMutation = api.integration.saveIntegrationCredential.useMutation();
  const testIntegrationCredentialMutation = api.integration.testIntegrationCredential.useMutation();
  const disableIntegrationCredentialMutation = api.integration.disableIntegrationCredential.useMutation();

  useEffect(() => {
    if (!credentialQuery.data) {
      return;
    }

    setValues((current) => ({
      ...current,
      category: credentialQuery.data.category,
      provider: credentialQuery.data.provider,
      isEnabled: credentialQuery.data.isEnabled,
    }));
    setLastUpdatedAt(new Date(credentialQuery.data.updatedAt));
  }, [credentialQuery.data]);

  function updateValue<Key extends keyof IntegrationCredentialFormValues>(key: Key, nextValue: IntegrationCredentialFormValues[Key]) {
    setValues((current) => ({ ...current, [key]: nextValue }));
  }

  function resetForm() {
    setValues(createInitialValues(familyId));
    setStatusMessage(null);
    setErrorMessage(null);
    setLastUpdatedAt(null);
    onCancel?.();
  }

  async function handleTest() {
    setErrorMessage(null);
    setStatusMessage(null);

    const validationError = validateValues(values);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsTesting(true);
    try {
      if (onTest) {
        await onTest(values);
      } else {
        const result = await testIntegrationCredentialMutation.mutateAsync({
          familyId: values.familyId,
          category: values.category,
          provider: values.provider,
          payload: {
            accountId: values.accountId,
            bucket: values.bucket,
            accessKeyId: values.accessKeyId,
            secretAccessKey: values.secretAccessKey,
            publicBaseUrl: values.publicBaseUrl,
          },
        });

        if (!result.ok) {
          setErrorMessage(result.message);
          return;
        }
      }

      setStatusMessage("Credential check completed successfully.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Credential test failed.");
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    const validationError = validateValues(values);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSaving(true);
    try {
      if (onSave) {
        await onSave(values);
      } else {
        const savedCredential = await saveIntegrationCredentialMutation.mutateAsync({
          familyId: values.familyId,
          category: values.category,
          provider: values.provider,
          isEnabled: values.isEnabled,
          payload: {
            accountId: values.accountId,
            bucket: values.bucket,
            accessKeyId: values.accessKeyId,
            secretAccessKey: values.secretAccessKey,
            publicBaseUrl: values.publicBaseUrl,
          },
          testBeforeSave: true,
        });

        setLastUpdatedAt(new Date(savedCredential.updatedAt));
        await utils.integration.getIntegrationCredential.invalidate({
          familyId: values.familyId,
          category: values.category,
        });
      }

      setStatusMessage(values.isEnabled ? "Credential saved successfully." : "Credential saved and disabled.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save credentials.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDisable() {
    setErrorMessage(null);
    setStatusMessage(null);

    setIsSaving(true);
    try {
      if (onSave) {
        await onSave({ ...values, isEnabled: false });
      } else {
        const disabledCredential = await disableIntegrationCredentialMutation.mutateAsync({
          familyId: values.familyId,
          category: values.category,
        });

        setValues((current) => ({ ...current, isEnabled: false }));
        setLastUpdatedAt(new Date(disabledCredential.updatedAt));
        await utils.integration.getIntegrationCredential.invalidate({
          familyId: values.familyId,
          category: values.category,
        });
      }

      setStatusMessage("Credential disabled successfully.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to disable credentials.");
    } finally {
      setIsSaving(false);
    }
  }

  const statusBadge = useMemo(() => {
    const enabled = credentialQuery.data?.isEnabled ?? values.isEnabled;

    if (!enabled) {
      return { label: "Disabled", className: "border-muted-foreground/30 bg-muted/60 text-muted-foreground" };
    }

    if (credentialQuery.data || lastUpdatedAt) {
      return { label: "Configured", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" };
    }

    return { label: "Not saved yet", className: "border-amber-500/30 bg-amber-500/10 text-amber-700" };
  }, [credentialQuery.data, lastUpdatedAt, values.isEnabled]);

  const currentStateDescription = (credentialQuery.data?.isEnabled ?? values.isEnabled)
    ? "This credential set will be used for the selected category/provider once saved."
    : "This credential set is disabled and will not be used until re-enabled.";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Settings className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="font-semibold text-xl tracking-tight">Integration Credentials</h2>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Configure owner-managed credentials for the current family. The form is already structured
            around category and provider so future integrations can reuse the same model.
          </p>
        </div>

        <Badge variant="outline" className={statusBadge.className}>
          {statusBadge.label}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="category" className="text-sm font-medium">
                Category
              </label>
              <Input
                id="category"
                value={values.category}
                onChange={(event) => updateValue("category", event.target.value)}
                placeholder="storage"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">Use broad groups like storage or ai.</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="provider" className="text-sm font-medium">
                Provider
              </label>
              <Input
                id="provider"
                value={values.provider}
                onChange={(event) => updateValue("provider", event.target.value)}
                placeholder="r2"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">Use the vendor or service name.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border bg-muted/20 px-3 py-2">
            <input
              id="enabled"
              type="checkbox"
              checked={values.isEnabled}
              onChange={(event) => updateValue("isEnabled", event.target.checked)}
              className="size-4 rounded border-input"
            />
            <label htmlFor="enabled" className="text-sm font-medium">
              Enable this credential set
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="accountId" className="text-sm font-medium">
                R2 Account ID
              </label>
              <Input
                id="accountId"
                value={values.accountId}
                onChange={(event) => updateValue("accountId", event.target.value)}
                placeholder="account id"
                autoComplete="off"
                disabled={!values.isEnabled}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="bucket" className="text-sm font-medium">
                R2 Bucket
              </label>
              <Input
                id="bucket"
                value={values.bucket}
                onChange={(event) => updateValue("bucket", event.target.value)}
                placeholder="family-media"
                autoComplete="off"
                disabled={!values.isEnabled}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="accessKeyId" className="text-sm font-medium">
                R2 Access Key ID
              </label>
              <Input
                id="accessKeyId"
                value={values.accessKeyId}
                onChange={(event) => updateValue("accessKeyId", event.target.value)}
                placeholder="access key id"
                autoComplete="off"
                disabled={!values.isEnabled}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="secretAccessKey" className="text-sm font-medium">
                R2 Secret Access Key
              </label>
              <Input
                id="secretAccessKey"
                type="password"
                value={values.secretAccessKey}
                onChange={(event) => updateValue("secretAccessKey", event.target.value)}
                placeholder="secret access key"
                autoComplete="off"
                disabled={!values.isEnabled}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="publicBaseUrl" className="text-sm font-medium">
              R2 Public Base URL
            </label>
            <Input
              id="publicBaseUrl"
              value={values.publicBaseUrl}
              onChange={(event) => updateValue("publicBaseUrl", event.target.value)}
              placeholder="https://pub-....r2.dev"
              autoComplete="off"
              disabled={!values.isEnabled}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={handleTest} disabled={isTesting || isSaving} className="gap-2">
              {isTesting ? <Loader className="size-4 animate-spin" /> : <Check className="size-4" />}
              <span>Test Credentials</span>
            </Button>

            <Button type="submit" disabled={isSaving || isTesting} className="gap-2">
              {isSaving ? <Loader className="size-4 animate-spin" /> : <Check className="size-4" />}
              <span>Save</span>
            </Button>

            <Button type="button" variant="outline" onClick={handleDisable} disabled={isSaving || isTesting || !credentialQuery.data}>
              Disable
            </Button>

            <Button type="button" variant="ghost" onClick={resetForm} disabled={isSaving || isTesting}>
              Cancel
            </Button>
          </div>

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to continue</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          {statusMessage ? (
            <Alert>
              <AlertTitle>Ready</AlertTitle>
              <AlertDescription>{statusMessage}</AlertDescription>
            </Alert>
          ) : null}
        </form>

        <aside className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="space-y-2">
            <h3 className="font-semibold">Credential status</h3>
            <p className="text-sm text-muted-foreground">{currentStateDescription}</p>
          </div>

          <div className="space-y-2 rounded-xl border bg-muted/20 p-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Family</span>
              <span className="font-medium">{familyId}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Category</span>
              <span className="font-medium">{values.category || "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Provider</span>
              <span className="font-medium">{values.provider || "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">State</span>
              <span className="font-medium">{(credentialQuery.data?.isEnabled ?? values.isEnabled) ? "Enabled" : "Disabled"}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Last updated</span>
              <span className="font-medium">
                {lastUpdatedAt ? lastUpdatedAt.toLocaleString() : credentialQuery.data ? new Date(credentialQuery.data.updatedAt).toLocaleString() : "Not saved"}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-dashed bg-muted/10 p-4 text-sm text-muted-foreground">
            Object storage is the first supported provider category, but this model is ready for future
            credential-backed features without changing the schema shape.
          </div>
        </aside>
      </div>
    </div>
  );
}