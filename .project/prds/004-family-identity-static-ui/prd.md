---
title: "Family Identity Static UI — Members, Profiles, and Claim Flow"
status: completed
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/001-foundation-ui-app-shell-navigation/prd.md
    description: "App shell and navigation foundation"
  - type: prd
    url: .project/prds/002-static-auth-ui/prd.md
    description: "Public auth static UI patterns"
  - type: pr
    url: https://github.com/babblebey/fircle/pull/6
    description: "Implementation pull request - feat: implement family identity static UIs"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` — when work begins on any phase.
>   - `completed` — when all tasks and acceptance criteria are done.
>   - `on-hold` — if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Family Identity Static UI — Members, Profiles, and Claim Flow

## Description

This PRD defines the next static UI milestone for Fircle: the family identity layer.

After landing/auth screens and the first in-app feed experience, the next product surface should make family membership tangible. Users need to be able to browse the family directory, understand who is already on Fircle versus who exists only as an unclaimed profile, add missing family members, and see the future claim-account flow before any backend logic is implemented.

This phase is intentionally static UI only. There are no database writes, no real invites, no real account claiming, and no protected data fetching. All directory entries, profile data, and claim states are mocked locally.

The goal is to lock down information architecture, screen flow, card design, and status language for family identity before wiring Prisma models, auth rules, and invite logic.

### Design Decisions

- **Static UI only**: No persistence, no auth enforcement, and no server calls. Buttons and forms are visual mocks.
- **Split route ownership by user state**: Authenticated family-management screens live under `src/app/(app)/`, while claim-account screens live under `src/app/auth/` to mirror the existing public auth flow.
- **Claim status is central to the design**: Every relevant UI surface must clearly distinguish `claimed` and `unclaimed` members using badges and helper text.
- **Directory-first navigation**: The members list is the primary identity entry point and should feel like a core tab in the product, not an admin afterthought.
- **Member profiles are memory-aware**: Even though tagged memories are not built in this PRD, profile layouts should reserve space for future tagged media and relationship details.
- **Add-member flow is lightweight**: Creating an unclaimed member should feel fast and low-friction, with only the fields needed to represent a person in the family circle.
- **Responsive card/list patterns**: Mobile uses stacked cards; desktop can introduce denser grid/list layouts, but the underlying components should be shared.
- **Role language remains minimal in this phase**: Show simple labels such as `Parent`, `Sibling`, `Child`, `Grandparent`, or `Family Friend`, but do not design the full permissions model yet.

### User Stories

- **As a** family member, **I want** to browse a directory of people in my family space, **so that** I can quickly see who is part of the circle.
- **As a** family organizer, **I want** to add relatives who are not yet on the app, **so that** I can represent the whole family before everyone signs up.
- **As a** family member, **I want** to tell whether someone has claimed their account, **so that** I understand who can log in and interact directly.
- **As a** person receiving a claim link later, **I want** to see a clear claim-account screen, **so that** I understand I am taking over an existing profile instead of creating a duplicate identity.
- **As a** user viewing a member profile, **I want** to see relationship context and future memory sections, **so that** the profile feels like a lasting identity record rather than only an auth account.

## Implementation Plan

### Phase 1: Routes and Mock Data Foundation

**Goal:** Establish route skeletons and typed mock family identity data used across the directory, profile, and claim screens.

#### Tasks

- [x] Create `src/lib/mocks/family-members.ts` with typed mock member data.
- [x] Add types for:
  - [x] `FamilyMemberStatus` (`claimed`, `unclaimed`)
  - [x] `FamilyRelationship`
  - [x] `FamilyMemberSummary`
  - [x] `FamilyMemberProfile`
  - [x] `ClaimInvitePreview`
- [x] Seed at least 8 mock family members with a mix of:
  - [x] claimed members
  - [x] unclaimed members
  - [x] different relationships
  - [x] optional avatars
- [x] Create `src/app/(app)/members/page.tsx` as the family members directory route.
- [x] Create `src/app/(app)/members/[memberId]/page.tsx` as the member profile route.
- [x] Create `src/app/(app)/members/new/page.tsx` as the add-member route.
- [x] Create `src/app/auth/claim/[token]/page.tsx` as the public claim-account route.

---

### Phase 2: Family Members Directory

**Goal:** Build the main members index screen with filters, statuses, and clear entry points into profile and add-member flows.

#### Tasks

- [x] Implement `src/app/(app)/members/page.tsx`:
  - [x] page title and supporting copy
  - [x] primary CTA: `Add family member`
  - [x] search input mock
  - [x] status filter tabs/chips: `All`, `Claimed`, `Unclaimed`
  - [x] responsive layout with stacked cards on mobile and multi-column grid or denser list on desktop
- [x] Create `src/components/members/member-card.tsx`:
  - [x] avatar or fallback initials
  - [x] display name
  - [x] relationship label
  - [x] claim-status badge
  - [x] small metadata row (for example: `Added by Emma`, `No account yet`)
- [x] Create `src/components/members/member-status-badge.tsx` shared across directory and profile screens.
- [x] Add a mocked empty-state variant for when no members match the current filter.
- [x] Add a mocked “invite/claim pending” helper treatment for unclaimed profiles.

---

### Phase 3: Member Profile Screen

**Goal:** Build the static identity profile for one family member, regardless of whether the profile is claimed.

#### Tasks

- [x] Implement `src/app/(app)/members/[memberId]/page.tsx` using local mock lookup by `memberId`.
- [x] Create `src/components/members/member-profile-header.tsx`:
  - [x] large avatar
  - [x] name
  - [x] relationship label
  - [x] claim-status badge
  - [x] actions area (`Edit profile`, `Send claim invite`, or `View account` as static buttons)
- [x] Add summary sections to the profile page:
  - [x] About / short bio block
  - [x] Relationship details block
  - [x] Membership status block explaining claimed vs unclaimed state
  - [x] Reserved “Tagged memories” preview section with placeholder cards
- [x] Add a static timeline/list section for recent family activity involving this member (mock only).
- [x] Add distinct visual states for:
  - [x] claimed member profile
  - [x] unclaimed member profile
  - [x] missing member / not-found placeholder state

---

### Phase 4: Add Unclaimed Member Flow

**Goal:** Create the static UI for adding a new family member who does not yet have an account.

#### Tasks

- [x] Implement `src/app/(app)/members/new/page.tsx`.
- [x] Build a centered or contained form card with:
  - [x] heading: `Add a family member`
  - [x] explanatory copy clarifying this creates an unclaimed profile
  - [x] fields for name, relationship, optional email, optional photo URL/upload placeholder, optional short note
  - [x] checkbox or helper text for `They are not joining yet`
- [x] Use existing shadcn form primitives where available (`Input`, `Textarea`, `Select`, `Button`, etc.).
- [x] Add a static success state or confirmation panel after “Create member”.
- [x] Add a secondary link back to the members directory.
- [x] Add an inline helper note explaining that the person can claim the account later.

---

### Phase 5: Claim Account Static Flow

**Goal:** Define the public claim-account screen for a person taking ownership of an existing profile.

#### Tasks

- [x] Implement `src/app/auth/claim/[token]/page.tsx`.
- [x] Render a claim preview card showing:
  - [x] invited/claiming person name
  - [x] family name
  - [x] relationship label
  - [x] message explaining this will activate an existing profile
- [x] Add a sign-up style form with mocked fields:
  - [x] email
  - [x] password
  - [x] confirm password
- [x] Add a clear primary CTA: `Claim profile and continue`.
- [x] Add mocked alert states for:
  - [x] expired claim link
  - [x] already claimed profile
  - [x] email already in use
- [x] Add a static success state or follow-up confirmation view.
- [x] Link back to sign-in for users who already have an account.

---

### Phase 6: QA and Polish

**Goal:** Ensure the family identity screens are cohesive, responsive, and ready for later backend integration.

#### Tasks

- [x] Verify all new routes render inside the correct layout group (`(app)` vs `auth`).
- [x] Test responsive behavior at 375px, 768px, and 1024px.
- [x] Ensure no horizontal overflow on directory, profile, add-member, or claim screens.
- [x] Ensure status badges are visually distinct in dark and light themes.
- [x] Confirm buttons and inputs use existing design-system components consistently.
- [x] Run `pnpm check` and resolve any lint or type issues.
- [x] Verify empty, error, and success states are represented on every major flow.

## Acceptance Criteria

- [x] `/members` renders a responsive family directory with mocked data, status filters, and an add-member CTA.
- [x] `/members/[memberId]` renders a member profile that clearly distinguishes claimed and unclaimed identities.
- [x] `/members/new` renders a static form for creating an unclaimed family member profile.
- [x] `/auth/claim/[token]` renders a public claim-account screen with preview details and mocked form/error states.
- [x] Claimed and unclaimed members are visually distinct everywhere they appear.
- [x] Directory and profile UIs reserve clear space for future tagged-memory features.
- [x] All pages are responsive and render correctly in both dark and light themes.
- [x] All forms and buttons use the project UI system consistently.
- [x] No page in this PRD performs real network requests, auth actions, or database writes.
- [x] `pnpm check` passes after implementation.
