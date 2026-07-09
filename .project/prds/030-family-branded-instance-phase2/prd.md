---
title: "Family Branded Instance Phase 2 - Logotype Fonts via Family brandingConfig"
status: completed
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/029-family-branded-instance-phase1/prd.md
    description: "Phase 1 host-aware branding baseline across app, PWA, metadata, and email"
  - type: prd
    url: .project/prds/004-family-identity-static-ui/prd.md
    description: "Family identity settings ownership and user-facing family profile foundations"
  - type: pr
    url: https://github.com/fircle-app/fircle/pull/50
    description: "Implementation pull request - feat(branding): family logotype personalization"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` - when work begins on any phase.
>   - `completed` - when all tasks and acceptance criteria are done.
>   - `on-hold` - if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Family Logotype Branding Phase 2 - Family brandingConfig Font Personalization

## Description

Phase 1 established host-aware family branding across shell, metadata, PWA, and email. Phase 2 keeps that baseline and introduces family-level text logotype personalization in selected app surfaces.

This revision intentionally moves logotype persistence to the `Family` model using a single expandable `brandingConfig` field. Logotype personalization is managed through owner/admin Family Settings and rendered directly from Family branding data.

In scope:
- Family logotype personalization driven by a provided allowlist of font names loaded from `api.fonts.coollabs.io`.
- Family-scoped persistence of branding state via `Family.brandingConfig`.
- Owner/admin management in Family Settings using existing role guards and tRPC patterns.
- App-provided fallback rendering when brandingConfig is unset/invalid with explicit behavior for nav and membership guard surfaces.
- Rollout to selected shell/loading surfaces with deterministic fallback to current lockup.

Out of scope:
- Font uploads, SVG uploads, or generated image logos.
- Runtime free-text font names that are not in the provided allowlist.
- Landing repository changes.

### Design Decisions

- **Single expandable branding field**: Use one Family-level `brandingConfig` payload for current and future branding options.
- **Allowlisted font names as source of truth**: The app consumes a provided list of font names and only those names can be selected.
- **api.fonts.coollabs.io delivery**: Approved font names are loaded from `api.fonts.coollabs.io`, not bundled local font files.
- **Schema is additive and safe**: Introduce `brandingConfig` as nullable first; no destructive migration steps in this phase.
- **Versioned payload contract**: Include a version key in `brandingConfig` to support future additions (for example colors) without schema churn.
- **No Ffeature path for branding**: Branding read/write must come from `Family.brandingConfig` only.
- **Lockup update prework first**: Before Phase 2 implementation tasks, standardize lockup wording from `FamilyName on Fircle` to `The FamilyName Fircle`.
- **Fallback first with surface rules**: When logotype is not enabled, nav surfaces fall back to `Fircle` text with favicon, and membership guard loading area renders no logo mark while keeping `Powered by Fircle` unchanged.
- **Surface-scoped rollout**: Apply only to approved shell/loading placements to reduce regressions.

### User Stories

- **As a** family owner/admin, **I want** to select a logotype font from a provided list, **so that** our family space has a stronger visual identity without asset uploads.
- **As a** family member, **I want** key app shell surfaces to reflect our family logotype styling, **so that** the instance feels personalized.
- **As a** maintainer, **I want** branding state centralized in one expandable Family field, **so that** future brand options (for example color) do not require repeated schema additions.
- **As a** maintainer, **I want** app-provided fallback visuals when brandingConfig is missing or invalid, **so that** user experience remains stable.

## Provided Font List and brandingConfig Model

Use a provided allowlist of font names (operator-defined) and persist branding preferences per family in `Family.brandingConfig`.

Font list contract:
- Source: `api.fonts.coollabs.io`
- Input: array of font names provided at configuration time
- Seed file for this phase: `.project/prds/030-family-branded-instance-phase2/font-names.json`
- Validation: only allowlist members are selectable

Font loading contract:
- Preconnect must be added for `https://api.fonts.coollabs.io`.
- Stylesheet URL format must follow:
  - `https://api.fonts.coollabs.io/css2?family=<URL_ENCODED_FONT_NAME>&display=swap`
- Example:
  - `<link rel="preconnect" href="https://api.fonts.coollabs.io" crossorigin />`
  - `<link href="https://api.fonts.coollabs.io/css2?family=Manufacturing+Consent&display=swap" rel="stylesheet" />`

