---
title: "Member Mention in Post Captions and Comments"
status: in-progress
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/010-post-system-media-upload-cloudflare-r2/prd.md
    description: "Post creation and feed mapping foundation"
  - type: prd
    url: .project/prds/012-post-commenting-system/prd.md
    description: "Comment API and post-detail thread foundation"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` — when work begins on any phase.
>   - `completed` — when all tasks and acceptance criteria are done.
>   - `on-hold` — if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Member Mention in Post Captions and Comments

## Description

Fircle currently renders static mention-like UI for `@Name` tokens in post bodies, but mentions are not authored through real mention pickers and are not persisted as structured records. Comment surfaces also treat mentions as plain text. This creates fragile behavior (name-based matching only), weak support for future notifications, and inconsistent authoring UX between posts and comments.

This PRD introduces first-class member mentions for both post captions and comments:

- Detect `@` mention entry while typing in post caption and comment inputs.
- Show a contextual member suggestion popup with search filtering.
- Insert selected member mention into post/comment text.
- Persist mentions as structured metadata linked to family members.
- Render mentions in post body and comments as clickable inline chips (avatar + name) that navigate to the member profile.

In-scope for this PRD:

- Post composer mention authoring in the main post caption.
- Comment mention authoring in top-level comments, replies, and comment edits.
- Mention persistence in post and comment domain payloads.
- Feed and post-detail rendering using persisted mention records.

Out-of-scope for this PRD:

- Post edit mention authoring (no post edit flow exists yet).
- Mentions in per-media captions.
- Mention notifications delivery (tracked by Phase 2 notifications roadmap).

### Design Decisions

- **Structured mentions over name parsing**: Mentions are stored as explicit records tied to content entities and `FamilyMember`, rather than inferred from text at read time.
- **Two-surface authoring in v1**: Mention authoring ships for post composer and comment input surfaces, but still excludes post edit and per-media captions.
- **Family-bound mention validation**: Mentioned member IDs must belong to the same family as the authoring context.
- **Range-backed rendering contract**: API responses include mention metadata sufficient for deterministic inline rendering and profile linking without regex-only matching.
- **Clickable profile navigation**: Mention chips route to profile destinations by slug (consistent with existing post/comment author linking).
- **Comment parity**: Top-level comments, replies, and edits all use the same mention detection and insertion behavior.

### User Stories

- **As a** family member creating a memory, **I want** to type `@` and see matching members, **so that** I can quickly mention people without memorizing exact names.
- **As a** family member writing a comment or reply, **I want** to type `@` and see matching members, **so that** I can mention family members naturally during discussions.
- **As a** family member, **I want** selected mentions to appear as rich inline chips in published posts, **so that** mentions are visually clear and interactive.
- **As a** family member, **I want** selected mentions to appear as rich inline chips in comments, **so that** mentions are visually clear and interactive in threads too.
- **As a** family member reading the feed, **I want** to click a mention and open that member profile, **so that** I can quickly navigate to related family context.
- **As a** product maintainer, **I want** mentions persisted as structured records, **so that** notifications and analytics can be added without reparsing free text.

## Implementation Plan

### Phase 1: Schema and Migration for Mentions

**Goal:** Add durable mention persistence linked to posts, comments, and family members.

#### Tasks

- [x] Add mention persistence models in [prisma/schema.prisma](prisma/schema.prisma) for post mentions and comment mentions, each linked to `FamilyMember`.
- [x] Add mention range fields (for deterministic inline mapping) and necessary timestamps.
- [x] Add uniqueness and index constraints to prevent duplicate mention rows where applicable and optimize post/comment hydration.
- [x] Create migration in [prisma/migrations](prisma/migrations) and regenerate Prisma client in [generated/prisma](generated/prisma).

### Phase 2: API Contract and Mention Validation

**Goal:** Accept, validate, persist, and return mention data in post and comment APIs.

#### Tasks

- [x] Extend `createPostInputSchema` in [src/server/api/routers/post.ts](src/server/api/routers/post.ts) with mention payloads (`memberId`, range fields).
- [x] Extend comment input schemas in [src/server/api/routers/post.ts](src/server/api/routers/post.ts):
  - [x] `createCommentInputSchema` mention payload support.
  - [x] `updateCommentInputSchema` mention payload support.
- [x] Validate mention constraints server-side:
  - [x] Mention ranges are in-bounds and non-overlapping.
  - [x] Mention count is bounded.
  - [x] Mentioned members belong to the same family as the post/comment context.
- [x] Persist mentions transactionally in `post.create` mutation in [src/server/api/routers/post.ts](src/server/api/routers/post.ts).
- [x] Persist comment mentions transactionally in `createComment` and `updateComment` procedures in [src/server/api/routers/post.ts](src/server/api/routers/post.ts).
- [x] Extend post response select/mapping in [src/server/api/routers/post.ts](src/server/api/routers/post.ts) to include normalized mention records (member id, slug, name, avatar, ranges).
- [x] Extend comment response mapping in [src/server/api/routers/post.ts](src/server/api/routers/post.ts) to include normalized mention records.
- [x] Ensure `getFeed`, `getById`, profile/member post queries, and `getComments` outputs include mention data required by UI layers.

### Phase 3: Mention Authoring UX for Composer and Comments

**Goal:** Add guided mention entry and selection in post and comment authoring surfaces.

#### Tasks

- [x] Add mention trigger detection from caret position in [src/components/feed/post-composer-dialog.tsx](src/components/feed/post-composer-dialog.tsx).
- [x] Reuse family member list query (`api.familyMember.listFamilyMembers`) for mention suggestions with client-side filtering.
- [x] Build contextual suggestion popup UI near the caption input, reusing existing member-list visual language from [src/components/feed/media-viewer-dialog.tsx](src/components/feed/media-viewer-dialog.tsx).
- [x] Implement keyboard interactions (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`) and pointer selection.
- [x] On selection, replace active `@query` token with `@Display Name` and update local mention metadata/ranges.
- [x] Keep mention metadata synchronized as caption text changes before publish.
- [x] Include normalized mention payloads in `api.post.create` call path in [src/components/feed/post-composer-dialog.tsx](src/components/feed/post-composer-dialog.tsx).
- [x] Add mention support to comment entry components and call sites:
  - [x] [src/components/feed/comment-input.tsx](src/components/feed/comment-input.tsx) for top-level, reply, and edit input states.
  - [x] [src/app/(app)/post/[postId]/page.tsx](src/app/(app)/post/[postId]/page.tsx) for `createComment` and `updateComment` payload wiring.
