---
title: "Role-Based Permissions — Owner vs Admin Enforcement"
status: completed
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/007-invite-only-registration-flow/prd.md
    description: "Live invite-only registration — established admin/owner invite guards"
  - type: prd
    url: .project/prds/008-unclaimed-member-creation-and-claim-flow/prd.md
    description: "Unclaimed member creation and claim flow — established requireAdminMembership helper"
  - type: pr
    url: https://github.com/babblebey/fircle/pull/15
    description: "Implementation pull request - feat: implement role-based permissions"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` — when work begins on any phase.
>   - `completed` — when all tasks and acceptance criteria are done.
>   - `on-hold` — if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Role-Based Permissions — Owner vs Admin Enforcement

## Description

Fircle has three member roles — Owner, Admin, and Member — but currently Owner and Admin have identical server-side permissions. Every guarded mutation simply checks `role === "ADMIN" || role === "OWNER"`, meaning an Admin can do anything an Owner can, including changing roles.

The roles page (`/settings/roles`) already documents the intended differentiation, and the role-change buttons in the member admin panel exist but are completely unconnected. This PRD closes the gap by:

1. Enforcing Owner-only actions on the server.
2. Wiring up role management UI so an Owner can promote/demote members.
3. Ensuring the admin panel hides Role management controls when the role cannot be changed.
4. Enforcing manager-only access to member creation UI so Members cannot see create-member controls or use `/members/new` directly.

### Design Decisions

- **No Owner assignment via `updateMemberRole`**: Promoting someone to Owner is a destructive, irreversible-feeling action. It will be handled by a separate `transferOwnership` mutation in a future PRD to keep the blast radius small. `updateMemberRole` only accepts `MEMBER` or `ADMIN` as target roles.
- **Self-demotion prevention**: An Owner cannot demote themselves via `updateMemberRole` to prevent accidental family lockout. A future ownership-transfer flow will handle that intentionally.
- **Caller role passed to `MemberAdminActionsPanel`**: The panel currently has no awareness of who is viewing it. Rather than fetching inside the component, the member profile page (which already has access to the management context) will pass `callerRole` as a prop.
- **`requireOwnerMembership` is a sibling helper to `requireAdminMembership`**: Keeps permission logic co-located and consistent in `family-member.ts`.
- **Hide Role management when not actionable**: Instead of showing disabled role buttons, the Role management card is hidden when the caller is not an Owner or the viewed member is already an Owner.
- **Member creation access is role-gated at both entry point and route**: `Add family member` actions are hidden for non-managers, and unauthorized visits to `/members/new` are redirected back to `/members`.
- **Role badge on roles page uses `Badge` component**: The roles page still uses hand-rolled badge spans. It will be updated to use the `Badge` + role-color variant consistent with the rest of the app.

### User Stories

- **As an Owner**, I want to promote a Member to Admin or demote an Admin to Member, so that I can manage who has elevated access without needing a developer.
- **As an Admin**, I want the role-change controls to be visibly inaccessible to me, so that I clearly understand the boundary of my permissions.
- **As an Owner**, I want my role-change action to be reflected immediately, so that the change takes effect without a page reload.
- **As a Member**, I want the admin panel to be hidden from me entirely when I view another member's profile, so that I am not confused by controls I cannot use.

## Implementation Plan

### Phase 1: Server — Owner-only helper and `updateMemberRole` mutation

**Goal:** Add a `requireOwnerMembership` guard and a wired-up `updateMemberRole` mutation to `familyMemberRouter`.

#### Tasks

- [x] Add `requireOwnerMembership` helper in `src/server/api/routers/family-member.ts` alongside `requireAdminMembership`:
  ```ts
  async function requireOwnerMembership(
    db: Prisma.TransactionClient,
    familyId: string,
    userId: string,
  ) {
    const membership = await getMembership(db, familyId, userId)
    if (!membership || membership.role !== "OWNER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only the family owner can perform this action",
      })
    }
    return membership
  }
  ```
- [x] Add `updateMemberRole` mutation to `familyMemberRouter` in `src/server/api/routers/family-member.ts`:
  - Input: `{ memberId: z.string().cuid(), role: z.enum(["MEMBER", "ADMIN"]) }`
  - Resolve the target member, obtain `familyId`, call `requireOwnerMembership`
  - Reject if `memberId` resolves to the calling user (self-demotion guard)
  - Reject if the target member is an OWNER (cannot reassign another Owner without transfer flow)
  - Update `FamilyMember.role` in the database
  - Return `{ id, role }` of the updated member

### Phase 2: Client — pass `callerRole` to `MemberAdminActionsPanel`

**Goal:** The panel knows whether the viewer is an Owner or Admin so it can gate role controls.

#### Tasks

- [x] Update `MemberAdminPanelProps` in `src/components/members/member-admin-panel.tsx` to accept `callerRole: MemberRole`
- [x] In `src/app/(app)/member/[slug]/page.tsx` (or whichever server/client component renders the panel), resolve the caller's role from the management context and pass it as `callerRole`
- [x] In `MemberAdminActionsPanel`, derive `isCallerOwner = callerRole === "owner"` for use in the next phase

### Phase 3: Client — wire role buttons and apply Owner gate

**Goal:** Role buttons call `updateMemberRole`, render only when actionable, and update the UI optimistically.

#### Tasks

- [x] In `MemberAdminActionsPanel`, add `updateMemberRole` tRPC mutation:
  ```ts
  const updateRole = api.familyMember.updateMemberRole.useMutation({
    onSuccess: async () => {
      await Promise.all([
        trpcUtils.familyMember.getMemberProfileBySlug.invalidate(),
        trpcUtils.familyMember.listFamilyMembers.invalidate(),
      ])
    },
  })
  ```
- [x] Connect each role button (`Member`, `Admin`) to call `updateRole.mutate({ memberId: member.id, role: ... })`
- [x] Remove the `Owner` button from the role picker (assigning Owner is not supported here)
- [x] Hide the entire Role management block when role changes are not actionable (for example, when the caller is not an Owner)
- [x] Disable role buttons while `updateRole.isPending`
- [x] Show inline error if `updateRole.error` is set

### Phase 4: Roles page — connect to real data and use `Badge`

**Goal:** `/settings/roles` shows live member data and consistent badge styling.

#### Tasks

- [x] Replace mock `familyMembers` import in `src/app/(app)/settings/roles/page.tsx` with `api.familyMember.listFamilyMembers.useQuery`
- [x] Convert the page to a `"use client"` component (or keep it server with a tRPC server caller)
- [x] Replace hand-rolled role badge `<span>` elements with `<Badge>` using appropriate variant + `className` color overrides matching existing `roleBadgeStyles`
- [x] Replace hand-rolled status badge `<span>` with `<MemberStatusBadge>` (already used in the same file for unclaimed members — ensure consistent use)

## Acceptance Criteria

- [x] An Admin calling `updateMemberRole` receives a `FORBIDDEN` error
- [x] An Owner can promote a Member to Admin and the change persists in the database
- [x] An Owner can demote an Admin to Member and the change persists
- [x] An Owner cannot demote themselves via `updateMemberRole` (server rejects with a clear error)
- [x] An Owner cannot target another Owner via `updateMemberRole` (server rejects)
- [x] Role management block is hidden when role changes are not controllable (viewer is not Owner or target member is Owner)
- [x] Role buttons call the mutation and invalidate the correct queries on success
- [x] The roles settings page shows real member data (not mock)
- [x] Role badges on the roles page use the `Badge` component
- [x] Member users do not see `Add family member` CTAs on the members page
- [x] Unauthorized direct access to `/members/new` is blocked (redirected to `/members`)
