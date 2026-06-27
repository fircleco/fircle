export type FeatureSidebarAccessRole = "OWNER" | "ADMIN" | "MEMBER";

export type FeatureIntegrationRequirement = {
  category: string;
  provider: string;
  settingsHref?: string;
  remediationLabel?: string;
};

export type FeatureNavigationMetadata = {
  href: string;
  label: string;
  description?: string;
  sortOrder?: number;
};

export type FeatureRightSidebarEntryMetadata = {
  id: string;
  label: string;
  href: string;
  description?: string;
  requiredRole?: FeatureSidebarAccessRole;
  sortOrder?: number;
};

export type FeatureComponentExtensionPoints = {
  feedTimelineOverlays?: string[];
  composerExtensions?: string[];
  settingsPanels?: string[];
  routeLocalBannersOrCtas?: string[];
  rightSidebarEntries?: string[];
};

export type FeatureActivationDefinition = {
  featureKey: string;
  requiredIntegrations: FeatureIntegrationRequirement[];
  navigation?: FeatureNavigationMetadata;
  routeGroupRoot: string;
  backendRouterNamespace: string;
  componentExtensionPoints?: FeatureComponentExtensionPoints;
  rightSidebarEntry?: FeatureRightSidebarEntryMetadata;
};

export type FeatureActivationContract = FeatureActivationDefinition & {
  isEnabled: boolean;
  isReady: boolean;
  remediationMessage: string | null;
};

export type FamilyFeatureState = {
  featureKey: string;
  isEnabled: boolean;
};

export type FamilyIntegrationState = {
  category: string;
  provider: string;
  isEnabled: boolean;
};

// Future feature modules should register their static metadata here.
export const FEATURE_ACTIVATION_REGISTRY: FeatureActivationDefinition[] = [];

function bySortOrder<T extends { sortOrder?: number }>(a: T, b: T) {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
}

function hasIntegrationRequirement(
  requirement: FeatureIntegrationRequirement,
  integrationStates: FamilyIntegrationState[],
) {
  return integrationStates.some((integration) => (
    integration.isEnabled &&
    integration.category === requirement.category &&
    integration.provider === requirement.provider
  ));
}

function buildRemediationMessage(input: {
  featureKey: string;
  requiredIntegrations: FeatureIntegrationRequirement[];
}) {
  if (input.requiredIntegrations.length === 0) {
    return null;
  }

  const labels = input.requiredIntegrations
    .map((requirement) => requirement.remediationLabel ?? `${requirement.category}/${requirement.provider}`)
    .join(", ");

  return `Feature '${input.featureKey}' is enabled but not ready. Configure required integrations in /settings/integrations: ${labels}.`;
}

export function resolveFeatureActivations(input: {
  featureStates: FamilyFeatureState[];
  integrationStates: FamilyIntegrationState[];
  registry?: FeatureActivationDefinition[];
}) {
  const registry = input.registry ?? FEATURE_ACTIVATION_REGISTRY;
  const stateByKey = new Map(input.featureStates.map((state) => [state.featureKey, state.isEnabled]));

  return registry
    .map<FeatureActivationContract>((definition) => {
      const isEnabled = stateByKey.get(definition.featureKey) ?? false;
      const isReady =
        isEnabled &&
        definition.requiredIntegrations.every((requirement) =>
          hasIntegrationRequirement(requirement, input.integrationStates),
        );

      return {
        ...definition,
        isEnabled,
        isReady,
        remediationMessage:
          isEnabled && !isReady
            ? buildRemediationMessage({
                featureKey: definition.featureKey,
                requiredIntegrations: definition.requiredIntegrations,
              })
            : null,
      };
    })
    .sort((a, b) => a.featureKey.localeCompare(b.featureKey));
}

export function getFeatureNavigationMetadata(activations: FeatureActivationContract[]) {
  return activations
    .filter((activation) => activation.isEnabled && activation.isReady && Boolean(activation.navigation))
    .map((activation) => ({
      featureKey: activation.featureKey,
      ...activation.navigation!,
    }))
    .sort(bySortOrder);
}

export function getFeatureRightSidebarEntries(activations: FeatureActivationContract[]) {
  return activations
    .filter((activation) => activation.isEnabled && activation.isReady && Boolean(activation.rightSidebarEntry))
    .map((activation) => activation.rightSidebarEntry!)
    .sort(bySortOrder);
}

export function getFeatureRouteVisibility(activations: FeatureActivationContract[], featureKey: string) {
  const activation = activations.find((entry) => entry.featureKey === featureKey);
  if (!activation) {
    return {
      shouldRenderEntryPoint: false,
      shouldAllowRoute: false,
      remediationMessage: `Feature '${featureKey}' is not registered.`,
    };
  }

  return {
    shouldRenderEntryPoint: activation.isEnabled,
    shouldAllowRoute: activation.isEnabled && activation.isReady,
    remediationMessage: activation.remediationMessage,
  };
}
