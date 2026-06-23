"use client";

import { useMemo } from "react";

import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Plus, Settings, Edit } from "~/components/ui/icons";
import {
  getAvailableCategories,
  getProvidersForCategory,
  type IntegrationCategory,
  type IntegrationProvider,
} from "~/lib/integration-providers";
import { api } from "~/trpc/react";

type IntegrationSelection = {
  category: IntegrationCategory;
  provider: IntegrationProvider;
};

interface IntegrationListProps {
  familyId: string;
  isSelfHosted?: boolean;
  onAddIntegration: (selection: IntegrationSelection) => void;
  onConfigureIntegration: (selection: IntegrationSelection) => void;
}

export function IntegrationList({
  familyId,
  isSelfHosted = false,
  onAddIntegration,
  onConfigureIntegration,
}: IntegrationListProps) {
  const credentialsQuery = api.integration.listIntegrationCredentials.useQuery(
    { familyId },
    {
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const categoryItems = useMemo(() => {
    const categories = getAvailableCategories();
    return categories.map((category) => {
      const providers = getProvidersForCategory(category);
      const defaultProvider = providers[0]?.provider as IntegrationProvider;
      return {
        category,
        label: category.charAt(0).toUpperCase() + category.slice(1),
        description:
          category === "storage"
            ? "Object storage for media and files"
            : `Configure ${String(category)} integrations`,
        providers,
        defaultProvider,
      };
    });
  }, []);

  const configuredByCategory = useMemo(() => {
    const map = new Map<string, {
      provider: string;
      label: string;
      isEnabled: boolean;
      updatedAt: string;
    }>();

    for (const credential of credentialsQuery.data ?? []) {
      map.set(credential.category, {
        provider: credential.provider,
        label: credential.provider,
        isEnabled: credential.isEnabled,
        updatedAt: credential.updatedAt.toISOString(),
      });
    }

    return map;
  }, [credentialsQuery.data]);

  const defaultSelection = categoryItems[0]
    ? { category: categoryItems[0].category, provider: categoryItems[0].defaultProvider }
    : null;

  if (categoryItems.length === 0) {
    return (
      <Alert>
        <AlertDescription>No integration categories are available yet.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="font-semibold text-lg">Configured integrations</h3>
          <p className="text-sm text-muted-foreground">
            {isSelfHosted
              ? "This deployment reads integration credentials from environment configuration."
              : "Start from a clean list view, then add or edit credentials only when needed."}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            if (defaultSelection) {
              onAddIntegration(defaultSelection);
            }
          }}
          className="gap-2"
          disabled={!defaultSelection || isSelfHosted}
        >
          <Plus className="size-4" />
          {isSelfHosted ? "Managed by environment" : "Add integration"}
        </Button>
      </div>

      <div className="space-y-3">
        {categoryItems.map((item) => {
          const configured = configuredByCategory.get(item.category);

          const status = isSelfHosted
            ? {
                label: "Environment managed",
                className: "border-sky-500/30 bg-sky-500/10 text-sky-700",
              }
            : !configured
              ? { label: "Not configured", className: "border-amber-500/30 bg-amber-500/10 text-amber-700" }
              : configured.isEnabled
                ? { label: `Configured (${configured.provider})`, className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" }
                : { label: "Disabled", className: "border-muted-foreground/30 bg-muted/60 text-muted-foreground" };

          return (
            <div
              key={item.category}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Settings className="size-4 text-muted-foreground" aria-hidden="true" />
                  <h4 className="font-medium">{item.label}</h4>
                  <Badge variant="outline" className={status.className}>
                    {status.label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{item.description}</p>
                <p className="text-xs text-muted-foreground/80">
                  Available providers: {String(item.providers.map((p) => p.provider).join(", "))}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={isSelfHosted}
                onClick={() =>
                  onConfigureIntegration({
                    category: item.category,
                    provider: (configured?.provider ?? item.defaultProvider) as IntegrationProvider,
                  })
                }
              >
                <Edit className="size-4" />
                {isSelfHosted ? "Managed by environment" : configured ? "Edit" : "Configure"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
