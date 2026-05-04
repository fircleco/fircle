---
title: "Invite and Access Static UI — Invite Management, Family Settings, and Roles"
status: in-progress
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/001-foundation-ui-app-shell-navigation/prd.md
    description: "App shell and navigation foundation"
  - type: prd
    url: .project/prds/004-family-identity-static-ui/prd.md
    description: "Family identity screens and member status patterns"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` — when work begins on any phase.
>   - `completed` — when all tasks and acceptance criteria are done.
>   - `on-hold` — if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Invite and Access Static UI — Invite Management, Family Settings, and Roles

## Description

This PRD defines the static UI for the access control layer of Fircle: the surfaces that let a family admin control who can join, manage outstanding invites, configure the family space, and assign member roles.

Because Fircle uses an invite-only model, these screens are critical to the product even before backend logic exists. The static UI must make the invite lifecycle, family configuration, and permission levels legible and trustworthy to admins before any wire-up takes place.

Three surfaces are in scope:

1. **Invite Management** (`/settings/invites`) — Create new invites, view active/pending invites, see used/expired history, and revoke invites.
2. **Family Settings** (`/settings`) — Edit the family name, photo/avatar, and invite policy.
3. **Roles and Permissions** (`/settings/roles`) — View which members hold which role (Owner, Admin, Member) and understand what each role can do.

This is **purely static UI**. No invites are generated, no settings are persisted, and no role changes are applied. All data is mocked locally. The goal is to establish the visual structure, information hierarchy, and UX language for access control before wiring Prisma and tRPC.

### Design Decisions

- **Settings as a route group**: All three screens live under `src/app/(app)/settings/` to co-locate access-control concerns and allow a shared settings shell layout (side nav on desktop, stacked nav on mobile).
- **Invite lifecycle in four states**: Invites always exist in one of four states — `pending`, `accepted`, `expired`, `revoked`. The UI must communicate each state distinctly with color and label.
- **Invite creation is a modal or inline panel**: Rather than a separate page, the invite creation form appears as a slide-in panel or modal over the invites list. This keeps context visible and reduces navigation depth.
- **Copy-to-clipboard invite link**: Each pending invite shows its link with a copy button. Functional copy is fine to implement in this phase since it is a pure client-side operation. No API needed.
- **Family settings is owner/admin-only in future**: For now, the page renders normally with a mocked admin context. Role-gating UI indicators (lock icons, disabled states) are out of scope for this PRD.
- **Roles screen is read-only in this phase**: No inline editing. The table shows each member with their assigned role. Editing is deferred to a future PRD when auth and tRPC are live.
- **Three roles only**: `Owner`, `Admin`, `Member`. Keep the model simple and do not introduce granular permissions in the UI yet.
- **Reuse member card patterns**: The roles screen reuses `FamilyMemberSummary` card styling from PRD 004 to maintain visual consistency.
- **Mobile-first**: Settings screens stack vertically on mobile. Desktop layouts can use a two-column split (settings nav + content panel).

### User Stories

- **As a** family admin, **I want** to create a new invite link, **so that** I can share it with a family member I want to add.
- **As a** family admin, **I want** to see all outstanding invites with their status, **so that** I can track who has accepted and who has not.
- **As a** family admin, **I want** to revoke a pending invite, **so that** I can prevent someone from joining if plans change.
- **As a** family owner, **I want** to update the family name and avatar, **so that** the family space feels personalized.
- **As a** family owner, **I want** to see which members hold which role, **so that** I can understand the current access distribution.

## Implementation Plan

### Phase 1: Settings Route Group and Layout

**Goal:** Establish the `(app)/settings` route group with a shared settings shell layout that hosts the side navigation and content area.

#### Tasks

- [x] Create `src/app/(app)/settings/layout.tsx`:
  - Renders a two-panel layout on desktop: left settings nav (~220px) + right content area.
  - On mobile: renders only the content area (nav collapses or moves to a top tab strip).
  - Settings nav items:
    - "Family Settings" → `/settings`
    - "Invites" → `/settings/invites`
    - "Roles" → `/settings/roles`
  - Active link is highlighted using `aria-current="page"` pattern.
- [x] Create `src/app/(app)/settings/page.tsx` — route stub for Family Settings.
- [x] Create `src/app/(app)/settings/invites/page.tsx` — route stub for Invite Management.
- [x] Create `src/app/(app)/settings/roles/page.tsx` — route stub for Roles and Permissions.
- [x] Verify all three routes load inside the settings layout without errors.

---

### Phase 2: Mock Data

**Goal:** Establish typed mock data for invites and member roles, reusable across all three settings screens.

#### Tasks

- [x] Create `src/lib/mocks/invites.ts` with typed mock invite data.
  - Type: `InviteStatus = "pending" | "accepted" | "expired" | "revoked"`
  - Type: `Invite` with fields: `id`, `code`, `invitedEmail` (optional), `createdAt`, `expiresAt`, `status`, `createdBy` (member name), `acceptedBy` (optional member name)
  - Seed at least 6 mock invites covering all four statuses.
- [x] Create or extend `src/lib/mocks/family-members.ts` to include a `role` field.
  - Type: `MemberRole = "owner" | "admin" | "member"`
  - Assign roles across the existing mock members (at least one owner, one admin, rest as members).
- [x] Create `src/lib/mocks/family-settings.ts` with a single mock family config object:
  - Fields: `name`, `avatarUrl` (optional), `invitePolicy: "admin_only" | "any_member"`

---

### Phase 3: Family Settings Page

**Goal:** Build the `/settings` page for editing family name, avatar, and invite policy.

#### Tasks

- [x] Implement `src/app/(app)/settings/page.tsx`:
  - Page heading: "Family Settings"
  - Section: **Family Identity**
    - Avatar/logo upload area (static placeholder, no upload logic):
      - Circular avatar with placeholder icon or current image
      - "Change photo" text button below
    - Family name input: `<Input value="The Smith Family" />`
    - Save button (primary): "Save Changes"
    - Button loading state: "Saving..."
  - Section: **Invite Policy**
    - Label: "Who can send invites?"
    - Radio group or segmented control with two options:
      - "Admins only" (selected by default)
      - "Any member"
    - Helper text (muted, small): "Controls which members can generate invite links for new family members."
    - Save button for this section (or share the one above — design decision left to implementer)
  - Section: **Danger Zone** (muted bordered card at the bottom)
    - "Reset family data" — disabled button with tooltip: "Contact family owner to perform this action."
  - All form actions point to `#` (no submission in this phase).

