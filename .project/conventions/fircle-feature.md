# Fircle Feature Convention

## Purpose

This document defines required implementation conventions for all feature modules in Fircle.

Goals:

- Keep feature onboarding additive and low-risk.
- Preserve family and tenant boundaries.
- Route external credential setup through owner-managed integrations.
- Keep feature UI and API ownership isolated from base product modules.

## Scope

This convention applies to:

- New feature PRDs.
- Feature-related schema and migration changes.
- Feature-owned routes, routers, and activation wiring.

## Feature Toggle Modeling

Use a family-scoped feature toggle model:

- Prisma model: `Ffeature` (mapped to table `Feature`).
- Feature identity: `familyId` + `featureKey`.
- Enablement field: `isEnabled`.

Rules:

- Feature rows are family-scoped only.
- Never use global feature enablement across families.
- Keep feature setup additive rather than rewriting core models.

## Additive Migration-First Approach

Feature groundwork must ship through additive migrations:

- Add new tables, indexes, and columns before behavior depends on them.
- Avoid destructive schema operations in initial feature groundwork.
- Do not pre-register/seed concrete feature rows unless explicitly required by a PRD.

## Secrets and Integration Prerequisites

Feature modules must not collect secrets directly.

Rules:

- Secrets and credentials are owner-managed in `/settings/integrations`.
- Feature setup must direct owners to `/settings/integrations` when prerequisites are missing.
- Feature APIs and pages should return remediation guidance instead of failing silently.

## Feature Readiness Lifecycle

All features must model:

- Enabled: feature toggle is on.
- Ready: dependencies (integrations/setup/permissions) are satisfied.

Behavior requirements:

- Enabled + Ready: full UI/API access.
- Enabled + Not Ready: show clear remediation paths.
- Not Enabled: hide/disable feature entry points from default navigation.

## Route Taxonomy and Ownership

UI ownership:

- Base/core routes remain under `src/app/(app)`.
- Feature-owned routes live under `src/app/(app)/(ffeatures)`.
- Route groups are organizational and should not change public URL shape.

Settings ownership for feature toggles:

- Feature implementations must provide an explicit admin/owner settings surface for toggling feature activation on/off per family.
- Default location: `/settings/ffeatures` under `src/app/(app)/settings/ffeatures/page.tsx`.
- This settings surface is separate from feature-owned pages under `(ffeatures)` and exists to make activation state discoverable and manageable.

## API Taxonomy and Ownership

Backend ownership:

- Base/core routers remain under `src/server/api/routers/*` and existing top-level `appRouter` keys.
- Feature routers live under `src/server/api/routers/ffeatures/*`.
- `appRouter` should expose a dedicated feature namespace (for example `ffeatures`) to avoid mixing with base router concerns.

## Feature Activation Contract

Feature wiring should use a single activation map/registry, not scattered conditionals.

Implementation anchor points:

- Shared activation contract and resolver live in `src/lib/ffeatures/activation.ts`.
- Feature-aware app-shell navigation in `src/components/nav/*` must compose feature links from activation metadata, not hardcoded feature arrays.
- Feature API namespace is exposed under `appRouter.ffeatures` from `src/server/api/routers/ffeatures/*`.
- Right-sidebar optional feature entries are composed from activation metadata.

Settings toggle requirements:

- The settings toggle surface must read/write activation state through the feature API namespace (`appRouter.ffeatures`).
- Toggle actions must be role-gated to owner/admin capabilities for the active family context.
- Non-authorized users must receive explicit remediation/permission messaging rather than silent failure.

Minimum activation contract fields:

- `featureKey`
- `isEnabled`
- `isReady`
- `requiredIntegrations`
- `navigation` metadata
- `routeRoot` (under `(ffeatures)`)
- `routerNamespace` (under feature API namespace)
- optional `componentExtensionPoints`
- optional `rightSidebarEntry`

## Component Integration Points

Features may integrate through:

- Feed/timeline overlays.
- Composer extensions.
- Settings panels.
- Route-local feature banners/CTAs.
- Optional right-sidebar entries.

Enabled-but-not-ready features must show remediation and never silently no-op when users reach UI/API entry points.

Route and component gating rule:

- Feature route groups under `src/app/(app)/(ffeatures)` should render only when activation state allows access.
- If a feature is enabled but not ready, UI should render remediation prompts and links to `/settings/integrations` instead of hiding context.
- Feature-aware components must read shared activation state before rendering links, buttons, and empty states.

## Recommended Rollout Checklist

For every new feature implementation:

1. Additive schema migration.
2. Family-scoped toggle model updates.
3. Router authorization and readiness guards.
4. Admin/owner settings toggle route under `/settings/ffeatures`.
5. Feature routes under `src/app/(app)/(ffeatures)`.
6. Activation-driven navigation and entry-point gating.
7. Integration dependency messaging to `/settings/integrations`.
8. Remediation behavior for enabled-but-not-ready state.
9. Targeted tests for routing, guards, readiness, and toggle actions.
10. Lint, typecheck, and touched tests pass.

## Events Mapping Example (No Implementation)

This example maps conventions to a future Events feature.

Potential additive schema direction:

- Add `Event` model with family scoping and event metadata.
- Add a post association table (for example `PostEventLink`) to connect events with timeline posts.
- Keep all event-related models indexed for family-scoped access patterns.

Ownership and wiring:

- UI routes: `src/app/(app)/(ffeatures)/events/*`
- API routers: `src/server/api/routers/ffeatures/events/*`
- API namespace exposure: feature namespace in `appRouter` (for example `appRouter.ffeatures.events`)

Readiness behavior:

- If required integrations are missing, show remediation and direct owners to `/settings/integrations`.
- Do not silently fail when enabled users reach Events entry points.
