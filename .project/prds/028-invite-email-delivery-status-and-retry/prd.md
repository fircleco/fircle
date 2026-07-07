---
title: "Invite and Claim Email Delivery Status with Retry Actions"
status: in-progress
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/008-unclaimed-member-creation-and-claim-flow/prd.md
    description: "Unclaimed member creation and claim-link lifecycle"
  - type: prd
    url: .project/prds/018-transactional-email-adapter-and-zeptomail-invite-claim/prd.md
    description: "Transactional email adapter behavior and current non-blocking send policy"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` — when work begins on any phase.
>   - `completed` — when all tasks and acceptance criteria are done.
>   - `on-hold` — if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Invite and Claim Email Delivery Status with Retry Actions

## Description

Invite and claim-link mutations currently treat email as best effort: domain writes succeed, send failures are logged, and the UI cannot distinguish between "email sent", "email skipped", and "email failed" states.

This creates silent failure UX in production, especially for member creation with auto-generated email-bound claim invites. Admins assume an email was dispatched when only the invite record exists.

This PRD introduces explicit delivery status contracts across invite and claim-link creation flows, UI indicators for real send outcome, and a retry action for failed send states.

In scope:
- Add structured per-request email delivery result to mutation responses.
- Show delivery status in add-member success UI and claim-link generation UI.
- Add retry action for failed sends (and optional support for skipped-send recoverability).
- Add operational telemetry for delivery outcomes and retry attempts.

Out of scope:
- Queue-based asynchronous delivery architecture.
- Guaranteed inbox delivery/open tracking.
- Multi-channel fallback delivery (SMS, push, etc.).

### Design Decisions

- **Domain writes remain non-blocking for email failures**: Invite and member creation persist even when email dispatch fails, preserving current safety and consistency expectations.
- **Explicit delivery contract over inferred config status**: UI should rely on the specific mutation result for that request, not only global provider readiness.
- **Three canonical states**: `sent`, `skipped`, and `failed` provide enough product clarity without exposing provider internals.
- **Retry is explicit user intent**: Retrying a failed send is user-triggered from UI rather than automatic background retries in this phase.
- **Retry reuses existing invite artifact**: Retry sends against the existing pending invite/claim link when still valid to avoid generating extra codes unless explicitly requested.
- **Safe error detail exposure**: API returns user-safe reason codes/messages; detailed provider errors remain in logs.

### User Stories

- **As a** family admin, **I want** to see whether invite email was actually sent, **so that** I do not mistakenly assume recipients were contacted.
- **As a** family admin, **I want** to retry failed invite email sends from the UI, **so that** I can recover quickly without recreating members or links.
- **As a** family admin, **I want** skipped-send cases to clearly explain why sending did not happen, **so that** I can fix configuration or share the link manually.
- **As a** maintainer, **I want** structured logs and metrics for send outcomes and retries, **so that** production incidents can be diagnosed quickly.

## Implementation Plan

### Phase 1: Delivery Status Contract and Shared Types

**Goal:** Define a single API contract for transactional email outcomes that all invite/claim mutations can return.

#### Tasks

- [x] Add a shared delivery result type in email domain (for example under `src/server/email/types.ts`) with:
  - [x] `status: "sent" | "skipped" | "failed"`
  - [x] `reasonCode` enum (for example `provider_not_configured`, `missing_from_address`, `base_url_unresolved`, `provider_error`)
  - [x] optional `message` (user-safe)
  - [x] optional provider metadata safe for client display (for example accepted timestamp only)
- [x] Add mapper utility to convert provider/no-provider/runtime outcomes into canonical delivery status.
- [ ] Add zod schema(s) if needed for response validation at UI boundaries.

### Phase 2: Backend Integration for Create Flows

**Goal:** Return explicit delivery outcomes from all invite and claim-link creation entry points.

#### Tasks

- [x] Update `createUnclaimedMember` in [src/server/api/routers/family-member.ts](src/server/api/routers/family-member.ts) to include `emailDelivery` on response when claim invite is email-bound.
- [x] Update `createClaimLink` in [src/server/api/routers/family-member.ts](src/server/api/routers/family-member.ts) to include `emailDelivery`.
- [x] Update `createInvite` in [src/server/api/routers/invite.ts](src/server/api/routers/invite.ts) to include `emailDelivery`.
- [x] Preserve current non-blocking write behavior while replacing silent catch-only handling with explicit status assignment.
- [x] Ensure no-email flows return `emailDelivery: null` (or omitted) consistently.

### Phase 3: Retry Email Send API

**Goal:** Provide a secure, permission-checked retry endpoint for failed send states.

#### Tasks

- [ ] Add protected retry mutation(s) (for example `retryInviteEmailSend`) in [src/server/api/routers/invite.ts](src/server/api/routers/invite.ts) and/or [src/server/api/routers/family-member.ts](src/server/api/routers/family-member.ts).
- [ ] Validate retry eligibility:
  - [ ] invite exists and belongs to caller-managed family
  - [ ] invite is pending, not revoked, and not expired
  - [ ] invite is email-bound with recipient email present
- [ ] Return same `emailDelivery` contract for retry result.
- [ ] Add rate limiting for retry endpoint to prevent abuse.
- [ ] Record retry attempt metadata in logs (and DB if a delivery-attempt model already exists or is introduced here).
- [ ] Define product behavior for skipped retries:
  - [ ] If recoverable (for example config fixed), retry can transition to `sent`.
  - [ ] If still non-recoverable, return `skipped` with actionable reason.

### Phase 4: UI Indicators and Retry Actions

**Goal:** Surface send outcomes clearly and allow in-context retry from affected screens.

#### Tasks

- [ ] Update add-member success state in [src/app/(app)/members/new/page.tsx](src/app/(app)/members/new/page.tsx) to show:
  - [ ] success indicator for `sent`
  - [ ] warning indicator for `skipped` with reason
  - [ ] error indicator for `failed` with retry button
- [ ] Update claim-link generation dialog in [src/components/members/generate-claim-link-dialog.tsx](src/components/members/generate-claim-link-dialog.tsx) with equivalent status UI and retry action.
- [ ] Update invite management creation flows in [src/app/(app)/settings/invites/page.tsx](src/app/(app)/settings/invites/page.tsx) to display delivery status after invite creation and support retry when `failed`.
- [ ] Ensure retry button has loading, success, and error states, and does not hide manual copy-link fallback.
- [ ] Add concise user-facing copy for each reason code.

### Phase 5: Observability, Tests, and Rollout Safety

**Goal:** Ensure behavior is testable, diagnosable, and safe in production.

#### Tasks

- [ ] Add/extend router tests for `sent`, `skipped`, and `failed` outcomes in:
  - [ ] `test/server/api/routers/family-member.test.ts`
  - [ ] `test/server/api/routers/invite.test.ts`
- [ ] Add tests for retry mutation success and rejection cases (expired/revoked/non-email-bound/no-permission).
- [ ] Add UI tests for status rendering and retry action behavior in member and invite surfaces.
- [ ] Standardize structured log events for delivery outcomes and retries (`attempt`, `succeeded`, `failed`, `skipped`).
- [ ] Run `pnpm lint`, `pnpm typecheck`, and targeted test suites before completion.

## Acceptance Criteria

- [ ] Creating unclaimed member with email-bound invite returns explicit email delivery result (`sent`, `skipped`, or `failed`) in API response.
- [ ] Creating claim link with optional email binding returns explicit email delivery result when email-bound.
- [ ] Creating invite in invite settings returns explicit email delivery result when email-bound.
- [ ] Add-member success UI clearly indicates real delivery outcome and does not imply sent status when skipped/failed.
- [ ] Claim-link generation UI clearly indicates real delivery outcome and offers retry for failed states.
- [ ] Invite settings creation UI clearly indicates real delivery outcome and offers retry for failed states.
- [ ] Retry action is permission-checked, rate-limited, and rejects invalid invite states.
- [ ] Retrying a previously failed send can transition to `sent` when configuration/provider conditions are corrected.
- [ ] Structured logs exist for initial send attempts and retry attempts with actionable context.
- [ ] Existing domain writes remain successful even when send fails; no regression in invite/member creation persistence.