brandingConfig contract (initial version):
```json
{
  "version": 1,
  "logotype": {
    "enabled": true,
    "fontName": "Manufacturing Consent",
    "fontProvider": "api.fonts.coollabs.io"
  }
}
```

Resolution rules:
- `brandingConfig` null/missing/invalid: render app-provided fallback lockup behavior from brand context.
- `brandingConfig.logotype.enabled=false`: render app-provided fallback lockup behavior.
- `brandingConfig.logotype.enabled=true` + allowlisted `fontName`: render text logotype with that font loaded from `api.fonts.coollabs.io`.
- Non-allowlisted `fontName`: ignore font selection and render app-provided fallback; show remediation in Family Settings.

Fallback behavior by surface:
- Navigation surfaces (`desktop-sidebar`, `mobile-header`, mobile menu header): render `Fircle` text with favicon when logotype is not enabled.
- Membership guard loading footer: render no logo mark when logotype is not enabled.
- `Powered by Fircle` copy in membership guard remains unchanged in all states.

## Prework: Lockup Baseline Alignment

This prework must be completed before implementation phases below.

Prework objective:
- Update family lockup baseline wording from `FamilyName on Fircle` to `The FamilyName Fircle`.
- Apply the same lockup wording update to metadata and email branding surfaces that currently use family lockup text.

Lockup composition specification (must be implemented exactly):
- Content structure: `The FamilyName Fircle`.
- `FamilyName`: rendered with selected custom logotype font.
- `The`: rendered in app sans, smaller scale, visually positioned at the top-left of the `FamilyName` lockup.
- `Fircle`: rendered in app sans, smaller scale, visually positioned at the bottom-right of the `FamilyName` lockup.
- `The` and `Fircle` must not inherit the selected custom logotype font.

Prework tasks:
- [x] Update brand lockup resolver output in [src/lib/brand-context.ts](src/lib/brand-context.ts) to emit `The FamilyName Fircle` for family lockup contexts.
- [x] Update canonical lockup formatter behavior in [src/lib/family-name.ts](src/lib/family-name.ts) to emit `The FamilyName Fircle` where family lockup text is generated.
- [x] Update existing lockup assertions in [test/lib/brand-context.test.ts](test/lib/brand-context.test.ts) to match the new wording.
- [x] Add lockup composition helper/component API that separates `the`, `familyName`, and `fircle` segments for structured rendering in [src/lib/brand-context.ts](src/lib/brand-context.ts) and/or [src/components/nav](src/components/nav).
- [x] Update metadata lockup outputs to use `The FamilyName Fircle` where family lockup text is used in [src/app/layout.tsx](src/app/layout.tsx).
- [x] Update manifest generator lockup outputs to use `The FamilyName Fircle` where family lockup text is used in [src/app/manifest.json/route.ts](src/app/manifest.json/route.ts).
- [x] Update transactional email lockup wording/templates to use `The FamilyName Fircle` where family lockup text is used in [src/server/email/templates.ts](src/server/email/templates.ts).
- [x] Update auth route lockup usage to reflect the prework wording in [src/app/auth/page.tsx](src/app/auth/page.tsx), [src/app/auth/signin/page.tsx](src/app/auth/signin/page.tsx), and [src/app/auth/setup/page.tsx](src/app/auth/setup/page.tsx).
- [x] Update auth UI components receiving `primaryLockup` to reflect the prework wording in [src/components/auth/signin-form.tsx](src/components/auth/signin-form.tsx) and [src/components/auth/first-family-setup-form.tsx](src/components/auth/first-family-setup-form.tsx).
- [x] Update PWA install prompt lockup usage to reflect the prework wording in [src/components/pwa/pwa-install-prompt.tsx](src/components/pwa/pwa-install-prompt.tsx).
- [x] Update router-level lockup/fallback copy usage in [src/server/api/routers/invite.ts](src/server/api/routers/invite.ts) and [src/server/api/routers/family-member.ts](src/server/api/routers/family-member.ts).
- [x] Add/adjust metadata assertions for lockup wording in [test/app/layout-metadata.test.ts](test/app/layout-metadata.test.ts).
- [x] Add/adjust manifest assertions for lockup wording in [test/app/brand-route-wiring.test.ts](test/app/brand-route-wiring.test.ts).
- [x] Add/adjust email template assertions for lockup wording in [test/server/email/templates.test.ts](test/server/email/templates.test.ts).
- [x] Add/adjust auth and install prompt assertions for lockup wording in [test/app/brand-route-wiring.test.ts](test/app/brand-route-wiring.test.ts).