---

### Phase 4: Invite Management Page

**Goal:** Build the `/settings/invites` page with the full invite lifecycle UI.

#### Tasks

- [x] Implement `src/app/(app)/settings/invites/page.tsx`:
  - Page heading: "Invites"
  - "Create Invite" button (primary, top-right corner) — opens invite creation panel (see below)
  - **Pending invites section**:
    - Heading: "Pending" with count badge
    - List of pending invite rows, each showing:
      - Invite link (truncated, monospace) + "Copy link" icon button
      - Created by (member name, small gray text)
      - Expiry date (e.g., "Expires May 10, 2026")
      - "Revoke" button (destructive/outline variant) — clicking shows inline confirmation: "Revoke this invite? This cannot be undone." with Confirm/Cancel. Visual only, no state change.
  - **Invite history section**:
    - Heading: "History"
    - Table or card list showing accepted, expired, and revoked invites:
      - Status badge (color-coded): `Accepted` (green), `Expired` (gray), `Revoked` (red)
      - Invited email (if set) or "No email specified"
      - Accepted by (member name, if accepted)
      - Date created
    - Empty state: "No invite history yet."
  - **Create Invite panel** (inline slide-in panel or modal):
    - Heading: "New Invite"
    - Optional email field: `<Input type="email" placeholder="Invite by email (optional)" />`
    - Expiry selector (select or radio): "7 days" / "30 days" / "No expiry"
    - "Generate Invite" button (primary)
    - On click: show a mocked success state with the generated link displayed and a "Copy link" button
    - "Cancel" / close button dismisses the panel
  - Empty state (no invites at all): "No invites yet. Create one to add family members."

---

### Phase 5: Roles and Permissions Page

**Goal:** Build the `/settings/roles` read-only page showing each member's role and a role capability reference.

#### Tasks

- [ ] Implement `src/app/(app)/settings/roles/page.tsx`:
  - Page heading: "Roles & Permissions"
  - **Member roles list**:
    - Each row shows:
      - Member avatar + name (reuse member card pattern from PRD 004)
      - Role badge: `Owner` (gold/yellow), `Admin` (blue), `Member` (gray)
      - Claim status badge if unclaimed (reuse pattern from PRD 004)
    - Rows are sorted: Owner first, then Admins, then Members.
    - Read-only in this phase — no edit controls or dropdowns.
    - Future note (as a comment in code): role editing will be added in the admin actions PRD.
  - **Permissions reference table** (below the member list):
    - Heading: "What each role can do"
    - Table with columns: `Action`, `Owner`, `Admin`, `Member`
    - Rows (checkmark ✓ or dash —):

      | Action                    | Owner | Admin | Member |
      |--------------------------|-------|-------|--------|
      | Post photos and videos   | ✓     | ✓     | ✓      |
      | Tag family members       | ✓     | ✓     | ✓      |
      | Add unclaimed members    | ✓     | ✓     | —      |
      | Create invites           | ✓     | ✓     | —      |
      | Revoke invites           | ✓     | ✓     | —      |
      | Edit family settings     | ✓     | ✓     | —      |
      | Change member roles      | ✓     | —     | —      |
      | Delete family data       | ✓     | —     | —      |

---

### Phase 6: QA and Polish

**Goal:** Ensure all settings routes load, visual states are complete, and responsive design holds across breakpoints.

#### Tasks

- [ ] Test all three routes at 375px, 768px, and 1024px.
- [ ] Verify no horizontal scroll at any breakpoint.
- [ ] Confirm settings nav highlights the correct active route on each page.
- [ ] Verify invite status badges are visually distinct (color and label).
- [ ] Confirm copy-link button works (clipboard write).
- [ ] Confirm revoke inline confirmation appears and dismisses correctly (UI only).
- [ ] Confirm invite creation panel opens and shows mocked success state.
- [ ] Run `pnpm check` — no TypeScript or lint errors.
- [ ] Verify dark mode and light mode look correct on all three pages.

---

## Acceptance Criteria

- [ ] `/settings` renders a family settings form with name input, avatar placeholder, and invite policy selector.
- [ ] `/settings/invites` renders pending invites with copy-link and revoke actions, plus invite history grouped by status.
- [ ] `/settings/invites` shows a create-invite panel with optional email, expiry selector, and mocked success state.
- [ ] `/settings/roles` renders a read-only member list with role badges and a permissions reference table.
- [ ] All three pages render inside the shared settings layout with a working nav.
- [ ] Settings nav active state highlights the current route.
- [ ] Invite status badges (`Pending`, `Accepted`, `Expired`, `Revoked`) are color-coded and visually distinct.
- [ ] Copy-link button writes to clipboard.
- [ ] Revoke confirmation pattern is present and dismissible.
- [ ] All pages are fully responsive with no horizontal scroll at 375px, 768px, or 1024px.
- [ ] Dark mode renders correctly on all three pages.
- [ ] `pnpm check` passes with no TypeScript or lint errors.
- [ ] No functional API calls or database writes in this phase.
