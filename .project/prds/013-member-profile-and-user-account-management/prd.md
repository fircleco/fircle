---
title: "Member Profile and User Account Management"
status: in-progress
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/009-role-based-permissions-owner-vs-admin/prd.md
    description: "Role-based authorization boundaries for owner/admin/member actions"
  - type: prd
    url: .project/prds/011-post-like-system/prd.md
    description: "Post like model and interaction patterns used for liked-post profile listing"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` - when work begins on any phase.
>   - `completed` - when all tasks and acceptance criteria are done.
>   - `on-hold` - if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Member Profile and User Account Management

## Description

Fircle currently supports member identity, role management, posts, likes, and comments, but important user-centric account workflows are still incomplete. Profile editing is currently demo-only, account password management is missing from Settings, admin-side password reset actions are placeholders, and profile tabs do not yet show liked posts.

This PRD introduces a complete member/profile and account management pass that covers:
- Current-user password change in Settings > Account.
- Admin temporary password reset from the member profile admin panel.
- Real profile editing (name + profile image) for both current user and admins.
- Profile liked-post listing on both self profile and member-by-slug profile pages.

The implementation should reuse existing architecture patterns: Prisma-backed data model, tRPC protected procedures, role and family membership guards, existing media upload infrastructure, and optimistic UI conventions where appropriate.

### Design Decisions

- **Password change is explicit account security flow**: Current users must provide current password and new password in Settings > Account.
- **Admin reset uses temporary password**: Admins/owners can set a temporary password for claimed members from the admin panel; unclaimed members cannot be reset.
- **Profile edit scope is intentionally narrow**: This phase includes only member name and profile image to keep delivery fast and reduce schema churn.
- **Admin profile editing surface is member profile admin panel**: Do not add duplicate edit entry points in Settings > Roles for this phase.
- **Liked posts are visible across family member profiles**: Liked tab should work on both `/profile` and `/member/[slug]` within family access boundaries.
- **Reuse upload intent and storage conventions**: Avatar upload should use existing signed-upload infrastructure with avatar-specific object key segmentation.
- **Authorization stays server-first**: Every mutation/query must enforce family membership and role checks in tRPC procedures.

### User Stories

- **As a** signed-in member, **I want** to change my password from account settings, **so that** I can keep my account secure without leaving the app.
- **As an** admin or owner, **I want** to reset a claimed member's password to a temporary one, **so that** I can help recover access when needed.
- **As a** member, **I want** to edit my display name and profile image, **so that** my identity in family spaces stays accurate.
- **As an** admin, **I want** to edit another member's basic profile info from their profile admin panel, **so that** family records stay clean and up to date.
- **As a** family member, **I want** to see liked posts on profile tabs, **so that** I can browse what I or another member has engaged with.

## Implementation Plan

### Phase 1: Backend Contracts for Password and Profile Operations

**Goal:** Add secure server-side procedures for self password change, admin temporary reset, and profile updates.

#### Tasks

- [x] Add/update input schemas in [src/server/api/routers/family-member.ts](src/server/api/routers/family-member.ts) for:
  - [x] `changeMyPassword` (`familyId`, `currentPassword`, `newPassword`, `confirmPassword` validation on server contract).
  - [x] `adminResetMemberPassword` (`familyId`, `memberId`, `temporaryPassword`).
  - [x] `updateMemberProfile` (`familyId`, `memberId`, `name`, `image`).
- [x] Implement `changeMyPassword` mutation:
  - [x] Resolve caller membership in `familyId`.
  - [x] Fetch `User.password` and verify current password via `bcrypt.compare`.
  - [x] Reject invalid current password with non-leaking error message.
  - [x] Hash new password and update `User.password`.
- [x] Implement `adminResetMemberPassword` mutation:
  - [x] Enforce owner/admin via existing admin membership helper.
  - [x] Ensure target member belongs to same family and is claimed (`userId` not null).
  - [x] Hash and persist temporary password to target user account.
  - [x] Record admin reset event in audit persistence (new model or minimal existing-compatible logging strategy).
- [x] Implement `updateMemberProfile` mutation:
  - [x] Allow self-edit when caller owns target member record.
  - [x] Allow owner/admin edit for any member in same family.
  - [x] Persist `name` and `image` updates on `FamilyMember`.
- [x] Add or update router tests for permissions and negative paths:
  - [x] Wrong current password.
  - [x] Member attempting admin reset.
  - [x] Admin reset on unclaimed member.
  - [x] Cross-family member targeting.

### Phase 2: Avatar Upload and Profile Edit UX

**Goal:** Replace demo-only profile dialog behavior with real upload + save flow for self and admin use.

#### Tasks

- [x] Extend upload intent handling in [src/app/api/uploads/intent/route.ts](src/app/api/uploads/intent/route.ts) to support avatar uploads with image-only constraints and single-file behavior.
- [x] Add avatar object-key helper in [src/server/storage/media-object-key.ts](src/server/storage/media-object-key.ts) for a dedicated avatar path segment under family/member scope.
- [x] Update [src/components/members/edit-profile-dialog.tsx](src/components/members/edit-profile-dialog.tsx):
  - [x] Remove demo-only save behavior.
  - [x] Add local file picker, preview, upload progress, and upload error states.
  - [x] Call signed upload intent + upload to storage + submit `updateMemberProfile` mutation.
  - [x] Keep fields limited to `name` and `profile image`.
- [x] Ensure [src/components/members/member-admin-panel.tsx](src/components/members/member-admin-panel.tsx) uses the same live dialog flow for admin edits.
- [x] Invalidate/refetch member profile queries after successful update so avatars and names refresh immediately.

### Phase 3: Settings Account Password UI and Admin Reset UX

**Goal:** Ship complete UI entry points for account password change and admin temporary reset.

#### Tasks

- [x] Add Account navigation item in [src/app/(app)/settings/layout.tsx](src/app/(app)/settings/layout.tsx).
- [x] Create [src/app/(app)/settings/account/page.tsx](src/app/(app)/settings/account/page.tsx):
  - [x] Build form with current password, new password, confirm password.
  - [x] Wire submit to `changeMyPassword` mutation.
  - [x] Show loading, success, and error states with accessible messaging.
- [x] Update admin reset card in [src/components/members/member-admin-panel.tsx](src/components/members/member-admin-panel.tsx):
  - [x] Replace placeholder button with temporary password entry flow.
  - [x] Add confirmation guardrail before mutation submit.
  - [x] Show clear success/error outcomes.
- [ ] Perform manual UX checks for desktop and mobile form usability.

### Phase 4: Profile Liked Posts Listing

**Goal:** Populate profile Liked tabs with real data for self and other member profiles.

#### Tasks

- [x] Add `getLikedPostsByMember` query in [src/server/api/routers/post.ts](src/server/api/routers/post.ts):
  - [x] Input: `familyId`, `memberId`, `limit`, optional `cursor`.
  - [x] Enforce family membership access guard.
  - [x] Query posts liked by target member using `PostLike` relation.
  - [x] Reuse existing cursor strategy (`createdAt` + `id`) for stable pagination.
  - [x] Return `PostCard`-compatible response shape via existing mapping patterns.
- [x] Update [src/app/(app)/profile/page.tsx](src/app/(app)/profile/page.tsx) to fetch/render liked posts for current member Liked tab.
- [x] Update [src/app/(app)/member/[slug]/page.tsx](src/app/(app)/member/[slug]/page.tsx) to fetch/render liked posts for viewed member Liked tab.
- [x] Preserve empty state behavior when no likes exist.
- [ ] Optionally add incremental load-more support if `nextCursor` is returned.

### Phase 5: Validation, Hardening, and Release Readiness

**Goal:** Ensure security, correctness, and regression safety before completion.

#### Tasks

- [x] Add/adjust automated tests for new password/profile/liked-post procedures and UI-critical integration points where feasible.
- [x] Confirm password flows do not expose sensitive values in logs, errors, or UI states.
- [x] Run project quality checks:
  - [x] `pnpm lint`
  - [x] `pnpm typecheck`
  - [x] `pnpm test`
- [ ] Execute manual QA checklist:
  - [ ] Current user can change password with correct current password.
  - [ ] Current user cannot change password with incorrect current password.
  - [ ] Admin/owner can set temporary password for claimed member.
  - [ ] Admin reset is blocked for unclaimed member.
  - [ ] Self profile edit persists name and avatar.
  - [ ] Admin profile edit persists target member name and avatar.
  - [ ] Liked tab renders expected posts on both self and member-slug profiles.

## Acceptance Criteria

- [ ] Settings includes an Account section with a working current-password-required password change flow.
- [ ] Admin panel on member profile supports temporary password reset for claimed members only.
- [ ] Profile edit dialog saves real data (name and image) for both self and admin edit contexts.
- [ ] Avatar uploads use signed upload flow and persist usable profile image URLs.
- [ ] Liked posts display correctly in Liked tabs on both `/profile` and `/member/[slug]`.
- [ ] All new backend procedures enforce family membership and role constraints correctly.
- [ ] Automated checks (lint/typecheck/tests) pass for the implemented changes.
- [ ] Manual QA confirms functional behavior on desktop and mobile for all covered flows.