Prework lockup touch matrix (must be verified complete before Phase 1 implementation):
- Core lockup logic: [src/lib/brand-context.ts](src/lib/brand-context.ts), [src/lib/family-name.ts](src/lib/family-name.ts)
- App metadata and manifest: [src/app/layout.tsx](src/app/layout.tsx), [src/app/manifest.json/route.ts](src/app/manifest.json/route.ts)
- Auth routes and auth components: [src/app/auth/page.tsx](src/app/auth/page.tsx), [src/app/auth/signin/page.tsx](src/app/auth/signin/page.tsx), [src/app/auth/setup/page.tsx](src/app/auth/setup/page.tsx), [src/components/auth/signin-form.tsx](src/components/auth/signin-form.tsx), [src/components/auth/first-family-setup-form.tsx](src/components/auth/first-family-setup-form.tsx)
- PWA install copy: [src/components/pwa/pwa-install-prompt.tsx](src/components/pwa/pwa-install-prompt.tsx)
- Transactional/email and related router copy: [src/server/email/templates.ts](src/server/email/templates.ts), [src/server/api/routers/invite.ts](src/server/api/routers/invite.ts), [src/server/api/routers/family-member.ts](src/server/api/routers/family-member.ts)
- Test coverage: [test/lib/brand-context.test.ts](test/lib/brand-context.test.ts), [test/app/layout-metadata.test.ts](test/app/layout-metadata.test.ts), [test/app/brand-route-wiring.test.ts](test/app/brand-route-wiring.test.ts), [test/server/email/templates.test.ts](test/server/email/templates.test.ts)

## Implementation Plan

### Phase 1: Schema Expansion and Payload Contract

**Goal:** Introduce a safe, expandable Family branding payload and validation contract.

#### Tasks

- [x] Add nullable `brandingConfig` field to `Family` model in [prisma/schema.prisma](prisma/schema.prisma) using JSON type.
- [x] Create and apply additive migration for new `brandingConfig` field under [prisma/migrations](prisma/migrations).
- [x] Add typed branding schema validator (zod) for `brandingConfig` in [src/lib/branding/branding-config.ts](src/lib/branding/branding-config.ts).
- [x] Add a provided font-list config module (font names + normalization helpers) in [src/lib/branding/logotype-fonts.ts](src/lib/branding/logotype-fonts.ts).
- [x] Add helper to generate safe `api.fonts.coollabs.io` stylesheet URLs for selected allowlisted fonts in [src/lib/branding/logotype-fonts.ts](src/lib/branding/logotype-fonts.ts).

### Phase 2: Owner/Admin Family Branding API

**Goal:** Manage logotype enablement and font selection through Family identity APIs with strict validation.

#### Tasks

- [x] Extend Family identity input/output schemas in [src/server/api/routers/invite.ts](src/server/api/routers/invite.ts) to include `brandingConfig`.
- [x] Validate `brandingConfig.logotype.fontName` against provided allowlist before save.
- [x] Reuse existing family membership role checks (OWNER or ADMIN) for branding writes.
- [x] Update management context response to include normalized brandingConfig output for consumers.
- [x] Ensure invalid payloads are rejected with clear validation errors.

### Phase 3: Family Settings Management UI

**Goal:** Allow owner/admin users to choose and preview logotype fonts from the provided `api.fonts.coollabs.io` list in existing Family Settings flow.

#### Tasks

- [x] Extend Family Settings data loading to include `brandingConfig` and provided allowlist metadata in [src/app/(app)/settings/family/page.tsx](src/app/(app)/settings/family/page.tsx).
- [x] Add font selector controls from the provided allowlist, with explicit default option (disable logotype) in [src/app/(app)/settings/family/page.tsx](src/app/(app)/settings/family/page.tsx).
- [x] Load preview font stylesheets from `api.fonts.coollabs.io` for selected allowlisted font names in [src/app/(app)/settings/family/page.tsx](src/app/(app)/settings/family/page.tsx).
- [x] Add live preview based on resolved selected font using existing family name context in [src/app/(app)/settings/family/page.tsx](src/app/(app)/settings/family/page.tsx).
- [x] Show remediation messaging when brandingConfig is invalid or fontName is not allowlisted.
- [x] Preserve existing settings permission and navigation behavior in [src/app/(app)/settings/layout.tsx](src/app/(app)/settings/layout.tsx).

