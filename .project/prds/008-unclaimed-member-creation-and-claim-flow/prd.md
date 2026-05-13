---
title: "Unclaimed Member Creation and Claim Flow - Live Family Identity Linking"
status: completed
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/004-family-identity-static-ui/prd.md
    description: "Static family identity UI foundation"
  - type: prd
    url: .project/prds/007-invite-only-registration-flow/prd.md
    description: "Live invite-only registration flow and invite patterns"
  - type: pr
    url: https://github.com/babblebey/fircle/pull/13
    description: "Implementation pull request - feat: implement unclaimed member creation and claim flow"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` — when work begins on any phase.
>   - `completed` — when all tasks and acceptance criteria are done.
>   - `on-hold` — if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Unclaimed Member Creation and Claim Flow - Live Family Identity Linking

## Description

This PRD turns Fircle's family identity static UI into a working unclaimed-member system.

Family organizers should be able to create a family member profile even when that person is not present and does not yet have an account. Later, that real person should be able to claim the existing profile and link it to a newly created user account without creating a duplicate family identity.

This feature establishes `FamilyMember` as the primary family-scoped identity record. A `User` is only the auth account that may later be linked to that member. In practical terms, an unclaimed member is represented by a `FamilyMember` record whose `userId` is `null`. Member profile fields like display name and image should live on `FamilyMember`, not `User`.

This PRD covers:
- creating unclaimed family members from the existing add-member screen
- generating claim links for unclaimed members
- auto-generating an email-bound claim link immediately when add-member includes an email
- introducing member identity fields (`name`, optional `nickname`, and family-scoped `slug`)
- using slug-based member profile URLs at `/member/[slug]`
- optionally binding claim links to a specific email address
- claiming an existing family member profile from the public claim route
- linking the claimed profile to a newly created auth account

This PRD does not yet cover member tagging, post ownership migration, or broader family activity relationships, but the implementation must preserve `FamilyMember` as the anchor for those future relations.

### Design Decisions

- **`FamilyMember` is the identity record**: Member-level relationships should hang off `FamilyMember`, not `User`. `User` is only the account layer.
- **Nullable `userId` means unclaimed**: `FamilyMember.userId = null` is the canonical representation for an unclaimed member. No separate profile table should be introduced in this phase.
- **Profile fields are member-scoped**: `name` and `image` should live on `FamilyMember`. The `User` model should not store these fields.
- **Member name is required**: `FamilyMember.name` is required and should not be nullable.
- **Duplicate names are allowed**: family members can share the same `name`; identity checks should not rely on name uniqueness.
- **Nickname is optional**: `nickname` is an optional family-friendly display handle.
- **Slug is canonical for profile URLs**: each member has a family-scoped unique `slug` used for `/member/[slug]`.
- **Slug generation source**: generate slug from `nickname` when present, otherwise from `name`.
- **Reuse `Invite` with `claimMemberId`**: Keep one invite model. Treat invites with `claimMemberId != null` as member-claim invites, and invites with `claimMemberId = null` as normal family registration invites.
- **Token-based by default**: Claiming should work via a generated token link.
- **Optional email binding**: Claim links may optionally be bound to an email address for extra verification, but email binding is not required for all claims.
- **Create first, claim later**: Family admins can create an unclaimed member without requiring that person to be present or know their final email yet.
- **Email on create can invite immediately**: If an email is provided during unclaimed-member creation, the system immediately creates an email-bound claim invite for that profile.
- **Claiming should avoid duplicates**: A successful claim must attach the new account to the existing `FamilyMember` record instead of creating a second member entry.
- **Admin-managed creation and claim issuance**: Only authorized family members (owner/admin) can create unclaimed members or issue claim links in MVP.
- **Preserve existing static UIs**: The existing add-member and claim pages are the contract. This phase should wire them to live data rather than redesign them.
- **No relationship field**: `FamilyMember` does not store a relationship label. Relationship is inherently subjective — the same person may be a parent to one member and a grandparent's child to another — and a single stored value would be misleading or require per-viewer overrides. Relationship context is omitted from all member creation, editing, display, and search surfaces.

### User Stories

- **As a** family organizer, **I want** to create a family member before they join the app, **so that** the whole family can be represented from the start.
- **As a** family organizer, **I want** to optionally attach an email to a future claim, **so that** I can add extra verification when needed.
- **As a** family organizer, **I want** an email entered during member creation to immediately generate a claim link, **so that** I can invite them right away without extra steps.
- **As a** family organizer, **I want** to send a claim link to an unclaimed member later, **so that** they can take over their existing profile without creating a duplicate identity.
- **As a** person receiving a claim link, **I want** to claim my family profile and create my account in one flow, **so that** I can join the app with the right family identity already attached.
- **As a** family member, **I want** claimed and unclaimed members to appear as the same kind of family identity record, **so that** future tags, posts, and activities can refer to one consistent member model.
- **As a** family admin, **I want** already-claimed and invalid claim attempts to fail safely, **so that** family identity cannot be hijacked or duplicated.

## Implementation Plan

### Phase 1: Update the Data Model for Unclaimed Members

**Goal:** Make the Prisma schema represent claimed and unclaimed members with the same `FamilyMember` model.

#### Tasks

- [x] Update `prisma/schema.prisma` so `FamilyMember.userId` is nullable.
- [x] Update the `FamilyMember -> User` relation to be optional while preserving family membership behavior for claimed members.
- [x] Add member-owned profile fields needed for unclaimed rendering if they do not already exist, such as:
  - [x] `name`
  - [x] `image`
- [x] Remove `name` and `image` from the `User` model and migrate any display/profile reads to `FamilyMember`.
- [x] Review `@@unique([familyId, userId])` and related indexes to ensure they still behave correctly with nullable `userId`.
- [x] Extend `Invite` in `prisma/schema.prisma` with optional `claimMemberId` (relation to `FamilyMember`).
- [x] Add relation fields for claim targeting:
  - [x] `Invite.claimMember`
  - [x] `FamilyMember.claimInvites`
- [x] Keep existing invite lifecycle fields and reuse them for claim invites:
  - [x] `code`
  - [x] optional `invitedEmail`
  - [x] `createdById`
  - [x] `expiresAt`
  - [x] `claimedAt`
  - [x] `claimedById`
  - [x] `revokedAt`
- [ ] Add app-level validation rule: if `claimMemberId` is set, `invite.familyId` must match `claimMember.familyId`.
- [x] Add indexes and constraints for safe token lookup and single-claim behavior.
- [x] Generate a Prisma migration for the schema changes.

---

### Phase 2: Add Claim Domain Rules and Validation

**Goal:** Introduce reusable business logic for unclaimed members and claim links.

#### Tasks

- [x] Add a member-claim helper module under `src/lib` for token generation, claim status evaluation, and lifecycle checks.
- [x] Add helper predicate for invite intent inference:
  - [x] `isClaimInvite(invite) => invite.claimMemberId != null`
- [x] Add zod schemas for:
  - [x] create unclaimed member input
  - [x] generate claim link input
  - [x] claim link lookup input
  - [x] claim member input
- [x] Implement centralized claim status evaluation covering:
  - [x] valid
  - [x] expired
  - [x] claimed
  - [x] revoked
  - [x] invalid
- [x] Implement optional email-binding validation for claim links.
- [x] Reuse or extend existing email normalization utilities for safe email comparisons.
- [x] Define stable error codes/messages for duplicate member, already-claimed member, already-used claim link, email mismatch, and invalid token cases.

---

### Phase 3: Add tRPC Procedures for Member Creation and Claiming

**Goal:** Provide live backend procedures for creating unclaimed members, issuing claim links, and claiming existing profiles.

#### Tasks

- [x] Create a dedicated router such as `src/server/api/routers/family-member.ts` or extend the existing member router if one exists.
- [x] Add a protected `createUnclaimedMember` mutation.
- [x] Ensure `createUnclaimedMember` is limited to owner/admin family members.
- [x] Add a protected `createClaimLink` mutation for unclaimed members that creates an `Invite` with `claimMemberId` set.
- [x] Add a public `getClaimLinkByToken` query for claim-page lookup.
- [x] Add a public `claimMemberProfile` mutation that:
  - [x] validates the token
  - [x] verifies the invite is a claim invite (`claimMemberId` is set)
  - [x] validates optional email binding
  - [x] rejects already-claimed or revoked links
  - [x] rejects claiming a member that already has a `userId`
  - [x] creates a new `User` with hashed password (account fields only; no name/image persisted on `User`)
  - [x] links that `User` to `invite.claimMemberId`
  - [x] marks the claim link as claimed
- [x] Make the claim mutation transactional to prevent duplicate claims under race conditions.
- [x] Register the router in `src/server/api/root.ts`.

---

### Phase 4: Wire Existing Screens to Live Data

**Goal:** Replace mocked create/claim behavior with working backend integration while preserving the current UI structure.

#### Tasks

- [x] Update `src/app/(app)/members/new/page.tsx` to submit to `createUnclaimedMember`.
- [x] Preserve the existing success state on the add-member page, but populate it from real mutation results.
- [x] Add inline handling for create-member failures such as duplicate member conflicts or validation errors.
- [x] When add-member email is provided, auto-create an email-bound claim invite in the same create flow and return invite metadata.
- [x] Show the generated claim link in the add-member success state when an auto-created invite exists.
- [x] Update `src/app/auth/claim/[token]/page.tsx` to fetch live claim-link preview data by token.
- [x] Replace `src/lib/mocks/family-members` usage in the claim page with live query data.
- [x] Submit the claim form to `claimMemberProfile`.
- [x] Render distinct live states on the claim page for:
  - [x] invalid token
  - [x] expired token
  - [x] revoked token
  - [x] already claimed link
  - [x] member already claimed
  - [x] email mismatch
  - [x] success
- [x] Route the user into the correct next step after a successful claim:
  - [ ] either auto sign-in and redirect into the app
  - [x] or redirect to sign-in with a clear success state
- [x] Keep the UI contract compatible with optional email-bound and non-email-bound claim flows.

---

### Phase 5: Admin Claim-Link Management and Safety Checks

**Goal:** Make claim issuance manageable for family admins and safe in real usage.

#### Tasks

- [x] Add a minimal surface for generating a claim link from an unclaimed member profile or member list action.
- [x] Display the generated claim URL/token so it can be copied and shared.
- [x] Support optionally setting or omitting the claim email during link generation.
- [x] Prevent claim-link creation for members who are already claimed.
- [x] Prevent multiple simultaneously active claim links for the same member unless the product explicitly allows replacement behavior.
- [x] If replacement behavior is preferred, revoke older active links when a new claim link is generated.
- [x] Add audit-friendly timestamps and creator/claimer attribution to persisted records.

---

### Phase 6: Hardening and QA

**Goal:** Verify correctness, resilience, and end-to-end usability of the unclaimed-member flow.

#### Tasks

- [x] Add rate-limit guard rails for public claim-link lookup and claim submission.
- [x] Verify create-member permissions for owner/admin versus regular members.
- [x] Test successful unclaimed member creation without email.
- [x] Test successful unclaimed member creation with optional future claim email.
- [x] Test that add-member email creates an immediate email-bound claim invite and returns a usable claim link.
- [x] Test token-based claim without email binding.
- [x] Test token-based claim with matching email binding.
- [x] Test token-based claim rejection with non-matching email binding.
- [x] Test rejection for already-claimed members.
- [x] Test rejection for expired, revoked, and invalid claim links.
- [x] Update `prisma/seed.mjs` so seeded `FamilyMember` records include valid required identity fields (`name`, `slug`) and optional `nickname`.
- [x] Run `pnpm check` and validate the Prisma migration path.

---

### Phase 7: Member Identity and Slug Routing

**Goal:** Introduce required member identity fields and slug-based member profile routing.

#### Tasks

- [x] Update `FamilyMember` schema so `name` is required and add optional `nickname` plus required `slug`.
- [x] Add family-scoped uniqueness on member slug (`@@unique([familyId, slug])`).
- [x] Add migration backfill for existing members to ensure required `name` and `slug` are populated.
- [x] Add shared slug utility to normalize slug text and resolve family-scoped collisions.
- [x] Update create-member validation schema to accept optional `nickname`.
- [x] Remove duplicate-name blocking in create-member flow.
- [x] Generate/store `slug` during unclaimed member creation.
- [x] Ensure invite acceptance creates `FamilyMember` records with required `slug`.
- [x] Add optional nickname input to add-member UI and submit it in create-member payload.
- [x] Switch member card links from id-based URLs to `/member/[slug]`.
- [x] Add slug-based member profile route at `src/app/(app)/member/[slug]/page.tsx`.
- [x] Extend mock member data with `slug`/`nickname` and add slug lookup helper for route rendering.
- [x] Add schema tests for nickname acceptance and validation behavior.

## Acceptance Criteria

- [x] A family admin can create an unclaimed member from the add-member UI.
- [x] An unclaimed member is stored as a `FamilyMember` with `userId = null`.
- [x] Claimed and unclaimed members use the same `FamilyMember` identity model.
- [x] Member profile fields (`name`, `image`) are stored on `FamilyMember`, not `User`.
- [x] When add-member includes an email, the system creates an email-bound claim invite for that member immediately.
- [x] A family admin can generate a claim link for an unclaimed member.
- [x] Claim links are represented as `Invite` records with `claimMemberId` populated.
- [x] Registration invites are represented as `Invite` records with `claimMemberId = null`.
- [x] Claim links support token-based claiming by default.
- [x] Claim links can optionally enforce an email match.
- [x] A valid claim creates a new user account and links it to the existing `FamilyMember` record.
- [x] Claiming does not create a duplicate family member.
- [x] Invalid, expired, revoked, already-used, and already-claimed flows each return distinct UI states.
- [x] Non-admin users cannot create unclaimed members or issue claim links.
- [x] The existing add-member and claim pages are wired to live backend procedures.
- [x] Local seed data remains compatible with the current Prisma schema for `FamilyMember` identity fields.
- [x] `pnpm check` passes with no lint or type errors after implementation.
- [x] `FamilyMember.name` is required and non-null for persisted records.
- [x] Family members with the same display name can coexist in the same family.
- [x] Member profile URLs are slug-based (`/member/[slug]`) and resolve by member slug.
- [x] Slug generation uses `nickname` first, then falls back to `name`.
- [x] Slug uniqueness is enforced per family.
