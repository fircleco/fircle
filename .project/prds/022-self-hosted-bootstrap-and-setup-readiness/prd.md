---
title: "Self-Hosted Bootstrap Routing and Setup Readiness"
status: completed
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/007-invite-only-registration-flow/prd.md
    description: "Existing auth and invite registration flow that setup bootstrapping must complement"
  - type: prd
    url: .project/prds/020-web-push-notifications-and-pwa-enablement/prd.md
    description: "Push/VAPID behavior and environment requirements relevant to setup readiness checks"
  - type: pr
    url: https://github.com/fircle-app/fircle/pull/35
    description: "Implementation pull request - feat(self-hosting): implement family bootstrap setup"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` — when work begins on any phase.
>   - `completed` — when all tasks and acceptance criteria are done.
>   - `on-hold` — if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Self-Hosted Bootstrap Routing and Setup Readiness

## Description

Fresh self-hosted installations currently route unauthenticated users to sign-in, even when no family/user exists yet. This creates a dead-end first-run experience.

This PRD introduces a self-host-aware bootstrap flow:
- When running in self-host mode and no family exists, unauthenticated entry routes to setup.
- Setup provides infrastructure readiness diagnostics (DB, storage, VAPID, required keys) before allowing first-family creation.
- Setup and bootstrap concerns move out of the invite router into a dedicated setup router to keep domain boundaries clean.

### Design Decisions

- **Self-host mode gate via `SELF_HOSTED`**: Feature behavior is controlled by a dedicated env flag with default `true`, so forks/self-host instances work out-of-the-box while managed deployments can opt out.
- **Setup domain separation**: Move bootstrap/setup endpoints from `inviteRouter` into a dedicated setup router (for example `setupRouter`) to avoid mixing concerns.
- **Structured readiness responses**: Setup diagnostics return normalized check results (`ok`, `warning`, `blocking`) and remediation hints instead of raw infrastructure exceptions.
- **One-time bootstrap integrity**: First-family creation remains single-use and conflict-protected after the first family exists.
- **Active readiness probes over config-only checks**: Critical dependencies are validated through real runtime probes (fresh DB connect/query, R2 bucket access, VAPID key compatibility, transactional email auth handshake) to avoid false positives from stale processes or env-only presence checks.

### User Stories

- **As a** self-hosted operator, **I want** first-time installs to open setup instead of sign-in, **so that** I can initialize the instance without dead-end auth prompts.
- **As a** self-hosted operator, **I want** setup to tell me exactly which dependencies are misconfigured, **so that** I can fix infrastructure quickly.
- **As a** maintainer, **I want** setup logic separated from invite logic, **so that** code ownership and future changes remain clear.
- **As a** platform operator, **I want** managed mode to skip self-host bootstrap behavior, **so that** hosted deployments keep standard auth routing.

## Implementation Plan

### Phase 1: Bootstrap Foundation (Already Implemented)

**Goal:** Establish first-family setup primitives and a setup UI entry point.

#### Tasks

- [x] Add setup form page at [src/app/auth/setup/page.tsx](src/app/auth/setup/page.tsx).
- [x] Add first-family setup validation schema in [src/lib/invite-schemas.ts](src/lib/invite-schemas.ts).
- [x] Add bootstrap status and bootstrap mutation in [src/server/api/routers/invite.ts](src/server/api/routers/invite.ts).
- [x] Add setup entry action from auth landing in [src/app/auth/page.tsx](src/app/auth/page.tsx).
- [x] Document first-time setup route in [README.md](README.md).

### Phase 2: Self-Hosted Mode Gating and Redirects

**Goal:** Route fresh self-hosted installs to setup automatically while preserving non-self-host behavior.

#### Tasks

- [x] Add `SELF_HOSTED` parsing with safe boolean semantics and default `true` in [src/env.js](src/env.js).
- [x] Update unauthenticated redirect logic in [src/app/(app)/layout.tsx](src/app/(app)/layout.tsx):
  - `SELF_HOSTED=true` and no family -> `/auth/setup`
  - otherwise -> `/auth/signin?callbackUrl=...`
- [x] Add direct signin guard in [src/app/auth/signin/page.tsx](src/app/auth/signin/page.tsx) to reroute first-run self-host installs to setup.
- [x] Ensure `SELF_HOSTED=false` bypasses bootstrap redirect checks.

### Phase 3: Setup Router Extraction (Invite Router Decoupling)

**Goal:** Move setup/bootstrap API concerns into a dedicated router.

#### Tasks

- [x] Create [src/server/api/routers/setup.ts](src/server/api/routers/setup.ts) for:
  - bootstrap status
  - first-family bootstrap mutation
  - setup readiness checks
- [x] Move setup input schemas into setup-focused schema module (for example [src/lib/setup-schemas.ts](src/lib/setup-schemas.ts)).
- [x] Remove setup endpoints from [src/server/api/routers/invite.ts](src/server/api/routers/invite.ts) after migration.
- [x] Register setup router in [src/server/api/root.ts](src/server/api/root.ts) and update frontend callers from `api.invite.*` to `api.setup.*`.
- [x] Preserve behavior compatibility during transition to avoid frontend breakage.

### Phase 4: Setup Readiness Diagnostics

**Goal:** Surface actionable infra readiness checks before setup submission.

#### Tasks

- [x] Add `getSetupReadiness` query in setup router with structured results for:
  - Database connectivity and query viability via fresh Prisma client connect + `SELECT 1`
  - Required env presence (`AUTH_SECRET`, storage keys, etc.)
  - R2 storage credentials and bucket reachability probe (`HeadBucket`)
  - VAPID configuration sanity (presence + runtime key/subject compatibility validation)
  - Optional transactional email provider credential validation when configured (ZeptoMail auth probe)
- [x] Add remediation text per failure in API response.
- [x] Update [src/app/auth/setup/page.tsx](src/app/auth/setup/page.tsx) to render readiness checklist and disable submit on blocking failures.
- [x] Ensure readiness checks are self-host-only (return not-applicable or bypass when `SELF_HOSTED=false`).

### Phase 5: Validation and Hardening

**Goal:** Verify flow behavior across fresh, configured, and managed modes.

#### Tasks

- [x] Add/adjust tests for first-run redirect and setup-routing branches.
- [x] Verify fresh self-host flow manually:
  - open app root -> redirected to setup
  - failed readiness prevents submit
  - invalid DB/storage/VAPID/email credentials surface actionable blocking or warning states
  - successful setup creates family/owner and signs in
- [x] Verify post-bootstrap behavior:
  - setup route indicates already configured
  - unauthenticated root redirects to sign-in
- [x] Verify managed mode (`SELF_HOSTED=false`) retains standard sign-in behavior.
- [x] Run `pnpm typecheck` and `pnpm lint` for touched areas.

## Acceptance Criteria

- [x] Fresh self-hosted instances no longer dead-end on sign-in; they are redirected to setup automatically.
- [x] Setup page provides clear readiness status for DB, storage, VAPID, email provider, and required keys.
- [x] Setup submission is blocked when any readiness check is `blocking`.
- [x] Readiness checks use active runtime probes and do not rely on env presence only for DB/storage/VAPID/email validity.
- [x] Setup/bootstrap concerns are removed from invite router and hosted in a dedicated setup router.
- [x] Existing invite functionality remains intact after router extraction.
- [x] `SELF_HOSTED=false` deployments do not run self-host bootstrap redirect behavior.
- [x] Documentation reflects operator setup flow and troubleshooting guidance.

## Further Considerations

- Add optional post-bootstrap lockout behavior for `/auth/setup` in production except for explicit maintenance mode.
- Reuse setup router readiness framework for future subdomain-family slug provisioning checks.