### Phase 4: Surface Rollout Using Resolved Font

**Goal:** Apply resolved logotype font styling to approved shell/loading placements while preserving fallback lockup.

#### Tasks

- [x] Wire resolved selected font from `brandingConfig` into desktop sidebar brand rendering in [src/components/nav/desktop-sidebar.tsx](src/components/nav/desktop-sidebar.tsx).
- [x] Wire resolved selected font from `brandingConfig` into mobile center header and menu sheet header brand rendering in [src/components/nav/mobile-header.tsx](src/components/nav/mobile-header.tsx).
- [x] Wire resolved selected font from `brandingConfig` into membership loading footer brand rendering in [src/components/auth/membership-guard.tsx](src/components/auth/membership-guard.tsx).
- [x] Implement lockup layout rules in nav/membership logotype views: `The` top-left small sans, `FamilyName` custom font, `Fircle` bottom-right small sans.
- [x] Enforce nav fallback when logotype is not enabled: show `Fircle` text with favicon in [src/components/nav/desktop-sidebar.tsx](src/components/nav/desktop-sidebar.tsx) and [src/components/nav/mobile-header.tsx](src/components/nav/mobile-header.tsx).
- [x] Enforce membership guard fallback when logotype is not enabled: no logo mark is rendered while `Powered by Fircle` remains unchanged in [src/components/auth/membership-guard.tsx](src/components/auth/membership-guard.tsx).
- [x] Keep host-aware family lockup fallback behavior sourced from existing brand context where applicable in [src/lib/brand-context.ts](src/lib/brand-context.ts).
- [x] Ensure no branding reads depend on ffeatures paths for logotype selection.

### Phase 5: Verification and Regression Safety

**Goal:** Validate allowlisted font behavior, role guards, and branding fallback stability.

#### Tasks

- [x] Add tests for allowlist validation and `api.fonts.coollabs.io` URL generation in [test/lib/branding/logotype-fonts.test.ts](test/lib/branding/logotype-fonts.test.ts).
- [x] Add or extend brand-context/rendering tests for fallback lockup continuity when no logotype font is active in [test/lib/brand-context.test.ts](test/lib/brand-context.test.ts).
- [x] Add router-level tests for owner/admin mutation authorization and family scoping in [test/server/api/routers/invite.test.ts](test/server/api/routers/invite.test.ts).
- [x] Add tests for brandingConfig validation, normalization, and fallback behavior in [test/server/api/routers/invite.test.ts](test/server/api/routers/invite.test.ts).
- [x] Run `pnpm typecheck` and targeted tests for touched modules.
- [x] Run `pnpm lint`.
- [x] Perform manual checks for desktop/mobile shell placements and loading state rendering.

## Acceptance Criteria

- [x] Prework lockup alignment is completed: family lockup baseline reads `The FamilyName Fircle`.
- [x] Metadata lockup outputs that use family lockup text are updated to `The FamilyName Fircle`.
- [x] Manifest generator lockup outputs that use family lockup text are updated to `The FamilyName Fircle`.
- [x] Email lockup outputs that use family lockup text are updated to `The FamilyName Fircle`.
- [x] In logotype-enabled state, lockup composition is exact: `The` (small sans, top-left), `FamilyName` (selected custom font), `Fircle` (small sans, bottom-right).
- [x] Logotype personalization is represented through `Family.brandingConfig` only.
- [x] The font choices available to families are limited to a provided allowlist of font names loaded via `api.fonts.coollabs.io`.
- [x] Owner/admin users can manage logotype enablement and font selection through Family Settings and Family identity APIs.
- [x] Desktop sidebar, mobile header center, mobile menu sheet header, and membership loading footer apply resolved selected-font styling when active.
- [x] When logotype is not enabled, nav surfaces fall back to `Fircle` text with favicon.
- [x] When logotype is not enabled, membership guard loading area renders no logo mark while leaving `Powered by Fircle` untouched.
- [x] Unset, invalid, or conflicting font-selection states preserve fallback behavior and show remediation where applicable.
- [x] Existing Phase 1 host-aware metadata, PWA, and email branding behavior remains unaffected.
- [x] A single additive migration adds nullable `Family.brandingConfig` with no destructive schema changes.
- [x] Lint, typecheck, and targeted tests pass for touched areas.
