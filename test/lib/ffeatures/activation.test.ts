import { describe, expect, it } from "vitest";

import {
  getFeatureNavigationMetadata,
  getFeatureRightSidebarEntries,
  getFeatureRouteVisibility,
  resolveFeatureActivations,
  type FeatureActivationDefinition,
} from "~/lib/ffeatures/activation";

describe("feature activation resolver", () => {
  const registry: FeatureActivationDefinition[] = [
    {
      featureKey: "events",
      requiredIntegrations: [
        {
          category: "storage",
          provider: "r2",
          remediationLabel: "Cloudflare R2",
        },
      ],
      navigation: {
        href: "/events",
        label: "Events",
        sortOrder: 20,
      },
      routeGroupRoot: "/(app)/(ffeatures)/events",
      backendRouterNamespace: "ffeatures.events",
      rightSidebarEntry: {
        id: "events-upcoming",
        label: "Upcoming Events",
        href: "/events",
        sortOrder: 10,
      },
    },
  ];

  it("does not require feature rows to resolve activation state", () => {
    const activations = resolveFeatureActivations({
      featureStates: [],
      integrationStates: [],
      registry,
    });

    expect(activations).toHaveLength(1);
    expect(activations[0]).toMatchObject({
      featureKey: "events",
      isEnabled: false,
      isReady: false,
    });

    expect(getFeatureNavigationMetadata(activations)).toEqual([]);
    expect(getFeatureRightSidebarEntries(activations)).toEqual([]);
    expect(getFeatureRouteVisibility(activations, "events")).toMatchObject({
      shouldRenderEntryPoint: false,
      shouldAllowRoute: false,
    });
  });

  it("returns remediation when enabled but missing required integrations", () => {
    const activations = resolveFeatureActivations({
      featureStates: [{ featureKey: "events", isEnabled: true }],
      integrationStates: [],
      registry,
    });

    expect(activations).toHaveLength(1);
    const activation = activations[0];
    if (!activation) {
      throw new Error("Expected one activation result");
    }

    expect(activation.isEnabled).toBe(true);
    expect(activation.isReady).toBe(false);
    expect(activation.remediationMessage).toContain("/settings/integrations");
  });
});
