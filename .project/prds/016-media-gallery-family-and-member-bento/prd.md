---
title: "Media Gallery - Family Index and Member Gallery with Bento Layout"
status: completed
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/010-post-system-media-upload-cloudflare-r2/prd.md
    description: "Post and media storage/query foundation"
  - type: prd
    url: .project/prds/014-member-tagging-live-photo-and-simple-video/prd.md
    description: "Media tagging model and media-tag query behavior"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` — when work begins on any phase.
>   - `completed` — when all tasks and acceptance criteria are done.
>   - `on-hold` — if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Media Gallery - Family Index and Member Gallery with Bento Layout

## Description

Fircle currently supports posting photos/videos and tagging members in media, but there is no dedicated media gallery experience. Media is only discoverable through feed and post-detail browsing, which makes memory retrieval difficult.

This PRD introduces two gallery surfaces:

1. A family-wide media gallery at `/gallery` that indexes all media shared in the family.
2. A member-specific gallery integrated into profile pages that shows:
   - media the member published, and
   - media where the member is tagged (photo/video tags only).

The feature also adds a new `Gallery` navigation entry in the sidebar/navigation shell and delivers a distinctive bento-style layout for visual browsing across mobile and desktop.

### Design Decisions

- **Single-family query scope**: Gallery queries remain family-scoped using existing membership guards to align with MVP single-family mode and avoid multi-tenant assumptions.
- **PostMedia-first gallery read model**: Gallery APIs query `PostMedia` directly (with joined post/author context) instead of reading through post feed endpoints, because gallery is a media index and needs media-level pagination/filtering.
- **Dedicated media router**: Gallery APIs are implemented in a dedicated `mediaRouter` (mounted in the app router) rather than adding media-specific procedures into `postRouter`, to keep domain boundaries clear as gallery capabilities grow.
- **Media-tag only for member tagged gallery**: Member-specific tagged results include only `MediaTag` relationships, not caption/comment mentions, to keep gallery relevance visual-first.
- **No v1 filters**: Initial release ships with newest-first media browsing without media-type/member filters to reduce complexity and accelerate delivery.
- **Bento over uniform grid**: Family gallery prioritizes visual hierarchy (mixed tile spans) to improve browsing and make recent moments feel prominent.
- **Reuse existing viewer pipeline**: Tile interaction should open the existing media viewer/dialog behavior to avoid duplicated playback/tag-overlay logic.

### User Stories

- **As a** family member, **I want** a dedicated gallery page, **so that** I can quickly browse all family photos/videos without scrolling the feed.
- **As a** family member, **I want** to open gallery from navigation, **so that** media browsing is first-class in the app.
- **As a** member viewing a profile, **I want** a Gallery tab, **so that** I can see a person’s published media and memories where they are tagged.
- **As a** mobile user, **I want** the gallery layout to adapt to smaller screens, **so that** browsing remains clear and usable on home-screen installs.

## Implementation Plan

### Phase 1: Routing and Navigation Integration

**Goal:** Add first-class navigation and routes for gallery access in the authenticated app shell.

#### Tasks

- [x] Create route page at `src/app/(app)/gallery/page.tsx` under the existing authenticated layout.
- [x] Add `Gallery` item to desktop sidebar navigation in `src/components/nav/desktop-sidebar.tsx`.
- [x] Add `Gallery` item to mobile bottom navigation in `src/components/nav/mobile-bottom-nav.tsx`.
- [x] Ensure active-state logic highlights `/gallery` correctly without breaking `/` route behavior.
- [x] Add page-level empty/loading scaffolds matching existing app shell conventions.

### Phase 2: Server Query and Data Shaping

**Goal:** Provide media-focused data contracts for family gallery and member gallery composition.

#### Tasks

- [x] Create `src/server/api/routers/media.ts` with a dedicated `mediaRouter` and register it in `src/server/api/root.ts`.
- [x] Add dedicated gallery procedures in `mediaRouter` that query `PostMedia` directly with family scope guards.
- [x] Implement family gallery query returning media rows (not post envelopes), ordered by `(createdAt desc, id desc)` at media level with cursor pagination.
- [x] Implement member gallery queries/sections from media rows:
  - `publishedMedia` (media whose parent post author is member)
  - `taggedMedia` (media where member appears in `MediaTag`)
- [x] Enforce family membership/authorization checks consistent with existing post procedures.
- [x] Deduplicate overlapping results for member gallery where applicable and define deterministic ordering.
- [x] Add a gallery media DTO that includes: media fields, parent post id/createdAt, author summary, and media tags; adapt to existing viewer input shape.
- [x] Add input schemas and response typing for new procedures in the tRPC router.

### Phase 3: Family Gallery Bento UI

**Goal:** Build a bold, responsive bento-style gallery experience for `/gallery`.

#### Tasks

- [x] Create reusable gallery UI components in `src/components/gallery/` (tile primitives, bento layout container, empty/loading states).
- [x] Implement deterministic tile spanning strategy (hero + supporting tiles) based on recency/index to avoid hydration mismatch.
- [x] Render mixed media (image/video) tiles with clear visual affordances for video.
- [x] Wire tile click actions to existing media viewer dialog experience.
- [x] Ensure responsive behavior across mobile/tablet/desktop breakpoints with graceful fallback to simpler grid when media count is low.

### Phase 4: Member Profile Gallery Tab

**Goal:** Add member-specific gallery section to profile pages for self and member-by-slug views.

#### Tasks

- [x] Add `gallery` tab to `src/app/(app)/profile/page.tsx`.
- [x] Add `gallery` tab to `src/app/(app)/member/[slug]/page.tsx`.
- [x] Implement `Published` and `Tagged` media subsections in the gallery tab UI.
- [x] Ensure tagged subsection uses media tags only (not text mentions).
- [x] Reuse gallery tile components for visual consistency with `/gallery` while preserving profile context.
- [x] Add clear empty-state messages when member has no published or tagged media.

### Phase 5: Testing and Quality Validation

**Goal:** Validate behavior, stability, and UX consistency before release.

#### Tasks

- [x] Add server tests under `test/server/api/` for family media query filtering and cursor ordering.
- [x] Add server tests for member gallery aggregation (published vs tagged, dedupe behavior, family scoping).
- [x] Validate navigation and route rendering on desktop and mobile shell variants.
- [x] Validate media viewer interactions from gallery tiles for both image and video items.
- [x] Run lint and targeted tests (`pnpm lint`, relevant `vitest` suites) and fix regressions.

## Acceptance Criteria

- [x] A new authenticated route `/gallery` exists and is reachable from both desktop sidebar and mobile bottom navigation.
- [x] `/gallery` shows family media content from direct `PostMedia` queries, newest first, with cursor-safe media-level ordering.
- [x] Gallery presentation uses a bento-style layout with responsive behavior and no major overlap/breakpoint defects.
- [x] Clicking a gallery tile opens media using the existing viewer experience.
- [x] Profile pages (`/profile` and `/member/[slug]`) include a new `Gallery` tab.
- [ ] Member gallery shows two clear sections derived from `PostMedia`: published media and media-tagged items.
- [x] Member tagged gallery is derived from media tags only, not caption/comment mentions.
- [x] Empty states are shown when no gallery data exists for family or member contexts.
- [x] New queries are family-scoped and enforce existing membership/authorization constraints.
- [x] Gallery query/mutation surface is exposed through a dedicated `mediaRouter` in the root app router.
- [x] Lint and targeted tests pass for modified areas.
