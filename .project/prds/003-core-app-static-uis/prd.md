---
title: "Core App Static UIs — Feed, Composer, and Post Cards"
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
    description: "Public auth static UI flow"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` — when work begins on any phase.
>   - `completed` — when all tasks and acceptance criteria are done.
>   - `on-hold` — if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Core App Static UIs — Feed, Composer, and Post Cards

## Description

This PRD defines the first authenticated in-app experience for Fircle as static UI only.

After completing app shell/navigation and public auth screens, the next milestone is to render a believable family memory feed with a post composer and reusable post card variants. This work is presentation-first: no API fetching, no database writes, no upload backend, and no auth protection logic. Data is mocked in local constants.

The goal is to lock down layout, component structure, responsive behavior, and interaction states before wiring functionality.

### Design Decisions

- **Static UI only**: No backend calls, no real uploads, and no persistent state. Interactions are visual mocks.
- **Route group usage**: All pages in this PRD live under `src/app/(app)/` so they render inside the existing app shell from PRD 001.
- **Single source of mock data**: Feed and post cards use a typed local mock data module to reduce duplication and make future API replacement straightforward.
- **Card-first composition**: Create reusable post card primitives to support text, image, video, and mixed-content posts with one shared shell.
- **Mobile-first layout**: Optimize for phone feed scrolling first, then enhance desktop spacing and density.
- **Accessible interactions**: Buttons, dialogs, and menus must preserve focus styles and keyboard accessibility.
- **No tagging editor yet**: Show tagged members as read-only chips in posts for this PRD. Tag authoring UI is part of a later tagging PRD.

### User Stories

- **As a** signed-in family member, **I want** to see a home feed of recent memories, **so that** I can quickly catch up on family updates.
- **As a** family member, **I want** a clear compose entry point, **so that** I can start creating a post without confusion.
- **As a** family member, **I want** to view different post types (text, photos, videos), **so that** all shared memory formats feel native in one timeline.
- **As a** first-time user in an empty family, **I want** an encouraging empty state with a CTA, **so that** I understand what to do next.

## Implementation Plan

### Phase 1: Routes and Static Data Foundation

**Goal:** Establish route skeleton and typed mock data used by all core app static screens.

#### Tasks

- [x] Create `src/app/(app)/page.tsx` as the home feed route.
- [x] Resolve route ownership for auth-first redirects:
  - [x] Move landing UI from `src/app/page.tsx` to `src/app/auth/page.tsx` so landing lives at `/auth`.
  - [x] Ensure root `/` is owned by `src/app/(app)/page.tsx` as the primary feed entry route.
- [x] Create `src/lib/mocks/feed.ts` with typed static post data and helper enums/types.
- [x] Add types for:
  - [x] `PostType` (`text`, `photo`, `video`, `mixed`)
  - [x] `PostAuthor`
  - [x] `PostMediaItem`
  - [x] `FeedPost`
- [x] Seed at least 6 mock posts covering all supported variants.
- [x] Include mock metadata fields used by UI only:
  - [x] author name/avatar
  - [x] created time label
  - [x] caption/body
  - [x] media items (image/video)
  - [x] tagged member chips
  - [x] reaction/comment counts (display only)

---

### Phase 2: Feed Page and Composer Entry

**Goal:** Build the main feed layout and static composer entry surface.

#### Tasks

- [x] Implement `src/app/(app)/page.tsx` feed container:
  - [x] Header section with page title and supporting subtitle
  - [x] Sticky composer entry card near top of feed
  - [x] Feed list rendering from mock data
  - [x] Mobile-safe bottom spacing to avoid overlap with bottom nav
- [x] Create `src/components/feed/composer-entry.tsx`:
  - [x] Avatar + placeholder text (for example: "Share a memory...")
  - [x] Button to open static composer
  - [x] Quick action chips/buttons (Photo, Video)
- [x] Add empty-state rendering when feed data array is empty:
  - [x] Friendly illustration/icon placeholder
  - [x] Headline and helper text
  - [x] Primary CTA: "Create first memory"

---

### Phase 3: Post Card System

**Goal:** Build reusable post card components for each post variant.

#### Tasks

- [x] Create `src/components/feed/post-card.tsx` base shell:
  - [x] Author row (avatar, name, time)
  - [x] Optional tagged member chips
  - [x] Body text/caption section
  - [x] Footer actions row (Like, Comment, Share as static buttons)
- [x] Create `src/components/feed/post-media-grid.tsx`:
  - [x] Responsive grid for 1-4 media items
  - [x] Image thumbnail placeholders using real image URLs or local placeholders
- [x] Create `src/components/feed/post-video-card.tsx`:
  - [x] Video placeholder with play icon overlay
  - [x] Duration badge
- [x] Support rendering rules:
  - [x] Text-only post
  - [x] Photo-only post
  - [x] Video-only post
  - [x] Mixed post (caption + media)
- [x] Add mocked engagement row values (counts only, no interactions)

---

### Phase 4: Static Composer Surface

**Goal:** Provide a complete static composer UI flow that can be wired later.

#### Tasks

- [x] Create `src/components/feed/post-composer-dialog.tsx` (or sheet on mobile):
  - [x] Title: "Create memory"
  - [x] Multiline text area for caption
  - [x] Media attach placeholders (photo/video slots)
  - [x] Audience visibility chip (Family-only, static)
  - [x] Publish button with loading mock state text
- [x] Wire composer entry button to open and close composer UI in client state.
- [x] Include visual states only:
  - [x] Default
  - [x] "Uploading..." mock
  - [x] "Publish" disabled mock when no content
- [x] Ensure composer is fully responsive on 375px width and desktop.

---

### Phase 5: Responsive QA and Visual Polish

**Goal:** Verify static UX quality and readiness for data wiring.

#### Tasks

- [x] Validate pages at 375px, 768px, and 1024px:
  - [x] No horizontal overflow
  - [x] Comfortable spacing inside app shell
  - [x] Bottom nav does not cover actionable UI on mobile
- [x] Verify keyboard focus visibility for all buttons and inputs.
- [x] Add loading/skeleton placeholders for feed cards (visual only).
- [x] Run quality checks:
  - [x] `pnpm lint`
  - [x] `pnpm typecheck`
  - [x] `pnpm check`
- [x] Confirm no API calls or form submissions are introduced in this PRD.

## Acceptance Criteria

- [x] `src/app/(app)/page.tsx` renders a static family feed inside the app shell.
- [x] `/auth` renders the landing page UI and `/` resolves to the app feed route.
- [x] Feed includes at least 6 mock posts spanning text, photo, video, and mixed variants.
- [x] Reusable post card components exist under `src/components/feed/` and are used by the feed page.
- [x] Composer entry is visible at top of feed and opens a static composer dialog/sheet.
- [x] Empty feed state exists with a clear CTA.
- [x] Tagged members are displayed as read-only chips in post cards.
- [x] Mobile and desktop layouts are responsive with no horizontal scroll at 375px, 768px, and 1024px.
- [x] App shell nav remains intact and usable while viewing feed UI.
- [x] `pnpm check` passes with no lint or TypeScript errors.
- [x] No backend integration, auth gating changes, or persistent form submission are added in this PRD.

