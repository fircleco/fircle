---
title: "Base Right Sidebar App Shell Placement"
status: completed
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/001-foundation-ui-app-shell-navigation/prd.md
    description: "Original app shell and navigation structure"
  - type: prd
    url: .project/prds/021-full-pwa/prd.md
    description: "Responsive behavior and mobile UX constraints for app shell surfaces"
  - type: pr
    url: https://github.com/fircle-app/fircle/pull/39
    description: "Implementation pull request - feat: right sidebar foundation"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` — when work begins on any phase.
>   - `completed` — when all tasks and acceptance criteria are done.
>   - `on-hold` — if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Base Right Sidebar App Shell Placement

## Description

Fircle currently has a left desktop sidebar and mobile-specific header/bottom navigation, but no dedicated right-side app shell area. As feature modules expand, the UI needs a consistent right-rail placement zone that can host manually authored base content and optionally support feature-contributed content later.

This PRD introduces the base right sidebar as an app shell placement area, not a full widget framework. The intent is to establish stable layout structure and responsive behavior first, while keeping content authoring simple and manual.

The right sidebar is considered infrastructure: it should exist independently of any single feature and should not require feature toggles to render baseline content.

### Design Decisions

- **Placement first, framework later**: Introduce the right sidebar container and baseline rendering rules without building a generalized widget engine.
- **Manual content is acceptable**: Base right-sidebar items can be hardcoded in this phase, similar to existing nav item patterns.
- **Feature compatibility without framework overhead**: The placement should be designed so future feature modules can contribute content through a lightweight contract, but this PRD does not require a standalone registry framework.
- **Desktop-first, mobile-safe behavior**: Right sidebar is primarily a desktop/tablet shell element; mobile behavior should be explicit (hidden, collapsed, or relocated).
- **App shell ownership**: The right sidebar is part of authenticated app shell structure and must remain tenant-safe and membership-safe.

### User Stories

- **As a** user, **I want** a consistent right-side area in the app shell, **so that** important contextual content has a predictable location.
- **As a** maintainer, **I want** right-sidebar structure available before feature modules depend on it, **so that** future additions do not require shell rewrites.
- **As a** contributor, **I want** to add baseline right-sidebar items manually, **so that** we can ship useful content without introducing framework complexity.
- **As a** contributor, **I want** mobile behavior for the right sidebar to be explicit, **so that** small-screen UX remains clean and usable.

## Implementation Plan

### Phase 1: App Shell Layout Foundation

**Goal:** Add a right-sidebar region to the authenticated app shell with stable desktop layout behavior.

#### Tasks

- [x] Update app shell layout under `src/app/(app)/layout.tsx` and supporting shell components to include a right-sidebar placement region.
- [x] Ensure the main content column and right sidebar co-exist without breaking existing left sidebar behavior.
- [x] Add responsive breakpoints so right sidebar is desktop-first and does not degrade mobile UX.
- [x] Verify spacing, overflow, and scroll behavior are clear for both main content and right sidebar.

### Phase 2: Baseline Right-Side Content

**Goal:** Render manually authored base sidebar content without feature dependencies.

#### Tasks

- [x] Create baseline right-sidebar component(s) under `src/components/nav/` or another app-shell-owned location.
- [x] Add manually authored base items to the right sidebar (no feature framework requirement).
- [x] Add role-aware visibility rules so admin-only management links are hidden from non-admin members.
- [x] Keep content and rendering deterministic when no features are enabled.
- [x] Add empty-state/fallback behavior when no optional content is available.

### Phase 3: Lightweight Future Compatibility Hooks

**Goal:** Ensure right sidebar can later accept feature-contributed content without introducing framework complexity now.

#### Tasks

- [x] Define minimal extension shape for optional contributed sidebar entries (for future feature usage).
- [x] Document where feature modules should plug in later, without implementing a full widget registry.
- [x] Ensure app shell can compose base items with optional contributed items in a predictable order.

### Phase 4: Verification and QA

**Goal:** Validate shell stability and responsive behavior across existing core routes.

#### Tasks

- [x] Verify existing primary app routes render correctly with right-sidebar layout.
- [x] Verify mobile header and bottom nav behavior remains unchanged.
- [x] Run `pnpm lint`, `pnpm typecheck`, and relevant tests for touched areas.
- [x] Perform manual responsive checks for desktop, tablet, and mobile widths.

## Acceptance Criteria

- [x] Authenticated app shell includes a right-sidebar placement region.
- [x] Right sidebar renders baseline manually authored items without requiring feature toggles.
- [x] Admin-only right-sidebar items are hidden for non-admin users while member-safe items remain visible.
- [x] Existing left sidebar, mobile header, and bottom nav behavior remain intact.
- [x] Right sidebar behavior on mobile is explicit and does not harm usability.
- [x] A lightweight extension shape is documented for future feature-contributed right-sidebar content.
- [x] No generalized widget framework is introduced in this PRD.
- [x] Lint, typecheck, and targeted tests pass for touched areas.
