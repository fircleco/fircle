"use client";

import { useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Check, Loader, Settings } from "~/components/ui/icons";
import { DynamicFieldRenderer } from "~/components/ui/dynamic-field-renderer";
import {
  getAvailableCategories,
  getProvidersForCategory,
  getProviderDef,
  validateProviderPayload,
  type IntegrationCategory,
  type IntegrationProvider,
} from "~/lib/integration-providers";
import { api } from "~/trpc/react";

export type IntegrationCredentialFormValues = {
  familyId: string;
  category: IntegrationCategory;
  provider: IntegrationProvider;
  payload: Record<string, string>;
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
    payload: {
      accountId: "",
      bucket: "",
      accessKeyId: "",
      secretAccessKey: "",
      publicBaseUrl: "",
    },
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

  // Validate payload against provider schema
  const validation = validateProviderPayload(values.category, values.provider, values.payload);
  if (!validation.ok) {
    return validation.message ?? "Invalid payload.";
  }

  return null;
}

export function IntegrationCredentialsForm({
  familyId,
  onSave,
  onTest,
  onCancel,
}: IntegrationCredentialsFormProps) {
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
  const disableIntegrationCredentialMutation =
    api.integration.disableIntegrationCredential.useMutation();

  useEffect(() => {
    if (!credentialQuery.data) {
      return;
    }

    const data = credentialQuery.data;
    setValues((current) => ({
      ...current,
      category: data.category as IntegrationCategory,
      provider: data.provider as IntegrationProvider,
      isEnabled: data.isEnabled,
    }));
    setLastUpdatedAt(new Date(data.updatedAt));
  }, [credentialQuery.data]);

  function updatePayloadValue(fieldName: string, fieldValue: string) {
    setValues((current) => ({
      ...current,
      payload: {
        ...current.payload,
        [fieldName]: fieldValue,
      },
    }));
  }

  function handleCategoryChange(nextCategory: string) {
    const category = nextCategory as IntegrationCategory;
    setValues((current) => {
      const providersForCategory = getProvidersForCategory(category);
      const firstProvider = providersForCategory[0];

      return {
        ...current,
        category,
        provider: (firstProvider?.provider ?? "") as IntegrationProvider,
        payload: getInitialPayloadForProvider(
          category,
          firstProvider?.provider ?? ""
        ),
      };
    });
  }

  function handleProviderChange(nextProvider: string) {
    const provider = nextProvider as IntegrationProvider;
    setValues((current) => ({
      ...current,
      provider,
      payload: getInitialPayloadForProvider(current.category, provider),
    }));
  }

  function getInitialPayloadForProvider(category: IntegrationCategory, provider: string): Record<string, string> {
    const providerDef = getProviderDef(category, provider as IntegrationProvider);
    if (!providerDef) {
      return {};
    }

    const initialPayload: Record<string, string> = {};
    for (const field of providerDef.fields) {
      initialPayload[field.name] = "";
    }
    return initialPayload;
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
          payload: values.payload,
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
          payload: values.payload,
          testBeforeSave: true,
        });

        setLastUpdatedAt(new Date(savedCredential.updatedAt));
        await utils.integration.getIntegrationCredential.invalidate({
          familyId: values.familyId,
          category: values.category,
        });
      }

      setStatusMessage(
        values.isEnabled
          ? "Credential saved successfully."
          : "Credential saved and disabled."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save credentials."
      );
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
        const disabledCredential =
          await disableIntegrationCredentialMutation.mutateAsync({
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
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to disable credentials."
      );
    } finally {
      setIsSaving(false);
    }
  }

  const categories = useMemo(() => getAvailableCategories(), []);
  const providers = useMemo(
    () => getProvidersForCategory(values.category),
    [values.category]
  );
  const currentProviderDef = useMemo(
    () => getProviderDef(values.category, values.provider),
    [values.category, values.provider]
  );

  const statusBadge = useMemo(() => {
    const enabled = credentialQuery.data?.isEnabled ?? values.isEnabled;

    if (!enabled) {
      return {
        label: "Disabled",
        className: "border-muted-foreground/30 bg-muted/60 text-muted-foreground",
      };
    }

    if (credentialQuery.data || lastUpdatedAt) {
      return {
        label: "Configured",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
      };
    }

    return {
      label: "Not saved yet",
      className: "border-amber-500/30 bg-amber-500/10 text-amber-700",
    };
  }, [credentialQuery.data, lastUpdatedAt, values.isEnabled]);

  const currentStateDescription = credentialQuery.data?.isEnabled ?? values.isEnabled
    ? "This credential set will be used for the selected category/provider once saved."
    : "This credential set is disabled and will not be used until re-enabled.";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Settings className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="font-semibold text-xl tracking-tight">
              Integration Credentials
            </h2>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Configure owner-managed credentials for the current family. The form
            automatically adapts based on the selected provider.
          </p>
        </div>

        <Badge variant="outline" className={statusBadge.className}>
          {statusBadge.label}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border bg-card p-4 shadow-sm"
        >
          {/* Category selector */}
          <div className="space-y-2">
            <label htmlFor="category" className="text-sm font-medium">
              Category
            </label>
            <select
              id="category"
              value={values.category}
              onChange={(event) => handleCategoryChange(event.target.value)}
              disabled={isSaving || isTesting}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Select the integration category.
            </p>
          </div>

          {/* Provider selector */}
          <div className="space-y-2">
            <label htmlFor="provider" className="text-sm font-medium">
              Provider
            </label>
            <select
              id="provider"
              value={values.provider}
              onChange={(event) => handleProviderChange(event.target.value)}
              disabled={isSaving || isTesting || providers.length === 0}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {providers.map((provider) => (
                <option key={provider.provider} value={provider.provider}>
                  {provider.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {currentProviderDef?.description ?? "Select a provider."}
            </p>
          </div>

          {/* Enable toggle */}
          <div className="flex items-center gap-2 rounded-xl border bg-muted/20 px-3 py-2">
            <input
              id="enabled"
              type="checkbox"
              checked={values.isEnabled}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  isEnabled: event.target.checked,
                }))
              }
              className="size-4 rounded border-input"
            />
            <label htmlFor="enabled" className="text-sm font-medium">
              Enable this credential set
            </label>
          </div>

          {/* Dynamic fields based on provider */}
          {currentProviderDef && (
            <div className="grid gap-4 md:grid-cols-2">
              {currentProviderDef.fields.map((field) => (
                <div key={field.name}>
                  <DynamicFieldRenderer
                    field={field}
                    value={values.payload[field.name] ?? ""}
                    onChange={(value) => updatePayloadValue(field.name, value)}
                    disabled={!values.isEnabled}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={isTesting || isSaving}
              className="gap-2"
            >
              {isTesting ? (
                <Loader className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              <span>Test Credentials</span>
            </Button>

            <Button
              type="submit"
              disabled={isSaving || isTesting}
              className="gap-2"
            >
              {isSaving ? (
                <Loader className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              <span>Save</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleDisable}
              disabled={isSaving || isTesting || !credentialQuery.data}
            >
              Disable
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={resetForm}
              disabled={isSaving || isTesting}
            >
              Cancel
            </Button>
          </div>

          {/* Error message */}
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to continue</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          {/* Success message */}
          {statusMessage ? (
            <Alert>
              <AlertTitle>Ready</AlertTitle>
              <AlertDescription>{statusMessage}</AlertDescription>
            </Alert>
          ) : null}
        </form>

        {/* Sidebar */}
        <aside className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="space-y-2">
            <h3 className="font-semibold">Credential status</h3>
            <p className="text-sm text-muted-foreground">
              {currentStateDescription}
            </p>
          </div>

          <div className="space-y-2 rounded-xl border bg-muted/20 p-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Family</span>
              <span className="font-medium">{familyId}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Category</span>
              <span className="font-medium">{values.category ?? "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Provider</span>
              <span className="font-medium">{currentProviderDef?.label ?? "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">State</span>
              <span className="font-medium">
                {credentialQuery.data?.isEnabled ?? values.isEnabled
                  ? "Enabled"
                  : "Disabled"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Last updated</span>
              <span className="font-medium">
                {lastUpdatedAt
                  ? lastUpdatedAt.toLocaleString()
                  : credentialQuery.data
                    ? new Date(credentialQuery.data.updatedAt).toLocaleString()
                    : "Not saved"}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-dashed bg-muted/10 p-4 text-sm text-muted-foreground">
            This dynamic form is provider-agnostic and automatically adapts to new
            integrations as they are added to the registry.
          </div>
        </aside>
      </div>
    </div>
  );
}