---
title: "Reusable Family Onboarding Invite Link with Reset Rotation"
status: in-progress
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/007-invite-only-registration-flow/prd.md
    description: "Baseline invite lifecycle, acceptance, and admin invite management"
  - type: prd
    url: .project/prds/028-invite-email-delivery-status-and-retry/prd.md
    description: "Current invite email delivery contracts and retry behavior"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` — when work begins on any phase.
>   - `completed` — when all tasks and acceptance criteria are done.
>   - `on-hold` — if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Reusable Family Onboarding Invite Link with Reset Rotation

## Description

Fircle currently treats join invites as single-use: after one successful acceptance, the invite transitions to claimed and is no longer valid. In practice, family admins often need one stable onboarding link that can be shared with multiple incoming members over time.

This PRD introduces a reusable onboarding invite link for join invites only. The link can be used by multiple people, and admins can reset (rotate) the link at any time. Resetting creates a new active code and invalidates the previous one.

This feature is additive and preserves existing behavior for:
- Single-use join invites (still supported in parallel)
- Claim links for unclaimed member profiles (unchanged)

In scope:
- One active reusable join invite link per family
- Admin/owner controls to view, copy, and reset the reusable link
- Invite acceptance updates so reusable links remain valid across successful joins
- Rotation behavior that revokes old reusable links immediately
- Reset-only lifecycle for reusable links (no automatic expiry)
- Safety guardrails for long-lived links (usage visibility + easy rotation)

Out of scope:
- Changing claim-link architecture or member-claim flows
- Removing legacy single-use invite creation
- Multi-channel onboarding beyond invite URL sharing/email
- Per-link analytics dashboard beyond minimal usage metadata

### Design Decisions

- Join invites only: Reusable behavior applies only to family join invites, not claim links.
- Exactly one active reusable link per family: Reset is authoritative and revokes previous active reusable links.
- Keep current single-use flow: Admins can still create one-off invites when needed.
- Grouped action UX: Single-use "Create Invite" and reusable-link management are exposed through a shadcn `ButtonGroup`, with the second grouped control acting as a dropdown menu trigger.
- Naming convention: The dropdown option label is "Family Link", its description text is "Invite via Family Invite Link", and the reusable section title is "Family Invite Link".
- Reusable card persistence: The reusable-link card always displays the current/last created reusable link and its latest lifecycle state, even when it is no longer active.
- First-run migration-safe state: Existing instances that predate this feature must show a clear empty state indicating no reusable link exists yet, with a CTA to create the first reusable link.
- Reset-only lifecycle: Reusable links remain valid until explicitly reset or revoked by an admin/owner.
- Rotation over mutation: Reset creates a new invite record/code and revokes prior reusable record(s), preserving audit trail.
- Open invite binding for reusable link: Reusable links are open (not email-bound) to avoid accidental recipient lock-in and reduce operational friction.
- No claimed terminal state for reusable link usage: Successful acceptance should not invalidate reusable links.
- Guardrail 1 (operability): Reusable card should prominently expose one-click reset at all times.
- Guardrail 2 (visibility): Reusable card should show `lastUsedAt` and `useCount` to make unusual usage detectable.
- Guardrail 3 (hygiene): Reusable card should include a non-blocking rotation reminder for older links (for example, older than 90 days).
- Invite history behavior split: Revoked reusable invite artifacts are excluded from invite history, while successful registrations completed through reusable links are shown in history as onboarding events.

### User Stories

- As an owner/admin, I want one reusable invite link for my family, so that I can onboard multiple people without generating a new link each time.
- As an owner/admin, I want to reset the reusable link instantly, so that old shared links stop working if leaked or outdated.
- As an invited person, I want the link to work as long as it remains active (not reset/revoked), so that onboarding is predictable.
- As an owner/admin, I want the existing single-use invite option to remain available, so that I can still issue targeted one-off invites.
- As an owner/admin, I want single-use creation to stay the most prominent action while reusable-link management is available as a secondary menu action, so that default behavior encourages intentional one-person invites.
- As an owner/admin, I want the reusable card to show the latest reusable link state even if no active link exists, so that I always know what the current reusable-link status is.
- As an owner/admin, I want invite history to focus on meaningful onboarding outcomes from reusable links rather than revoked reusable link artifacts, so that history remains useful.
- As a maintainer, I want clear lifecycle handling between reusable and single-use invites, so that invite semantics remain understandable and testable.

## Implementation Plan

### Phase 1: Reusable Invite Domain and Persistence

**Goal:** Extend invite data model to represent reusable join links and rotation lineage without breaking current flows.

#### Tasks

- [x] Update Invite model in `prisma/schema.prisma` with reusable-link support fields:
- [x] Add `isReusable` boolean (default false)
- [x] Add `rotatedFromInviteId` nullable self-reference (recommended)
- [x] Add `useCount` integer default 0 (recommended)
- [x] Add `lastUsedAt` nullable timestamp (recommended)
- [x] Add optional `createdAt`-based rotation reminder support (for example UI threshold at 90 days)
- [x] Add indexes to support fast lookup of active reusable invite by family (`familyId`, `isReusable`, `status`)
- [x] Create and apply migration for new fields/indexes
- [x] Confirm existing invite and claim queries remain compatible

### Phase 2: Shared Validation and Lifecycle Helpers

**Goal:** Add explicit reusable-invite-aware domain logic while preserving current single-use logic.

#### Tasks

- [x] Extend lifecycle/usability helpers in `src/lib/invite.ts` to account for reusable invites
- [x] Ensure lifecycle state mapping for reusable links blocks only on revoked/invalid, not prior successful use
- [x] Keep claim invite helper behavior unchanged
- [x] Extend schema inputs in `src/lib/invite-schemas.ts` with reusable link fetch/reset inputs
- [x] Add or adjust response parsing schemas at UI boundaries for reusable metadata

### Phase 3: Invite Router API for Reusable Link and Rotation

**Goal:** Provide secure, family-scoped APIs to fetch/reset reusable links and accept them repeatedly.

#### Tasks

- [x] Add protected query `getActiveReusableInvite` in `src/server/api/routers/invite.ts`
- [x] Validate owner/admin role in target family for reusable-link operations
- [x] Add protected mutation `resetReusableInvite` in `src/server/api/routers/invite.ts`
- [x] In reset flow, atomically revoke old active reusable invite(s), create new reusable invite with new code, and return full payload
- [x] Update `acceptInvite` in `src/server/api/routers/invite.ts`:
- [x] Reusable invite path: create user/member but do not set invite to claimed
- [x] Single-use path: keep current claim transition
- [x] Preserve duplicate-email and tenant constraints
- [x] Update `getByCode` logic so reusable invites do not return already-used after first successful acceptance
- [x] Ensure reusable invite validity does not depend on `expiresAt` checks (reset/revoke controls lifecycle)
- [x] Ensure `revokeInvite` remains valid for reusable and single-use records
- [x] Keep notification emissions consistent for reset and revoke events

### Phase 4: Settings UI for Reusable Link Management

**Goal:** Add explicit reusable-link controls in invite settings while preserving existing single-use invite UI.

#### Tasks

- [x] Keep the existing primary "Create Invite" button behavior unchanged in `src/app/(app)/settings/invites/page.tsx`
- [x] Add a shadcn `ButtonGroup` attached to the invite action area
- [x] Add dropdown trigger as the second grouped control
- [x] Add dropdown option labeled "Family Link"
- [x] Add dropdown option description text: "Invite via Family Invite Link"
- [x] Selecting "Family Link" opens/toggles the reusable-link management card (section title: "Family Invite Link")
- [x] Add reusable-link card in `src/app/(app)/settings/invites/page.tsx` (section title: "Family Invite Link")
- [x] Show active reusable link URL with copy action
- [x] Always show current/last created reusable link and lifecycle state metadata
- [x] Show "valid until reset" lifecycle messaging for active reusable links
- [x] Show usage indicators (`useCount`, `lastUsedAt`)
- [x] Show non-blocking rotation reminder for older links (for example, older than 90 days)
- [x] Add reset link action with confirmation and mutation wiring
- [x] Refresh queries on reset success and display new active link
- [x] Add first-run empty state when no reusable link has ever been created:
- [x] Message that reusable link is not created yet for this family
- [x] Primary CTA to create first reusable link
- [x] Add clear list badges for reusable, single-use, and claim invites
- [x] Update history rendering rules:
- [x] Exclude revoked reusable invite artifacts from invite history
- [ ] Include successful registrations completed through reusable links as history entries

### Phase 5: Invite Acceptance UX and Error Messaging

**Goal:** Ensure public invite acceptance page reflects reusable semantics correctly.

#### Tasks

- [ ] Update invite page status/error mapping in `src/app/auth/invite/[code]/page.tsx`
- [ ] Avoid already-used messaging for reusable invites
- [ ] Preserve revoked/invalid messaging for reusable links and existing expired messaging for single-use invites
- [ ] Preserve successful accept and sign-in flow
- [ ] Verify no regressions for email-bound single-use invites

### Phase 6: Testing, QA, and Rollout Safety

**Goal:** Validate reusable and single-use behaviors coexist without regressions.

#### Tasks

- [ ] Extend invite helper tests in `test/lib/invite-claim.test.ts` or new invite helper test file for reusable lifecycle
- [ ] Extend router tests in `test/server/api/routers/invite.test.ts`:
- [ ] Create first reusable link
- [ ] Reset rotates and invalidates old code
- [ ] Multiple unique users can accept same reusable code
- [ ] Single-use invites still reject second acceptance
- [ ] Non-admin cannot fetch/reset reusable link
- [ ] Add or extend UI tests for reusable section rendering, reset action, and copy behavior
- [ ] Add UI tests for button-group dropdown action behavior:
- [ ] Primary "Create Invite" action opens current create-invite flow
- [ ] Dropdown "Family Link" action opens reusable-link card
- [ ] Add tests for first-run empty state in existing instances with no reusable link
- [ ] Add history tests for reusable-link behavior:
- [ ] Revoked reusable invite artifacts are not listed
- [ ] Successful registrations through reusable links are listed
- [ ] Run lint, typecheck, and targeted invite test suites
- [ ] Perform manual QA across settings and auth routes

## Acceptance Criteria

- [ ] Invite settings keeps single-use "Create Invite" as the primary visible action
- [ ] The second control in the shadcn `ButtonGroup` is a dropdown trigger
- [ ] "Family Link" appears as a dropdown option and opens the "Family Invite Link" section
- [ ] The "Family Link" dropdown option displays description text "Invite via Family Invite Link"
- [ ] Owners/admins can view the current/last created reusable join invite link and its lifecycle state in the reusable-link card
- [ ] Existing families with no reusable link see an explicit empty state and can create their first reusable link from the card
- [ ] Owners/admins can reset the reusable link, and reset immediately invalidates the previous reusable code
- [ ] A reusable link can successfully onboard multiple distinct users over time
- [ ] Single-use join invites remain available and still become unusable after first successful acceptance
- [ ] Claim-link flow for unclaimed members remains unchanged and fully functional
- [ ] Reusable link remains valid until explicitly reset or revoked and does not auto-expire
- [ ] Non-admin users cannot fetch or reset reusable family links
- [ ] Invite listing clearly indicates reusable vs single-use vs claim invites
- [ ] Reusable card shows `useCount` and `lastUsedAt` for operational visibility
- [ ] Reusable card displays a non-blocking reminder when a link is old (for example, older than 90 days)
- [ ] Revoked reusable invite artifacts are excluded from invite history
- [ ] Successful registrations completed through reusable links appear in history
- [ ] Existing invite email delivery/retry behavior for email-bound single-use invites is not regressed
- [ ] Tests covering reusable lifecycle, rotation, permissions, and regressions pass
