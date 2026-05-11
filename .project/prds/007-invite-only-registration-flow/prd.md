---
title: "Invite-Only Registration Flow - Live Auth, Invite Validation, and Account Creation"
status: completed
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/002-static-auth-ui/prd.md
    description: "Static auth UI foundation for landing, sign in, and invite acceptance"
  - type: prd
    url: .project/prds/005-invite-and-access-static-ui/prd.md
    description: "Static invite management and access control UI patterns"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` - when work begins on any phase.
>   - `completed` - when all tasks and acceptance criteria are done.
>   - `on-hold` - if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Invite-Only Registration Flow - Live Auth, Invite Validation, and Account Creation

## Description

This PRD transitions Fircle from static authentication screens to a working invite-only registration system.

Users should only be able to create an account when they have a valid invite. Existing users should sign in with credentials. Invite acceptance should validate invite state, create the user account, attach the user to the correct family context, and sign the user in automatically.

This PRD also includes a minimal admin-only invite management backend (and optional thin UI wiring) so invites can be created, listed, and revoked in real usage, not just mocked.

### Design Decisions

- **Family identity in invites now**: Each invite is tied to a specific family record, even while product behavior is still single-family first.
- **Support two invite types**: MVP supports both open invites and email-bound invites.
- **Admin-only invite issuance**: Only owner/admin roles can create or revoke invites in MVP.
- **Duplicate invite prevention**: Creating an email-bound invite is rejected if the target email is already a registered user or already has an active (pending, non-expired) invite for the same family.
- **Invite list clarity**: Pending invite rows in admin UI explicitly display invite type, and email-bound invites show the target invited email for quick verification.
- **Auto sign-in after acceptance**: Successful invite acceptance should immediately create a session and route the user into the app.
- **Invite expiry**: Default invite expiration is 14 days.
- **API-first implementation**: Registration and invite validation run through tRPC procedures with server-side validation and transactions.
- **Preserve existing auth stack**: Keep NextAuth Credentials provider and Prisma adapter; layer invite registration around it.

### User Stories

- **As a** new invited family member, **I want** to open an invite link and see whether it is valid, **so that** I can trust the registration flow.
- **As a** new invited family member, **I want** to create my account only when the invite is valid, **so that** family access remains private.
- **As a** user with an email-bound invite, **I want** the system to enforce my invited email, **so that** my invite cannot be misused.
- **As a** user with an open invite, **I want** to claim it with my own email, **so that** I can join without pre-bound email setup.
- **As an** existing family member, **I want** to sign in with email and password, **so that** I can access the app after account creation.
- **As a** family admin, **I want** to create and revoke invites, **so that** I control who can register.

## Implementation Plan

### Phase 1: Data Model for Invite-Only Registration

**Goal:** Introduce Prisma models and enums required for family-aware invite issuance and claim tracking.

#### Tasks

- [x] Update prisma/schema.prisma with `Family`, `FamilyMember` (user-family membership), and `Invite` models.
- [x] Add enums for invite type and invite status (for example: `OPEN`, `EMAIL_BOUND`; `PENDING`, `CLAIMED`, `EXPIRED`, `REVOKED`).
- [x] Ensure `Invite` includes: code/token, family relation, optional invited email, createdBy, expiresAt, claimedAt, claimedBy, revokedAt.
- [x] Ensure `FamilyMember` includes role support for admin authorization (`OWNER`, `ADMIN`, `MEMBER`).
- [x] Add indexes and uniqueness constraints needed for reliable lookup and claim safety.
- [x] Generate and commit Prisma migration for the schema changes.

---

### Phase 2: Invite Domain Logic and Validation

**Goal:** Add reusable server-side helpers and schemas for invite lifecycle checks.

#### Tasks

- [x] Add invite helper module(s) under src/lib for code generation and lifecycle checks.
- [x] Add zod input schemas for invite create, lookup, accept, and revoke operations.
- [x] Implement centralized invite status evaluation logic (`valid`, `expired`, `claimed`, `revoked`).
- [x] Implement email-binding validation logic for email-bound invites.
- [x] Add utility to normalize and compare email values safely.

---

### Phase 3: tRPC Invite Router and Authorization Rules

**Goal:** Provide production API endpoints for invite lookup, acceptance, and admin management.

#### Tasks

- [x] Create src/server/api/routers/invite.ts with public `getByCode` query.
- [x] Add public `acceptInvite` mutation with full server-side validation and account creation transaction.
- [x] Add protected `createInvite`, `listInvites`, and `revokeInvite` procedures.
- [x] Enforce admin-only access in protected invite management procedures.
- [x] Register invite router in src/server/api/root.ts.
- [x] Map domain failures to stable error codes/messages for UI consumption.

---

### Phase 4: Credentials Auth and Registration Integration

**Goal:** Wire invite acceptance with NextAuth credentials flow and create seamless session onboarding.

#### Tasks

- [x] Ensure account creation stores bcrypt-hashed passwords compatible with existing credentials authorize logic.
- [x] Confirm src/server/auth/config.ts continues to authorize newly created users correctly.
- [x] Define consistent handling for email already in use during invite acceptance.
- [x] Implement post-accept auto sign-in flow from invite screen.
- [x] Route successful acceptance into authenticated app surface.

---

### Phase 5: Route Wiring for Existing Auth Pages

**Goal:** Replace static auth behaviors with real invite and sign-in interactions.

#### Tasks

- [x] Update src/app/auth/invite/[code]/page.tsx to fetch invite details by code.
- [x] Render dynamic state on invite page for valid, expired, claimed, and revoked invites.
- [x] Submit invite acceptance form to `acceptInvite` mutation.
- [x] Show inline errors for binding mismatch, duplicate email, and invalid invite.
- [x] Update src/app/auth/signin/page.tsx to call credentials sign-in for real.
- [x] Preserve and map error query params/states on signin route for failed auth attempts.

---

### Phase 6: Minimal Admin Invite Management Wiring

**Goal:** Make static invite management UI useful by connecting it to live backend procedures.

#### Tasks

- [x] Wire create invite form to live `createInvite` mutation.
- [x] Wire invite list view to live `listInvites` query.
- [x] Wire revoke action to live `revokeInvite` mutation.
- [x] Display generated invite link/code for sharing.
- [x] Ensure non-admin users cannot access invite management mutations.

---

### Phase 7: Hardening and QA

**Goal:** Verify reliability, correctness, and baseline abuse protections for public invite endpoints.

#### Tasks

- [x] Add basic rate-limit hooks or guard rails for public invite lookup and acceptance endpoints.
- [x] Ensure invite acceptance is transactional and safe against double-claim race conditions.
- [x] Add logs or audit-friendly fields updates for invite lifecycle events.
- [x] Run full checks: `pnpm check` and Prisma migration validation.
- [x] Perform manual happy path and failure path testing across auth routes.

#### Test Data

A Prisma seed script ([`prisma/seed.mjs`](prisma/seed.mjs)) has been created to support manual QA and acceptance testing. The seed provides:

- **Family**: The Shittabey Family
- **Family Members** (5 users in family with roles):
  - Emma Shittabey (OWNER)
  - Noah Shittabey (ADMIN)
  - Lily Shittabey (MEMBER)
  - Logan Ross (MEMBER)
  - Ava Kim (MEMBER)
- **Non-Family User**: Existing User (`existing-user@example.com`) for testing duplicate-email scenarios
- **Invites** (6 total, covering all lifecycle states):
  - `abc123xyz` — EMAIL_BOUND, PENDING, expires May 31, 2026
  - `def456uvw` — OPEN, PENDING, expires May 28, 2026
  - `ghi789rst` — EMAIL_BOUND, CLAIMED (by Ava Kim), expired Apr 10, 2026
  - `jkl012opq` — EMAIL_BOUND, EXPIRED, expires Mar 14, 2026
  - `mno345lmn` — OPEN, REVOKED, expires May 15, 2026
  - `pqr678hij` — EMAIL_BOUND, CLAIMED (by Lily Shittabey), expired Feb 5, 2026

**Run seed:**
```bash
pnpm db:seed
```

**Test sign-in credentials** (password for all seeded users):
```
Password: Passw0rd!123
```

Use any of the family member emails (e.g., emma.shittabey@example.com) to sign in as existing users, or use the invite codes above to test invite acceptance flows.

## Acceptance Criteria

- [x] A user cannot register without a valid invite code.
- [x] Valid invite page loads dynamic family/invite details for the given code.
- [x] Expired, claimed, revoked, and invalid invites each render distinct UI states.
- [x] Email-bound invites reject non-matching email addresses.
- [x] Open invites can be accepted by a new email and become claimed after first use.
- [x] Invite acceptance creates a user account with hashed password.
- [x] Successful invite acceptance auto-signs the user in and routes into the app.
- [x] Existing users can sign in from /auth/signin with credentials.
- [x] Admin users can create, list, and revoke invites; non-admin users cannot.
- [x] Invite status transitions are persisted and reflected accurately in list views.
- [x] `pnpm check` passes with no lint/type errors after implementation.
- [x] Core invite acceptance scenarios are verified manually:
  - valid invite acceptance
  - expired invite rejection
  - claimed invite rejection
  - revoked invite rejection
  - email-bound mismatch rejection
  - duplicate email rejection
