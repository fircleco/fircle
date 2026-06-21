---
title: "Domain Verification Proof Checks and Server-Side Ownership Validation"
status: completed
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/023-tenant-local-domain-resolution-and-auth-isolation/prd.md
    description: "Domain model, tenant resolution, and existing placeholder verification flow"
  - type: pr
    url: https://github.com/fircle-app/fircle/pull/36
    description: "Current implementation PR with placeholder verification mutation"
  - type: pr
    url: https://github.com/fircle-app/fircle/pull/37
    description: "Implementation pull request - feat: domain verification"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` — when work begins on any phase.
>   - `completed` — when all tasks and acceptance criteria are done.
>   - `on-hold` — if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Domain Verification Proof Checks and Server-Side Ownership Validation

## Description

The current domain verification flow stores a generated token per domain and exposes DNS/HTTP instructions, but the verify mutation still trusts a client-submitted token string rather than performing proof checks itself.

This PRD upgrades verification to true server-side ownership validation:
- DNS verification checks TXT records on the public DNS path.
- HTTP verification checks a deterministic well-known endpoint.
- `verifiedAt` is set only when server proof succeeds.
- Errors distinguish between propagation delays, misconfiguration, and unreachable targets.

The goal is to preserve current domain management UX while removing trust in user-provided verification echoes.

### Design Decisions

- **Server-side proof is the source of truth**: Verification success is based on DNS/HTTP lookups performed by the backend, not user-entered token equivalence.
- **Deterministic challenge contract**: Keep token generation in `Domain.verificationToken` and enforce stable DNS and HTTP challenge formats for operators.
- **Synchronous bounded checks first**: Use short, bounded retries/timeouts during mutation execution before considering async worker-based verification.
- **Security-first target validation**: Reject unsafe verification targets (for example localhost/private ranges in production) to prevent SSRF-style abuse.
- **Backward-compatible domain management UX**: Retain the settings route and verification dialog structure, but switch interaction semantics to “trigger verification check” instead of “submit token as proof.”

### User Stories

- **As a** family owner, **I want** domain verification to validate my DNS or HTTP challenge directly, **so that** verification is trustworthy and not dependent on manual token echoing.
- **As a** self-hosted operator, **I want** clear verification failure reasons, **so that** I can distinguish propagation delay from misconfiguration quickly.
- **As a** maintainer, **I want** verification behavior covered by automated tests, **so that** domain routing safety remains reliable in production.
- **As a** platform operator, **I want** production to keep rejecting unverified domains, **so that** tenant data cannot be resolved on unproven hosts.

## Implementation Plan

### Phase 1: Verification Service Foundations

**Goal:** Add server-only DNS/HTTP verification primitives and normalize result semantics.

#### Tasks

- [x] Create `src/server/domain-verification/` module boundaries for DNS and HTTP proof checks.
- [x] Implement DNS TXT lookup helper for `_fircle-verification.<domain>` and token matching against `fircle-verification=<token>`.
- [x] Implement HTTP verification helper for a deterministic well-known endpoint contract.
- [x] Define shared verification result states (`verified`, `pending`, `invalid-proof`, `unreachable`, `timeout`) and structured error mapping.
- [x] Add structured logs for verification attempts with method, duration, and failure reason.

### Phase 2: Domain Router Contract Upgrade

**Goal:** Replace placeholder token comparison with backend proof checks.

#### Tasks

- [x] Refactor `verifyDomain` in `src/server/api/routers/domain.ts` to call server-side DNS/HTTP verification helpers.
- [x] Remove client-trusted token equality as verification proof.
- [x] Preserve owner-only authorization and same-family ownership checks.
- [x] Ensure `verifiedAt` is written only after successful proof.
- [x] Keep `getVerificationToken` for challenge instructions and align response shape with DNS/HTTP guidance used by UI.

### Phase 3: Security and Runtime Controls

**Goal:** Harden verification target handling and operational behavior.

#### Tasks

- [x] Normalize and validate domain targets before outbound DNS/HTTP checks.
- [x] Reject reserved and unsafe targets in production (for example localhost and private network ranges).
- [x] Add bounded timeout/retry controls for verification attempts.
- [x] Add env-driven knobs in `src/env.js` for verification timeouts/retries/feature toggling.
- [x] Document log fields and operational diagnostics expectations for support/debugging.

### Phase 4: Settings UX Alignment

**Goal:** Keep domain settings intuitive while switching to server-verified semantics.

#### Tasks

- [x] Update `src/components/settings/domain-verification.tsx` so method selection triggers server proof checks instead of token trust submission.
- [x] Keep copy actions and challenge instructions for DNS and HTTP setup.
- [x] Add user-facing states for in-progress verification, success, retryable pending propagation, and terminal errors.
- [x] Ensure `src/components/settings/domain-list.tsx` and `src/app/(app)/settings/domain/page.tsx` refresh and invalidate queries consistently after verification attempts.
- [x] Confirm non-owner behavior remains forbidden and unchanged.

### Phase 5: Validation, Tests, and Documentation

**Goal:** Prove correctness and publish operational guidance.

#### Tasks

- [x] Add router tests in `test/server/api/routers/domain.test.ts` for auth constraints and DNS/HTTP success/failure paths.
- [x] Add helper/service tests for domain target validation, timeout behavior, and parser correctness.
- [x] Confirm production resolver behavior in `test/lib/tenant-resolution.test.ts` still blocks unverified domains.
- [x] Update `README.md` with exact DNS and HTTP verification contracts, propagation expectations, and troubleshooting notes.
- [x] Run `pnpm typecheck`, `pnpm lint`, and targeted Vitest suites for touched verification and resolver areas.

## Acceptance Criteria

- [x] Domain verification no longer succeeds based solely on client-submitted token echoes.
- [x] DNS method verifies ownership by querying TXT records and matching stored challenge token.
- [x] HTTP method verifies ownership by checking the documented well-known challenge endpoint.
- [x] `verifiedAt` is set only after server-side proof success.
- [x] Verification failures return actionable categories (for example pending propagation, invalid proof, unreachable target, timeout).
- [x] Unsafe verification targets are rejected according to production security policy.
- [x] Domain settings UI reflects server-driven verification flow and provides clear retry/error states.
- [x] Automated tests cover DNS/HTTP happy paths, failure paths, authorization boundaries, and resolver gating behavior.
- [x] README includes operator instructions for both DNS TXT and HTTP token verification setup.
- [x] Typecheck, lint, and targeted tests pass for touched files.
