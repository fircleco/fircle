---
title: "Family-Branded Instance Phase 1 - Host-Aware App, PWA, and Email Identity"
status: draft
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/023-tenant-local-domain-resolution-and-auth-isolation/prd.md
    description: "Tenant-local host resolution, canonical host redirects, and auth isolation boundaries"
  - type: prd
    url: .project/prds/018-transactional-email-adapter-and-zeptomail-invite-claim/prd.md
    description: "Transactional email architecture and template/provider integration points"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` — when work begins on any phase.
>   - `completed` — when all tasks and acceptance criteria are done.
>   - `on-hold` — if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Family-Branded Instance Phase 1 - Host-Aware App, PWA, and Email Identity

## Description

Fircle currently resolves families by host and enforces tenant-local auth boundaries, but the user-facing brand is still largely global (hardcoded "Fircle") across app shell, auth surfaces, metadata, PWA install identity, and email copy.

This creates a mismatch for family-scoped instances: the technical isolation is tenant-aware, but the product identity is not.

This PRD defines Phase 1 of family branding: introduce host-aware brand rendering using existing family/domain data so each instance presents as **"{FamilyName} on Fircle"** without introducing white-label complexity.

In scope:
- Host-aware branding utility and lockup format (`FamilyName on Fircle`) for app surfaces.
- Tenant-aware metadata fields (title, application name, Open Graph/Twitter fields, apple web app title).
- Tenant-aware PWA identity (manifest-facing app name/description and install prompt copy).
- Family-branded transactional email wording and sender-name fallback behavior.
- Regression tests for brand resolution and key output surfaces.

Out of scope:
- New database schema or migration work.
- Per-family theme token systems (colors/typography) and advanced design customization.
- Full white-label mode that hides all Fircle identity.
- Landing repository changes.

### Design Decisions

- **No database changes in Phase 1**: Reuse existing `family.name`, `family.image`, and tenant/domain resolution outputs; no new columns or migration risk.
- **Single lockup format**: Use `FamilyName on Fircle` across shell/auth/metadata/email to avoid fragmented naming.
- **Shared server-side brand resolver**: Centralize host-to-brand derivation to prevent future hardcoded string drift.
- **Preserve tenant safety first**: Branding must not bypass canonical host redirect behavior or auth isolation from existing tenant resolution.
- **Progressive rollout scope**: Ship copy/meta/PWA/email first, then evaluate Phase 2 (themes/assets) only if needed.

### User Stories

- **As a** family member, **I want** the app to show my family identity in key UI and page metadata, **so that** the instance feels like my family's private space.
- **As a** family admin, **I want** invites and claim emails to reflect my family branding, **so that** recipients trust and recognize the source.
- **As a** self-hosted operator, **I want** host-specific branding to align with tenant mapping, **so that** custom domains feel coherent and professional.
- **As a** maintainer, **I want** branding logic in one resolver, **so that** future features do not reintroduce global hardcoded labels.

## First-Pass Decision Baseline (Pre-Task)

This decision is locked as a baseline before phase task execution.

- **Canonical storage rule:** `family.name` stores the base family name only (example: `Shittabey`), not prefixed/suffixed variants like `The Shittabey Family`.
- **Write-time normalization rule:** inputs are normalized at write boundaries by removing a leading `The` and trailing `Family`, and collapsing whitespace.
- **Display formatting rule:** user-facing copy may render relationship-style names through a formatter (example default: `The {Name} Family`) while preserving canonical stored values.
- **Brand lockup compatibility:** this naming rule coexists with the phase lockup format `FamilyName on Fircle`; lockup generation must consume normalized canonical names.
- **Data model impact:** no Prisma schema changes and no migration are required for this decision.

## Implementation Plan

### Phase 1: Brand Context and Shared Resolver

**Goal:** Establish a single source of truth for host/family brand values without schema changes.

#### Tasks

- [ ] Add a shared brand utility (for example `src/lib/brand-context.ts`) that resolves:
  - [ ] `familyDisplayName`
  - [ ] `primaryLockup` (`${familyDisplayName} on Fircle`)
  - [ ] `appDescription`
  - [ ] fallback behavior when family context is unavailable.
- [ ] Reuse existing tenant/domain resolution inputs from `src/lib/tenant-resolution.ts` and request headers.
- [ ] Add unit tests for mapped host, fallback host, and canonical-host scenarios.

### Phase 2: App Metadata and Shell Branding

**Goal:** Apply family-aware lockup in app shell and metadata surfaces.

#### Tasks

- [ ] Update `src/app/layout.tsx` metadata generation to use brand context for:
  - [ ] title template/default
  - [ ] `applicationName`
  - [ ] Open Graph title/siteName/description
  - [ ] Twitter title/description
  - [ ] Apple web app title.
- [ ] Replace hardcoded shell lockups in:
  - [ ] `src/components/nav/desktop-sidebar.tsx`
  - [ ] `src/components/nav/mobile-header.tsx`
  - [ ] `src/components/auth/membership-guard.tsx`.
- [ ] Update auth entry branding copy in:
  - [ ] `src/app/auth/page.tsx`
  - [ ] `src/app/auth/setup/page.tsx`
  - [ ] `src/components/auth/signin-form.tsx` (where applicable for headings/supporting text).

### Phase 3: PWA Identity and Install Surfaces

**Goal:** Ensure installable app identity reflects family branding by host.

#### Tasks

- [ ] Introduce host-aware manifest response route and transition static identity fields from `public/manifest.json` to dynamic generation.
- [ ] Preserve existing icon compatibility and service worker registration behavior.
- [ ] Update install prompt copy and alt text in `src/components/pwa/pwa-install-prompt.tsx` to use brand lockup.
- [ ] Update service worker fallback notification title in `public/sw.js` to align with lockup policy while preserving payload-provided titles.

### Phase 4: Email Brand Wording and Sender Behavior

**Goal:** Align transactional invite/claim communication with family-branded identity.

#### Tasks

- [ ] Update invite/claim template copy in `src/server/email/templates.ts` to use family-branded wording (`FamilyName on Fircle`) where appropriate.
- [ ] Ensure fallback sender display name logic in:
  - [ ] `src/server/api/routers/invite.ts`
  - [ ] `src/server/api/routers/family-member.ts`
  uses consistent Phase 1 brand language.
- [ ] Update `src/app/(dev)/email-preview/page.tsx` fixtures to reflect new expected copy.

### Phase 5: Validation and Regression Safety

**Goal:** Prevent branding regressions and confirm no tenant/auth behavior changes.

#### Tasks

- [ ] Add/extend tests for metadata and brand output on at least two host contexts.
- [ ] Verify key routes render branded lockup correctly, including:
  - [ ] app shell routes
  - [ ] auth routes
  - [ ] member profile route (`src/app/(app)/member/[slug]/page.tsx`).
- [ ] Run `pnpm lint`, `pnpm typecheck`, and relevant test suites.
- [ ] Validate there are no Prisma schema edits and no migration generation as part of this PRD.

## Acceptance Criteria

- [ ] Family-scoped hosts render a consistent primary lockup format: `FamilyName on Fircle` across app shell and auth headers.
- [ ] App metadata fields (title/application/Open Graph/Twitter/apple web app title) are host-aware and family-branded.
- [ ] PWA install identity (manifest-facing name/description and install prompt) is family-branded per host context.
- [ ] Transactional invite and claim email subject/body/header copy reflects family-branded identity.
- [ ] Existing tenant-local auth/domain isolation behavior remains unchanged.
- [ ] No Prisma schema changes or database migrations are introduced.
- [ ] Test coverage includes brand resolver behavior and at least one metadata/email assertion per new branding path.