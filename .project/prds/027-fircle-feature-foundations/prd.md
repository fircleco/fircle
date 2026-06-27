---
title: "Fircle Feature Foundations"
status: in-progress
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/026-base-right-sidebar-app-shell-placement/prd.md
    description: "Base app-shell right-sidebar placement that features can integrate into"
  - type: prd
    url: .project/prds/023-tenant-local-domain-resolution-and-auth-isolation/prd.md
    description: "Tenant and family boundary conventions that feature scoping must preserve"
  - type: prd
    url: .project/prds/025-owner-managed-object-storage-credentials/prd.md
    description: "Owner-managed integration credential model and settings surface"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` — when work begins on any phase.
>   - `completed` — when all tasks and acceptance criteria are done.
>   - `on-hold` — if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Fircle Feature Foundations

## Description

Fircle needs a stable groundwork for introducing future feature modules (for example Events) without high-risk schema churn or scattered conventions.

Today, feature enablement is not represented by a dedicated database model, and integration credential router validation is still hardcoded to a single category/provider path. This creates friction for adding feature toggles, wiring feature prerequisites, and extending owner-managed integrations safely.

This PRD introduces a foundational `Ffeature` model with no feature records pre-registered, migrates integration router input validation to registry-driven behavior, and codifies feature onboarding conventions in a dedicated project convention document.

It also establishes a UI route-isolation convention for feature-owned pages: any feature route introduced in the app must live under `src/app/(app)/(ffeatures)`, where `ffeatures` stands for Fircle Features.

In parallel, it establishes an API isolation convention for feature-owned backend procedures: feature routers should be grouped under a dedicated feature namespace and folder boundary instead of mixing directly with core/base routers.

Finally, it defines an activation lifecycle for enabled features so they can be wired into navigation, route entry points, and component extension points in a controlled way instead of being hardcoded into unrelated parts of the app.

The objective is to make future features additive and predictable: each feature can be introduced through isolated schema additions, explicit enablement state, and a clear dependency path to owner-managed integrations.

### Design Decisions

- **Feature model first, feature data later**: Add the `Ffeature` model now but do not seed or pre-register any concrete features in this PRD.
- **Family-scoped feature state**: `Ffeature` rows are scoped by `familyId` and `featureKey`, preserving strict tenant/family boundaries.
- **Registry-driven integration validation**: Remove hardcoded `z.literal("storage")` and `z.literal("r2")` assumptions from integration router inputs, deriving allowed category/provider combinations from the provider registry.
- **Integrations remain owner-managed source of truth**: Any feature requiring API keys or service credentials must point owners to `/settings/integrations` instead of collecting secrets inside feature-specific settings.
- **Feature route isolation via route groups**: Feature-owned UI routes must be implemented under `src/app/(app)/(ffeatures)` so they do not mix with base product routes in `src/app/(app)`.
- **Feature router isolation via namespace boundaries**: Feature-owned tRPC routers must live under a dedicated backend feature boundary (for example `src/server/api/routers/ffeatures/*`) and be mounted under a feature namespace in `appRouter`.
- **Feature activation must be explicit**: When a feature is enabled, its navigation links, route entry points, and component integrations must be resolved from a feature registry or feature activation map rather than being scattered across unrelated components.
- **Right sidebar is a placement integration point**: Feature modules may contribute optional right-sidebar entries through the activation layer, while baseline sidebar content can remain manually authored.
- **Convention as a first-class artifact**: Define a written implementation convention in `.project/conventions/fircle-feature.md` so future feature PRDs follow one consistent lifecycle.

### User Stories

- **As a** maintainer, **I want** a neutral feature model in the database, **so that** future features can be toggled without reworking existing core models.
- **As a** maintainer, **I want** integration router validation to be provider-registry-driven, **so that** new integration categories/providers can be added without repeating hardcoded validation logic.
- **As a** family owner, **I want** feature requirements to route credential setup to Integrations settings, **so that** all sensitive external credentials are managed in one owner-only place.
- **As a** contributor, **I want** feature routes to live under a dedicated app route group, **so that** feature modules stay visually and structurally separated from base app routes.
- **As a** contributor, **I want** feature routers to live under a dedicated API namespace, **so that** feature backend logic is clearly separated from core/base routers.
- **As a** contributor, **I want** enabled features to be wired through a single activation layer, **so that** navigation, routes, and component integrations stay consistent and discoverable.
- **As a** contributor, **I want** a documented feature convention, **so that** new feature PRDs and implementations follow a consistent, low-risk pattern.

## Implementation Plan

### Phase 1: Database Feature Groundwork

**Goal:** Introduce a family-scoped `Ffeature` model that supports future toggle-enabled modules without registering any feature yet.

#### Tasks

- [x] Add `Ffeature` model to `prisma/schema.prisma` with fields:
  - `id`, `familyId`, `featureKey`, `isEnabled`, `createdAt`, `updatedAt`.
- [x] Add relation from `Ffeature.familyId` to `Family.id` with cascade delete.
- [x] Add uniqueness/index constraints:
  - `@@unique([familyId, featureKey])`
  - index on `familyId`
  - index on `featureKey`
- [x] Create and apply migration for `Ffeature` model.
- [x] Ensure seeds do not create any `Feature` rows; no feature is pre-registered.
- [x] Ensure existing app behavior is unchanged when `Feature` table has zero rows.

### Phase 2: Registry-Driven Integration Router Validation

**Goal:** Replace hardcoded integration input literals with provider-registry-driven validation in integration APIs.

#### Tasks

- [x] Refactor input validation in `src/server/api/routers/integration.ts` to derive category/provider acceptance from `src/lib/integration-providers.ts`.
- [x] Replace hardcoded `supportedIntegrationCategorySchema` and `supportedIntegrationProviderSchema` with dynamic validation sourced from the provider registry.
- [x] Enforce valid category/provider pair semantics (provider must belong to selected category).
- [x] Preserve owner-only authorization semantics and existing mutation/query names.
- [x] Keep payload validation via provider registry schemas and return clear validation errors for invalid category/provider combinations.
- [x] Add/adjust tests for integration router input validation coverage:
  - accepts known registry entries,
  - rejects unknown category,
  - rejects provider not mapped to category.

### Phase 3: Feature Convention Documentation

**Goal:** Document a durable feature implementation convention for schema, toggles, integration prerequisites, and rollout flow.

#### Tasks

- [ ] Create `.project/conventions/fircle-feature.md`.
- [ ] Document required conventions for all future feature PRDs and implementations:
  - family-scoped feature toggle modeling,
  - additive migration-first approach,
  - feature-owned UI routes under `src/app/(app)/(ffeatures)`,
  - feature-owned API routers under a dedicated feature boundary (for example `src/server/api/routers/ffeatures/*`),
  - no direct secrets in feature settings,
  - integration prerequisites routed through `/settings/integrations`,
  - feature readiness concept (`enabled` vs `ready`).
- [ ] Document route taxonomy and ownership boundaries:
  - base/core product routes remain under `src/app/(app)`,
  - feature routes live under `src/app/(app)/(ffeatures)`,
  - route groups are organizational and should not change public URL shapes.
- [ ] Document API router taxonomy and ownership boundaries:
  - base/core routers remain in `src/server/api/routers/*` and top-level `appRouter`,
  - feature routers are grouped under `src/server/api/routers/ffeatures/*`,
  - `appRouter` exposes a dedicated feature namespace (for example `ffeatures`) to avoid mixing feature procedures with base router keys.
- [ ] Add recommended rollout checklist for new features:
  - schema additions,
  - router guards,
  - UI gating,
  - integration dependency messaging,
  - test expectations.
- [ ] Add an Events example mapping conventions to a concrete feature scenario (event model + post association pattern) without implementing Events itself.

### Phase 4: Feature Activation and UI/API Wiring

**Goal:** Define how enabled features are surfaced across navigation, route groups, backend routers, and component integration points.

#### Tasks

- [ ] Define a feature activation contract that exposes, at minimum:
  - `featureKey`,
  - `isEnabled`,
  - `isReady`,
  - required integrations,
  - UI navigation metadata,
  - route group root,
  - backend router namespace,
  - optional component extension points,
  - optional right-sidebar entry metadata.
- [ ] Add a feature-aware navigation convention for `src/components/nav/*` so feature links are composed from the activation contract rather than hardcoded into base navigation arrays.
- [ ] Define how feature route groups under `src/app/(app)/(ffeatures)` surface in the app shell and are hidden or disabled when a feature is not ready.
- [ ] Define how backend feature routers under `src/server/api/routers/ffeatures/*` are exposed through the API root without mixing them into base router concerns.
- [ ] Define how feature modules can contribute optional entries to the base right sidebar introduced in PRD 026 without requiring a standalone widget framework.
- [ ] Document component integration points for features, including at least:
  - feed/timeline overlays,
  - composer extensions,
  - settings panels,
  - route-local feature banners or CTAs,
  - right-sidebar entries.
- [ ] Require feature pages and feature-aware components to use the shared activation state when deciding whether to render links, buttons, empty states, or integration prompts.
- [ ] Add a clear rule that enabled-but-not-ready features should surface remediation, not silent failure, especially when integrations are missing.

### Phase 5: Verification and Safety Checks

**Goal:** Ensure groundwork changes are safe and backward-compatible.

#### Tasks

- [ ] Run `pnpm lint`, `pnpm typecheck`, and relevant tests for touched modules.
- [ ] Verify integration settings page behavior is unchanged for existing storage/r2 flow.
- [ ] Verify no runtime path requires `Ffeature` rows to exist.
- [ ] Confirm migration is additive and does not alter existing feature data models.

## Acceptance Criteria

- [x] `Ffeature` model exists in Prisma schema with family-scoped uniqueness on `(familyId, featureKey)`.
- [x] Migration for `Ffeature` is additive and applied successfully.
- [x] No concrete feature records are seeded or pre-registered by this PRD.
- [x] Integration router category/provider input validation is registry-driven, not hardcoded.
- [x] Integration router rejects invalid category/provider combinations with clear errors.
- [x] Existing storage/r2 integration behavior remains functional after validation refactor.
- [ ] `.project/conventions/fircle-feature.md` exists and defines the feature lifecycle conventions, including integration prerequisite handling via `/settings/integrations`.
- [ ] Feature route-group convention is documented and enforced in convention guidance: feature-owned routes are placed under `src/app/(app)/(ffeatures)` and base routes remain in `src/app/(app)`.
- [ ] Feature API router convention is documented and enforced in convention guidance: feature-owned routers are placed under a dedicated backend feature boundary (for example `src/server/api/routers/ffeatures/*`) and mounted under a feature namespace in `appRouter`.
- [ ] Feature activation conventions are documented so enabled features can wire navigation, route entry points, and component integrations through a single activation layer.
- [ ] Feature activation conventions define optional right-sidebar contributions for feature modules that compose into the base sidebar from PRD 026.
- [ ] Enabled-but-not-ready features surface remediation paths rather than silent failures when UI or API entry points are reached.
- [ ] Convention doc includes an Events example and rollout checklist.
- [ ] Lint, typecheck, and targeted tests pass for touched areas.
