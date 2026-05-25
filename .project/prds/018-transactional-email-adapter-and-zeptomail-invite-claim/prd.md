---
title: "Transactional Email Adapter Platform - BYO Provider with ZeptoMail for Invite and Claim Flows"
status: in-progress
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/007-invite-only-registration-flow/prd.md
    description: "Invite-only registration domain and invite lifecycle"
  - type: prd
    url: .project/prds/008-unclaimed-member-creation-and-claim-flow/prd.md
    description: "Unclaimed member and claim-link generation flows"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` — when work begins on any phase.
>   - `completed` — when all tasks and acceptance criteria are done.
>   - `on-hold` — if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Transactional Email Adapter Platform - BYO Provider with ZeptoMail for Invite and Claim Flows

## Description

Fircle needs transactional email delivery for core account-access workflows, while preserving bring-your-own-provider flexibility similar to the object storage architecture.

This PRD introduces a provider-agnostic transactional email adapter layer, ships ZeptoMail as the first concrete provider, and wires email delivery into existing invite and claim-link workflows.

In scope for this PRD:
- Build a reusable transactional email adapter contract and factory.
- Add ZeptoMail provider implementation.
- Add per-event templates for:
  - Invite created (email-bound invite)
  - Claim link created/regenerated (unclaimed member claim flow)
- Send emails inline from the existing mutation flows.
- Keep provider configuration optional so self-hosters can run without email provider setup.

Out of scope for this PRD:
- Notification-event email delivery (mentions, tags, likes, comments).
- Push notification implementation.
- Password reset flow implementation.
- Background worker/queue delivery architecture.

### Design Decisions

- **Adapter-first architecture**: Mirror storage provider design so email provider switching is centralized and low-risk.
- **Optional provider config**: If no provider is configured, invite and claim flows must still complete successfully.
- **Inline send for phase delivery**: Send immediately from the relevant server mutations to deliver value quickly; async delivery can be added in a follow-up PRD.
- **Per-event template strategy**: Use event-specific template builders instead of one generic template to keep transactional messages explicit and evolvable.
- **Graceful failure policy**: Email delivery failure should not rollback successful domain writes for invite/claim-link creation; failures must be logged with actionable context.
- **Provider-agnostic event payload**: Template rendering and provider sending are separated so provider replacement does not affect event template logic.

### User Stories

- **As a** family admin, **I want** an email-bound invite to send a real invite email automatically, **so that** recipients can join without manual copy/paste.
- **As a** family admin, **I want** claim-link creation/regeneration to send an account-claim email, **so that** unclaimed members can onboard directly.
- **As a** self-hosting maintainer, **I want** to bring my own transactional email provider, **so that** I can choose services and credentials that fit my environment.
- **As a** maintainer, **I want** provider config to be optional, **so that** local/dev instances can run without outbound email dependencies.

## Implementation Plan

### Phase 1: Transactional Email Domain and Provider Abstraction

**Goal:** Establish a reusable, provider-agnostic transactional email foundation with a factory pattern that matches current storage architecture.

#### Tasks

- [x] Create a new email provider domain module at src/server/email with:
  - Provider driver type.
  - Provider interface for send operation.
  - Typed message input/output contracts.
  - Error type/classification for retryable and non-retryable failures.
- [x] Implement provider factory and singleton getter similar to src/server/storage/provider.ts:
  - createEmailProvider()
  - getEmailProvider()
  - Exhaustive driver switch handling.
- [x] Ensure provider construction validates required provider-specific configuration only when that provider is selected.
- [x] Add a no-provider mode that returns null or equivalent from the provider getter when email is not configured.

### Phase 2: Environment Configuration and Validation

**Goal:** Add explicit env configuration for transactional email with safe optional behavior.

#### Tasks

- [x] Extend src/env.js with server env variables for transactional email:
  - Email driver selector.
  - Sender address/name.
  - ZeptoMail credentials.
- [x] Use conditional validation rules so ZeptoMail credentials are required only when ZeptoMail driver is selected.
- [x] Document expected environment variables in README.md (or equivalent environment section) with minimal setup examples.
- [x] Verify type-safe env access in all new email modules.

### Phase 3: ZeptoMail Provider Implementation

**Goal:** Deliver first concrete provider adapter using ZeptoMail API while preserving adapter contract boundaries.

#### Tasks

- [ ] Add ZeptoMail provider implementation under src/server/email that satisfies the provider interface.
- [ ] Implement request/response mapping including:
  - Recipient handling.
  - Subject/body delivery.
  - Provider message id extraction.
- [ ] Implement robust error mapping for ZeptoMail responses into typed provider errors.
- [ ] Add structured logging metadata for provider send attempts and outcomes without leaking sensitive payload content.

### Phase 4: Event Templates and Link Builders

**Goal:** Add per-event transactional templates for invite and claim workflows.

#### Tasks

- [ ] Create template builder module(s) for invite-created and claim-link-created events that produce subject + html/text output.
- [ ] Centralize app link generation for invite and claim URLs to avoid route drift and duplicated string construction.
- [ ] Include essential dynamic fields in templates:
  - Family name.
  - Recipient-facing action URL.
  - Expiration context when available.
- [ ] Ensure template output is safely encoded/sanitized and testable as pure functions.

### Phase 5: Invite and Claim-Flow Integration

**Goal:** Wire transactional email sends into the existing live invite and claim-link server mutations.

#### Tasks

- [ ] Integrate invite email sending in src/server/api/routers/invite.ts createInvite flow:
  - Trigger only for email-bound invites with an invited email.
  - Use invite-created template and adapter send function.
- [ ] Integrate claim-link email sending in src/server/api/routers/family-member.ts for:
  - createUnclaimedMember flow when claim invite is auto-generated.
  - createClaimLink flow when link is regenerated.
- [ ] Implement non-blocking failure behavior for send failures:
  - Preserve successful domain writes.
  - Emit structured error logs for operational visibility.
- [ ] Add minimal dedupe/idempotency guardrails so retries of mutation logic do not accidentally send duplicate emails unless a new token/code is generated.

### Phase 6: Tests, Verification, and Release Readiness

**Goal:** Ensure correctness, maintainability, and predictable behavior across provider-enabled and provider-disabled environments.

#### Tasks

- [ ] Add unit tests for provider factory behavior:
  - No provider configured.
  - ZeptoMail selected with valid config.
  - Misconfigured ZeptoMail config path.
- [ ] Add unit tests for template builders to verify event-specific subjects, bodies, and links.
- [ ] Extend invite router tests in test/server/api/routers/invite.test.ts to verify adapter send invocation and failure handling.
- [ ] Extend family-member router tests in test/server/api/routers/family-member.test.ts to verify claim-link send behavior for creation and regeneration paths.
- [ ] Add integration-style assertions (mocked provider) for optional-provider mode where flows succeed without send attempts.
- [ ] Run lint, typecheck, and targeted tests before marking PRD work complete.

## Acceptance Criteria

- [ ] A provider-agnostic transactional email adapter layer exists and follows the same factory/singleton pattern as storage providers.
- [ ] ZeptoMail is implemented as a concrete provider and can send transactional emails for supported events.
- [ ] Invite-created emails are sent for email-bound invites from the existing createInvite flow.
- [ ] Claim-link emails are sent from both auto-generated claim-link creation and claim-link regeneration flows.
- [ ] Per-event templates exist (not a single generic template) for invite-created and claim-link-created events.
- [ ] Email provider configuration is optional; when unconfigured, invite and claim-link mutations still succeed.
- [ ] Email send failures do not rollback successful invite/claim-link persistence and are logged with actionable context.
- [ ] Unit and router-level tests cover provider selection, template rendering, and integration call behavior.
- [ ] Documentation includes required env variables and setup notes for ZeptoMail.