- [x] Reuse shared mention helper logic across post and comment inputs to avoid behavior drift.

### Phase 4: Mention Rendering and Navigation

**Goal:** Render persisted mentions as clickable inline chips in posts and comments.

#### Tasks

- [x] Update `PostCardData` mention shape in [src/components/feed/post-card.tsx](src/components/feed/post-card.tsx).
- [x] Replace regex-only `@Name` rendering in [src/components/feed/post-card.tsx](src/components/feed/post-card.tsx) with mention-record-based rendering.
- [x] Preserve current avatar + name chip style while using persisted mention metadata.
- [x] Route mention chip clicks to member profile paths using slug conventions (`/profile` for current member, `/member/[slug]` for others).
- [x] Add mention rendering in [src/components/feed/comment-card.tsx](src/components/feed/comment-card.tsx) using persisted comment mention records.
- [x] Keep media-tag rendering behavior intact and independent from text mention rendering.

### Phase 5: Surface Mapping, Tests, and QA

**Goal:** Ensure all post and comment surfaces consume mention data correctly and behavior is stable.

#### Tasks

- [ ] Update post-to-card mappings to pass mention data in:
  - [x] [src/app/(app)/page.tsx](src/app/(app)/page.tsx)
  - [x] [src/app/(app)/post/[postId]/page.tsx](src/app/(app)/post/[postId]/page.tsx)
  - [x] [src/app/(app)/profile/page.tsx](src/app/(app)/profile/page.tsx)
  - [x] [src/app/(app)/member/[slug]/page.tsx](src/app/(app)/member/[slug]/page.tsx)
- [ ] Add or extend backend tests in [src/server/api/routers/post.test.ts](src/server/api/routers/post.test.ts) for mention validation, persistence, and response mapping.
- [ ] Add backend tests for comment mention create/update mapping and family-bound validation in [src/server/api/routers/post.test.ts](src/server/api/routers/post.test.ts).
- [ ] Add mention helper tests (token detection/range adjustment) for shared post/comment mention logic where practical.
- [ ] Execute lint, typecheck, and relevant test suites via [package.json](package.json) scripts.
- [ ] Perform manual QA across desktop and mobile for mention authoring, submission, rendering, and navigation in both posts and comments.

## Acceptance Criteria

- [ ] In post composer main caption, typing `@` followed by text opens member suggestions filtered to family members.
- [ ] Users can select a suggestion by keyboard or mouse and insert a mention at the current caret position.
- [ ] Publishing a post with mentions persists structured mention records linked to the post and family members.
- [ ] In comment inputs (top-level, reply, edit), typing `@` followed by text opens member suggestions filtered to family members.
- [ ] Creating or editing a comment with mentions persists structured mention records linked to the comment and family members.
- [ ] Posts without mentions continue to publish and render unchanged.
- [ ] Feed and post detail render mentions as inline chips with member avatar and name.
- [ ] Comment threads render mentions as inline chips with member avatar and name.
- [ ] Clicking a mention chip navigates to the correct member profile destination.
- [ ] Mention validation rejects invalid ranges, cross-family member IDs, and malformed payloads.
- [ ] Existing post creation, media upload, media tagging, likes, and comments flows show no regression.
- [ ] Backend mention tests and affected integration tests pass.
- [ ] Post and comment mention UX behave correctly on desktop and mobile viewports.
