---
title: "Domain Verification Proof Checks and Server-Side Ownership Validation"
status: draft
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

- [ ] Create `src/server/domain-verification/` module boundaries for DNS and HTTP proof checks.
- [ ] Implement DNS TXT lookup helper for `_fircle-verification.<domain>` and token matching against `fircle-verification=<token>`.
- [ ] Implement HTTP verification helper for a deterministic well-known endpoint contract.
- [ ] Define shared verification result states (`verified`, `pending`, `invalid-proof`, `unreachable`, `timeout`) and structured error mapping.
- [ ] Add structured logs for verification attempts with method, duration, and failure reason.

### Phase 2: Domain Router Contract Upgrade

**Goal:** Replace placeholder token comparison with backend proof checks.

#### Tasks

- [ ] Refactor `verifyDomain` in `src/server/api/routers/domain.ts` to call server-side DNS/HTTP verification helpers.
- [ ] Remove client-trusted token equality as verification proof.
- [ ] Preserve owner-only authorization and same-family ownership checks.
- [ ] Ensure `verifiedAt` is written only after successful proof.
- [ ] Keep `getVerificationToken` for challenge instructions and align response shape with DNS/HTTP guidance used by UI.

### Phase 3: Security and Runtime Controls

**Goal:** Harden verification target handling and operational behavior.

#### Tasks

- [ ] Normalize and validate domain targets before outbound DNS/HTTP checks.
- [ ] Reject reserved and unsafe targets in production (for example localhost and private network ranges).
- [ ] Add bounded timeout/retry controls for verification attempts.
- [ ] Add env-driven knobs in `src/env.js` for verification timeouts/retries/feature toggling.
- [ ] Document log fields and operational diagnostics expectations for support/debugging.

### Phase 4: Settings UX Alignment

**Goal:** Keep domain settings intuitive while switching to server-verified semantics.

#### Tasks

- [ ] Update `src/components/settings/domain-verification.tsx` so method selection triggers server proof checks instead of token trust submission.
- [ ] Keep copy actions and challenge instructions for DNS and HTTP setup.
- [ ] Add user-facing states for in-progress verification, success, retryable pending propagation, and terminal errors.
- [ ] Ensure `src/components/settings/domain-list.tsx` and `src/app/(app)/settings/domain/page.tsx` refresh and invalidate queries consistently after verification attempts.
- [ ] Confirm non-owner behavior remains forbidden and unchanged.

### Phase 5: Validation, Tests, and Documentation

**Goal:** Prove correctness and publish operational guidance.

#### Tasks

- [ ] Add router tests in `test/server/api/routers/domain.test.ts` for auth constraints and DNS/HTTP success/failure paths.
- [ ] Add helper/service tests for domain target validation, timeout behavior, and parser correctness.
- [ ] Confirm production resolver behavior in `test/lib/tenant-resolution.test.ts` still blocks unverified domains.
- [ ] Update `README.md` with exact DNS and HTTP verification contracts, propagation expectations, and troubleshooting notes.
- [ ] Run `pnpm typecheck`, `pnpm lint`, and targeted Vitest suites for touched verification and resolver areas.

## Acceptance Criteria

- [ ] Domain verification no longer succeeds based solely on client-submitted token echoes.
- [ ] DNS method verifies ownership by querying TXT records and matching stored challenge token.
- [ ] HTTP method verifies ownership by checking the documented well-known challenge endpoint.
- [ ] `verifiedAt` is set only after server-side proof success.
- [ ] Verification failures return actionable categories (for example pending propagation, invalid proof, unreachable target, timeout).
- [ ] Unsafe verification targets are rejected according to production security policy.
- [ ] Domain settings UI reflects server-driven verification flow and provides clear retry/error states.
- [ ] Automated tests cover DNS/HTTP happy paths, failure paths, authorization boundaries, and resolver gating behavior.
- [ ] README includes operator instructions for both DNS TXT and HTTP token verification setup.
- [ ] Typecheck, lint, and targeted tests pass for touched files.
