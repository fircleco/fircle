---
title: "Tenant-Local Domain Resolution and Auth Isolation"
status: in-progress
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/022-self-hosted-bootstrap-and-setup-readiness/prd.md
    description: "Self-host bootstrap and setup behavior that tenant resolution must integrate with"
  - type: prd
    url: .project/prds/007-invite-only-registration-flow/prd.md
    description: "Invite lifecycle and acceptance flow that must become tenant-local"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` — when work begins on any phase.
>   - `completed` — when all tasks and acceptance criteria are done.
>   - `on-hold` — if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Tenant-Local Domain Resolution and Auth Isolation

## Description

Fircle is moving toward tenant-local behavior: family instances must feel like private homes that share infrastructure but not identity semantics.

Today, family context is partially inferred from host patterns and existing single-family assumptions, while account uniqueness and invite acceptance still behave as if identity is globally platform-scoped. This creates product mismatch for the intended future.

This PRD simplifies tenant resolution to one rule: every incoming host must resolve through an explicit `Domain` table mapping to a family. No special-case slug parsing, no host-pattern inference, and no singleton self-host fallback.

Implications of this model:
- `family-slug.fircle.app` domains are written to `Domain` rows and resolved exactly like custom domains.
- Custom domains are written to `Domain` rows and resolved identically.
- Self-host installs on root or subdomain hosts must write that host into `Domain` for resolution.
- Email/account uniqueness is tenant-local, not globally blocking cross-family joins.

### Design Decisions

- **Domain table is the only resolver source**: Resolve tenant exclusively through `Domain.domain -> familyId` mapping.
- **Family slug as canonical family handle**: Keep a unique `Family.slug` for stable family identity and deterministic cloud-domain generation (`<slug>.fircle.app`).
- **No host heuristics**: Do not parse subdomains or apply singleton fallback behavior in resolver logic.
- **Tenant-local auth semantics**: Auth identity uniqueness and account lookup are tenant-scoped so the same email can exist in different family tenants.
- **Uniform treatment across deployment types**: Cloud subdomains, custom domains, and self-host root domains are all explicit rows in the same table.
- **Dedicated domain module boundaries**: Domain operations and resolution live in a dedicated domain router instead of mixed family-member endpoints.
- **Security-first host handling**: Normalize and validate host extraction to prevent ambiguous host-header behavior.
- **No silent cross-tenant session bleed**: Session and redirect behavior must remain inside resolved tenant context.

### User Stories

- **As a** family member, **I want** to log in to my family instance domain directly, **so that** the experience feels private and instance-owned.
- **As a** family admin, **I want** to attach a custom domain to my family instance, **so that** we can use our own branded/private address.
- **As a** self-hosted operator, **I want** root-domain installs with no subdomain to resolve through configured domain mapping, **so that** setup stays simple for single-family deployments.
- **As a** user invited to multiple families, **I want** to use the same email independently per family tenant, **so that** one family join does not block another.
- **As a** maintainer, **I want** deterministic tenant resolution rules and tests, **so that** routing and auth behavior remain predictable across deployments.

## Implementation Plan

### Phase 1: Data Model for Domain-Driven Tenant Identity

**Goal:** Add explicit domain mapping primitives and remove resolver ambiguity.

#### Tasks

- [x] Add `slug` to `Family` in [prisma/schema.prisma](prisma/schema.prisma) with global uniqueness.
- [x] Add `Domain` model in [prisma/schema.prisma](prisma/schema.prisma) with fields:
  - `id`, `familyId`, `domain`, `isPrimary`, `verifiedAt`, `createdAt`, `updatedAt`.
- [x] Add uniqueness/index constraints:
  - unique domain globally,
  - index by `familyId`,
  - optional unique primary per family.
- [x] Create migration/backfill strategy for existing deployments:
  - backfill deterministic unique family slugs,
  - write current serving host(s) into `Domain` rows,
  - persist deterministic primary-domain assignment per family,
  - enforce uniqueness constraints safely.
- [x] Update seed data in [prisma/seed.mjs](prisma/seed.mjs) to create tenant-valid fixtures:
  - families include deterministic unique `slug` values,
  - initial `Domain` rows are created and mapped to seeded families,
  - at least one seeded example covers root-domain/self-host resolution behavior.
- [x] Update bootstrap/setup flow in [src/server/api/routers/setup.ts](src/server/api/routers/setup.ts) to create initial `Domain` row for the installation host.
- [x] For cloud-hosted families, auto-generate default domain row from slug pattern (`<family.slug>.fircle.app`) during provisioning.

### Phase 2: Hostname Resolution Layer

**Goal:** Resolve tenant only via `Domain` table lookups.

#### Tasks

- [ ] Create tenant resolver utility (for example [src/lib/tenant-resolution.ts](src/lib/tenant-resolution.ts)) that:
  - extracts and normalizes request host,
  - resolves by `Domain.domain` only,
  - returns not-found when no explicit mapping exists.
- [ ] Define explicit resolver result states (`resolved`, `not-found`, `ambiguous`, `bootstrap-required`).
- [ ] Integrate resolver in middleware/auth entry points:
  - [src/middleware.ts](src/middleware.ts),
  - [src/app/auth/signin/page.tsx](src/app/auth/signin/page.tsx),
  - [src/app/(app)/layout.tsx](src/app/(app)/layout.tsx).
- [ ] Add tenant-not-found UX route/page for unresolved hosts.
- [ ] Add canonical-host redirect policy (primary domain enforcement) for resolved tenants.

### Phase 3: Tenant-Scoped Auth and Invite Semantics

**Goal:** Remove global-email coupling and enforce tenant-local account behavior.

#### Tasks

- [ ] Introduce tenant-scoped auth uniqueness strategy (schema and adapter updates), including migration plan for existing users.
- [ ] Update credential sign-in lookup to require resolved tenant context in [src/server/auth](src/server/auth).
- [ ] Update invite acceptance in [src/server/api/routers/invite.ts](src/server/api/routers/invite.ts):
  - remove global email conflict behavior,
  - apply tenant-scoped existing-account logic,
  - only block when identity conflict exists within same tenant.
- [ ] Update claim flow in [src/server/api/routers/family-member.ts](src/server/api/routers/family-member.ts) with same tenant-scoped behavior.
- [ ] Ensure family membership checks continue using tenant-scoped `familyId` boundaries for protected operations.

### Phase 4: Domain Management and Verification Workflow

**Goal:** Allow families to manage custom domains safely.

#### Tasks

- [ ] Add dedicated domain router at [src/server/api/routers/domain.ts](src/server/api/routers/domain.ts) and register it in [src/server/api/root.ts](src/server/api/root.ts).
- [ ] Implement domain management endpoints in [src/server/api/routers/domain.ts](src/server/api/routers/domain.ts):
  - add domain,
  - list domains,
  - set primary domain,
  - remove domain.
- [ ] Enforce owner-only authorization for domain write operations (add, set primary, remove); list can be owner/admin as desired by policy.
- [ ] Implement domain verification challenge flow (DNS TXT and/or HTTP token) and persist `verifiedAt`.
- [ ] Restrict domain resolution to verified domains in production mode.
- [ ] Add dedicated settings route at [src/app/(app)/settings/domain/page.tsx](src/app/(app)/settings/domain/page.tsx) for domain management.
- [ ] Add owner-only settings menu entry linking to `/settings/domain` (for example in settings navigation components under [src/components/nav](src/components/nav)).
- [ ] Ensure non-owner users cannot access `/settings/domain` and receive a clear forbidden UX.

### Phase 5: Session, Redirect, and Security Hardening

**Goal:** Ensure tenant isolation in runtime behavior and host handling.

#### Tasks

- [ ] Validate trusted host extraction behavior behind proxy/CDN deployment.
- [ ] Prevent cross-tenant redirect leakage by preserving resolved tenant host in callback flows.
- [ ] Confirm cookie/session scope aligns with tenant-local policy for both platform subdomains and custom domains.
- [ ] Add structured logs for resolver decisions and mismatches.
- [ ] Add explicit safeguards against host-header injection and unknown-host escalation.

### Phase 6: Validation, QA, and Documentation

**Goal:** Prove behavior across all deployment patterns and document operational setup.

#### Tasks

- [ ] Add automated tests for resolver behavior:
  - explicit mapped platform-style subdomain resolution,
  - explicit mapped custom-domain resolution,
  - explicit mapped self-host root-domain resolution,
  - unresolved host handling.
- [ ] Add automated tests for tenant-scoped invite/claim/email behavior across two families with same email.
- [ ] Manual QA scenarios:
  - cloud-hosted subdomain tenant,
  - custom domain tenant,
  - self-host root-domain single-family install.
- [ ] Update [README.md](README.md) with:
  - tenant domain configuration,
  - custom-domain verification setup,
  - self-host root-domain resolution behavior,
  - auth/invite tenant-scoped semantics.
- [ ] Run `pnpm typecheck`, `pnpm lint`, and relevant test suites before completion.

## Acceptance Criteria

- [ ] `Family.slug` exists, is globally unique, and is backfilled safely for existing families.
- [ ] `Domain` model exists with globally unique `domain` values mapped to `familyId`.
- [ ] Seed fixtures are updated to include tenant-valid `Family.slug` and mapped `Domain` rows.
- [ ] Hostname resolution supports mapped domains for:
  - `family-slug.fircle.app` style hosts,
  - verified custom domains,
  - self-hosted root/subdomain installs.
- [ ] Tenant resolution is deterministic and table-driven, with explicit not-found outcomes when host is unmapped.
- [ ] Invite acceptance and claim flows no longer fail globally on existing email across different tenants.
- [ ] Email/account uniqueness is enforced within tenant scope, not globally across all families.
- [ ] Sign-in and post-auth redirects stay tenant-local and do not leak across hosts.
- [ ] Unknown or unverified domains cannot access tenant data.
- [ ] Domain management and verification workflow is available to family admins.
- [ ] Domain management uses a dedicated domain router and owner-only settings route at `/settings/domain`, with settings menu linkage.
- [ ] README documents tenant resolution behavior and operator setup paths.
- [ ] Typecheck, lint, and targeted tests pass for touched areas.

## Further Considerations

- Add wildcard-domain support for enterprise-style tenant subdomains as a follow-up.
- Add background re-verification jobs for custom domains to detect stale DNS ownership.
- Consider introducing a dedicated tenant context object in request context to remove repeated family resolution logic in route handlers.
