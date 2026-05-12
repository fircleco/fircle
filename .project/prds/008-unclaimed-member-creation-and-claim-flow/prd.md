---
title: "Unclaimed Member Creation and Claim Flow - Live Family Identity Linking"
status: in-progress
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
- optionally binding claim links to a specific email address
- claiming an existing family member profile from the public claim route
- linking the claimed profile to a newly created auth account

This PRD does not yet cover member tagging, post ownership migration, or broader family activity relationships, but the implementation must preserve `FamilyMember` as the anchor for those future relations.

### Design Decisions

- **`FamilyMember` is the identity record**: Member-level relationships should hang off `FamilyMember`, not `User`. `User` is only the account layer.
- **Nullable `userId` means unclaimed**: `FamilyMember.userId = null` is the canonical representation for an unclaimed member. No separate profile table should be introduced in this phase.
- **Profile fields are member-scoped**: `name` and `image` should live on `FamilyMember`. The `User` model should not store these fields.
- **Reuse `Invite` with `claimMemberId`**: Keep one invite model. Treat invites with `claimMemberId != null` as member-claim invites, and invites with `claimMemberId = null` as normal family registration invites.
- **Token-based by default**: Claiming should work via a generated token link.
- **Optional email binding**: Claim links may optionally be bound to an email address for extra verification, but email binding is not required for all claims.
- **Create first, claim later**: Family admins can create an unclaimed member without requiring that person to be present or know their final email yet.
- **Claiming should avoid duplicates**: A successful claim must attach the new account to the existing `FamilyMember` record instead of creating a second member entry.
- **Admin-managed creation and claim issuance**: Only authorized family members (owner/admin) can create unclaimed members or issue claim links in MVP.
- **Preserve existing static UIs**: The existing add-member and claim pages are the contract. This phase should wire them to live data rather than redesign them.

### User Stories

- **As a** family organizer, **I want** to create a family member before they join the app, **so that** the whole family can be represented from the start.
- **As a** family organizer, **I want** to optionally attach an email to a future claim, **so that** I can add extra verification when needed.
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

- [ ] Add a member-claim helper module under `src/lib` for token generation, claim status evaluation, and lifecycle checks.
- [ ] Add helper predicate for invite intent inference:
  - [ ] `isClaimInvite(invite) => invite.claimMemberId != null`
- [ ] Add zod schemas for:
  - [ ] create unclaimed member input
  - [ ] generate claim link input
  - [ ] claim link lookup input
  - [ ] claim member input
- [ ] Implement centralized claim status evaluation covering:
  - [ ] valid
  - [ ] expired
  - [ ] claimed
  - [ ] revoked
  - [ ] invalid
- [ ] Implement optional email-binding validation for claim links.
- [ ] Reuse or extend existing email normalization utilities for safe email comparisons.
- [ ] Define stable error codes/messages for duplicate member, already-claimed member, already-used claim link, email mismatch, and invalid token cases.

---

### Phase 3: Add tRPC Procedures for Member Creation and Claiming

**Goal:** Provide live backend procedures for creating unclaimed members, issuing claim links, and claiming existing profiles.

#### Tasks

- [ ] Create a dedicated router such as `src/server/api/routers/family-member.ts` or extend the existing member router if one exists.
- [ ] Add a protected `createUnclaimedMember` mutation.
- [ ] Ensure `createUnclaimedMember` is limited to owner/admin family members.
- [ ] Add a protected `createClaimLink` mutation for unclaimed members that creates an `Invite` with `claimMemberId` set.
- [ ] Add a public `getClaimLinkByToken` query for claim-page lookup.
- [ ] Add a public `claimMemberProfile` mutation that:
  - [ ] validates the token
  - [ ] verifies the invite is a claim invite (`claimMemberId` is set)
  - [ ] validates optional email binding
  - [ ] rejects already-claimed or revoked links
  - [ ] rejects claiming a member that already has a `userId`
  - [ ] creates a new `User` with hashed password (account fields only; no name/image persisted on `User`)
  - [ ] links that `User` to `invite.claimMemberId`
  - [ ] marks the claim link as claimed
