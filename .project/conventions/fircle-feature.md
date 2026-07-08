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

## Relational Schema and Join Practices

When a feature introduces tables that relate to core entities (for example `FamilyMember`, `Post`, `Comment`, `Family`), apply the following rules.

Relational ownership and scope:

- Feature-owned rows must stay family-scoped.
- If a feature row references a member-scoped entity, include `familyId` on the feature table unless there is a documented exception in the PRD.
- Add explicit foreign keys for each relationship. Do not rely on inferred application-only relationships.

Foreign key delete behavior:

- Use `onDelete: Cascade` when feature rows are owned by the referenced parent and should be removed with it.
- Use `onDelete: SetNull` only for optional historical references that should survive parent deletion (for example actor/audit links).
- Document delete semantics in the feature PRD when a table has more than one foreign key.

Join-table modeling:

- Use dedicated join tables for many-to-many relationships instead of storing arrays/blobs of foreign ids.
- Add composite uniqueness for join identity (for example `[leftId, rightId]`) to prevent duplicates.
- Add indexes for both foreign keys and for expected sort/filter paths.

Uniqueness and index strategy:

- Prefer family-scoped composite unique constraints over global unique constraints.
- Add indexes for actual query paths used by routers and pages, not only for foreign keys.
- For timeline/listing paths, add stable composite indexes that include family scope and deterministic ordering columns (for example `createdAt` and `id` as tie-breaker).

Tenant safety and join guards:

- Treat family boundary checks as mandatory in router procedures even when foreign keys exist.
- Mutations that connect feature rows to core rows must verify all related ids belong to the active family context.
- Cross-family joins must be considered invalid and should return explicit authorization/validation errors.

Migration rollout sequencing:

- Ship relational tables, constraints, and indexes first.
- Ship read/write behavior second, with guards and readiness checks.
- Ensure behavior remains safe when feature tables are empty.

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
2. Relational schema review for feature-owned tables:
	- family scope fields,
	- foreign keys and delete behavior,
	- join-table identity constraints,
	- query-path indexes.
3. Family-scoped toggle model updates.
4. Router authorization, family-boundary join checks, and readiness guards.
5. Admin/owner settings toggle route under `/settings/ffeatures`.
6. Feature routes under `src/app/(app)/(ffeatures)`.
7. Activation-driven navigation and entry-point gating.
8. Integration dependency messaging to `/settings/integrations`.
9. Remediation behavior for enabled-but-not-ready state.
10. Targeted tests for routing, guards, readiness, toggle actions, and relational integrity.
11. Lint, typecheck, and touched tests pass.

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