- [ ] Make the claim mutation transactional to prevent duplicate claims under race conditions.
- [ ] Register the router in `src/server/api/root.ts`.

---

### Phase 4: Wire Existing Screens to Live Data

**Goal:** Replace mocked create/claim behavior with working backend integration while preserving the current UI structure.

#### Tasks

- [ ] Update `src/app/(app)/members/new/page.tsx` to submit to `createUnclaimedMember`.
- [ ] Preserve the existing success state on the add-member page, but populate it from real mutation results.
- [ ] Add inline handling for create-member failures such as duplicate member conflicts or validation errors.
- [ ] Update `src/app/auth/claim/[token]/page.tsx` to fetch live claim-link preview data by token.
- [ ] Replace `src/lib/mocks/family-members` usage in the claim page with live query data.
- [ ] Submit the claim form to `claimMemberProfile`.
- [ ] Render distinct live states on the claim page for:
  - [ ] invalid token
  - [ ] expired token
  - [ ] revoked token
  - [ ] already claimed link
  - [ ] member already claimed
  - [ ] email mismatch
  - [ ] success
- [ ] Route the user into the correct next step after a successful claim:
  - [ ] either auto sign-in and redirect into the app
  - [ ] or redirect to sign-in with a clear success state
- [ ] Keep the UI contract compatible with optional email-bound and non-email-bound claim flows.

---

### Phase 5: Admin Claim-Link Management and Safety Checks

**Goal:** Make claim issuance manageable for family admins and safe in real usage.

#### Tasks

- [ ] Add a minimal surface for generating a claim link from an unclaimed member profile or member list action.
- [ ] Display the generated claim URL/token so it can be copied and shared.
- [ ] Support optionally setting or omitting the claim email during link generation.
- [ ] Prevent claim-link creation for members who are already claimed.
- [ ] Prevent multiple simultaneously active claim links for the same member unless the product explicitly allows replacement behavior.
- [ ] If replacement behavior is preferred, revoke older active links when a new claim link is generated.
- [ ] Add audit-friendly timestamps and creator/claimer attribution to persisted records.

---

### Phase 6: Hardening and QA

**Goal:** Verify correctness, resilience, and end-to-end usability of the unclaimed-member flow.

#### Tasks

- [ ] Add rate-limit guard rails for public claim-link lookup and claim submission.
- [ ] Verify create-member permissions for owner/admin versus regular members.
- [ ] Test successful unclaimed member creation without email.
- [ ] Test successful unclaimed member creation with optional future claim email.
- [ ] Test token-based claim without email binding.
- [ ] Test token-based claim with matching email binding.
- [ ] Test token-based claim rejection with non-matching email binding.
- [ ] Test rejection for already-claimed members.
- [ ] Test rejection for expired, revoked, and invalid claim links.
- [ ] Run `pnpm check` and validate the Prisma migration path.

## Acceptance Criteria

- [ ] A family admin can create an unclaimed member from the add-member UI.
- [ ] An unclaimed member is stored as a `FamilyMember` with `userId = null`.
- [ ] Claimed and unclaimed members use the same `FamilyMember` identity model.
- [ ] Member profile fields (`name`, `image`) are stored on `FamilyMember`, not `User`.
- [ ] A family admin can generate a claim link for an unclaimed member.
- [ ] Claim links are represented as `Invite` records with `claimMemberId` populated.
- [ ] Registration invites are represented as `Invite` records with `claimMemberId = null`.
- [ ] Claim links support token-based claiming by default.
- [ ] Claim links can optionally enforce an email match.
- [ ] A valid claim creates a new user account and links it to the existing `FamilyMember` record.
- [ ] Claiming does not create a duplicate family member.
- [ ] Invalid, expired, revoked, already-used, and already-claimed flows each return distinct UI states.
- [ ] Non-admin users cannot create unclaimed members or issue claim links.
- [ ] The existing add-member and claim pages are wired to live backend procedures.
- [ ] `pnpm check` passes with no lint or type errors after implementation.
