---
title: "Member Tagging - Live Photo Anchors and Simple Video Assignment"
status: completed
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/006-tagging-and-memory-static-ui/prd.md
    description: "Static tagging and memory UX baseline"
  - type: prd
    url: .project/prds/010-post-system-media-upload-cloudflare-r2/prd.md
    description: "Live post and media storage foundation"
  - type: pr
    url: https://github.com/babblebey/fircle/pull/22
    description: "Implementation pull request - feat: implement member tagging on post media"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` — when work begins on any phase.
>   - `completed` — when all tasks and acceptance criteria are done.
>   - `on-hold` — if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Member Tagging - Live Photo Anchors and Simple Video Assignment

## Description

This PRD delivers the MVP implementation for member tagging on post media in single-family mode.

Scope in this PRD:
- Photo tagging with visible anchor placement on images.
- Video tagging with simple member assignment at the video media level.
- Full CRUD for tags after post publish (add, edit, remove, list).
- Authorization model: post author and family admins/owners can manage tags.
- Family-scoped validation so only members of the same family can be tagged.

Out of scope in this PRD:
- Timeline or moment-based video tagging.
- Timestamp capture or playback-position tagging UX.
- Tag notifications and memory timeline aggregation (Phase 2 roadmap work).

This implementation must preserve a clean upgrade path so advanced video tagging can be added later without breaking the current API contract or requiring destructive data migration.

### Design Decisions

- **Single tag entity now, future-friendly shape**: Use a media-level tag model that supports photo anchors via optional coordinates and supports videos via coordinate-less assignment. This avoids over-modeling now while enabling future expansion.
- **Tag ownership hierarchy is explicit**: Tags belong to media items; media items belong to posts; and posts can contain multiple media. This hierarchy drives query design and UI rendering boundaries.
- **Forward-compatible API contracts**: Return tag objects with a stable base shape and reserve optional fields for future timeline metadata. Clients should tolerate unknown nullable fields and continue to render current behavior.
- **Strict family and role boundaries**: Reuse existing membership and role enforcement patterns from post and family-member routers to prevent cross-family tagging and unauthorized mutations.
- **Post-publish editing entry point**: Tagging is done from post detail/media viewer, not composer, to reduce initial composer complexity and align with current flow.
- **No irreversible coupling to timeline model**: Keep timeline/moment structures out of MVP schema, but design naming and query boundaries so they can be introduced additively in a later PRD.
- **Layered tag presentation strategy**: Each media item renders its own tagged members via TaggedMembersOverlay, while post cards with multiple media render a de-duplicated member set across media via TaggedMemberAvatarStack.

### User Stories

- **As a** family member who created a post, **I want** to tag people in a photo by placing anchors, **so that** memories clearly identify who is in each image.
- **As a** family admin, **I want** to add or remove tags on posts in my family, **so that** tagged content stays accurate and useful.
- **As a** family member viewing a video, **I want** to see who is tagged on that video, **so that** I can understand who the video is about without timeline controls.
- **As a** product team member, **I want** this MVP implementation to remain extensible, **so that** timeline-based video tagging can be added later without breaking existing clients.

## Implementation Plan

### Phase 1: Schema and Migration Foundation

**Goal:** Add durable tagging persistence for photos and videos with minimal schema complexity and future extensibility.

#### Tasks

- [x] Add media tag model(s) in [prisma/schema.prisma](prisma/schema.prisma) to link post media to family members.
- [x] Include optional coordinate fields for photo anchors and enforce coordinate validation rules at API level.
- [x] Add relations from PostMedia and FamilyMember to the tagging model(s), preserving cascade delete behavior.
- [x] Add indexes for media-centric and member-centric lookup patterns.
- [x] Add uniqueness rule to prevent duplicate member assignment on the same media item.
- [x] Create migration in [prisma/migrations](prisma/migrations) and regenerate Prisma client in [generated/prisma](generated/prisma).

### Phase 2: Tagging API with Authorization and Validation

**Goal:** Provide complete CRUD APIs for photo and simple video tagging while enforcing family and role constraints.

#### Tasks

- [x] Create tagging router at [src/server/api/routers/tag.ts](src/server/api/routers/tag.ts).
- [x] Register router in [src/server/api/root.ts](src/server/api/root.ts).
- [x] Reuse membership and role guards from [src/server/api/routers/post.ts](src/server/api/routers/post.ts) and [src/server/api/routers/family-member.ts](src/server/api/routers/family-member.ts).
- [x] Implement photo tag create, update, delete, and list procedures with coordinate validation.
- [x] Implement video tag create, update, delete, and list procedures as simple member assignment per video media item.
- [x] Validate that tagged member IDs belong to the same family as the post.
- [x] Ensure response shapes are forward-compatible by reserving optional metadata fields for future video timeline extensions.

### Phase 3: Post and Feed Read Integration

**Goal:** Expose tag data through existing post read paths so UI can render tags without excessive extra requests.

#### Tasks

- [x] Extend selects and mapping in [src/server/api/routers/post.ts](src/server/api/routers/post.ts) to include media tags.
- [x] Ensure getById and feed responses include stable tag payloads for each media item.
- [x] Ensure response contracts preserve the hierarchy: tags are nested under each media item, media remains nested under the post.
- [x] Add derived de-duplicated tagged-member projection per post for multi-media cards so UI can render a unique member stack without duplicate avatars.
- [x] Add a member-centric tagged posts query in [src/server/api/routers/post.ts](src/server/api/routers/post.ts) for the profile Tagged In tab (for example, getTaggedPostsByMember), returning posts where the target member is tagged in at least one media item.
- [x] Ensure tagged-post query de-duplicates by post when a member is tagged in multiple media under the same post.
- [x] Ensure tagged-post query still returns per-media tag payloads so media-viewer overlays remain accurate inside tagged-tab cards.
- [x] Preserve backward compatibility for existing consumers that currently assume empty or missing tagged member arrays.

### Phase 4: Frontend Tagging UX (Post-Publish)

**Goal:** Enable intuitive post-publish editing for photo anchors and simple video member assignment.

#### Tasks

- [x] Add media tagging entry and management actions in [src/components/feed/media-viewer-dialog.tsx](src/components/feed/media-viewer-dialog.tsx) only, scoped to the currently viewed media item.
- [x] Build photo tagging editor UI in [src/components/feed](src/components/feed) for anchor placement, member selection, editing, and deletion.
- [x] Build simple video tagging UI in [src/components/feed](src/components/feed) for member assignment list editing only.
- [x] Render per-media tagged members in the viewer using TaggedMembersOverlay so the displayed tags always match the active media.
- [x] For post cards that contain multiple media, render a unique combined tagged-member set across the post's media using TaggedMemberAvatarStack.
- [x] Replace tagged-tab placeholders in [src/app/(app)/profile/page.tsx](src/app/(app)/profile/page.tsx) and [src/app/(app)/member/[slug]/page.tsx](src/app/(app)/member/[slug]/page.tsx) with live data from the tagged-post query.
- [x] Ensure tagged-tab cards keep existing post-card behavior while showing only posts where the profiled member is tagged in media.
- [x] Keep composer unchanged in [src/components/feed/post-composer-dialog.tsx](src/components/feed/post-composer-dialog.tsx).
- [x] Render real tagged-member data via [src/components/feed/tagged-member-avatar-stack.tsx](src/components/feed/tagged-member-avatar-stack.tsx) and viewer surfaces.

### Phase 5: Testing, QA, and Future-Proofing Checks

**Goal:** Validate correctness, authorization, and extension readiness.

#### Tasks

- [x] Add router tests at [src/server/api/routers/tag.test.ts](src/server/api/routers/tag.test.ts) covering authz matrix, family isolation, and CRUD behavior.
- [x] Update [src/server/api/routers/post.test.ts](src/server/api/routers/post.test.ts) for tag payload integration coverage.
- [x] Add tests for tagged-post query behavior in [src/server/api/routers/post.test.ts](src/server/api/routers/post.test.ts), including post de-duplication and family-scope enforcement.
- [ ] Add component-level tests for critical tag-edit interactions where practical.
- [x] Add frontend validation for Tagged In tabs on [src/app/(app)/profile/page.tsx](src/app/(app)/profile/page.tsx) and [src/app/(app)/member/[slug]/page.tsx](src/app/(app)/member/[slug]/page.tsx), including empty-state and populated-state behavior.
- [x] Run lint, typecheck, and tests via project scripts in [package.json](package.json).
- [x] Execute manual QA for mobile and desktop across photo and video tagging flows.
- [x] Verify additive migration plan for future timeline model (no breaking field renames, no response contract regressions).

## Acceptance Criteria

- [x] Data hierarchy is enforced and visible in API payloads: tags belong to media, media belongs to post, and posts may contain multiple media.
- [x] A user with author or admin-owner privileges can create, edit, and remove photo tags with anchor coordinates.
- [x] A user with author or admin-owner privileges can create, edit, and remove video tags as plain member assignments.
- [x] Non-author non-admin family members cannot mutate tags on posts they do not control.
- [x] Tags cannot reference members outside the current post family.
- [x] Post and feed APIs return stable media tag payloads for frontend rendering.
- [x] Each media view displays its own tagged members via TaggedMembersOverlay with no cross-media leakage.
- [x] For posts with multiple media, the post card displays unique tagged members across all media via TaggedMemberAvatarStack.
- [x] Frontend supports post-publish tag editing for photos and videos and displays persisted results after reload.
- [x] Tag management entry is available from media-viewer-dialog where the target media is being viewed.
- [x] The Tagged In tab on [src/app/(app)/profile/page.tsx](src/app/(app)/profile/page.tsx) and [src/app/(app)/member/[slug]/page.tsx](src/app/(app)/member/[slug]/page.tsx) lists posts where the target member is tagged in media.
- [x] Tagged In tab results are post-level unique even when the same member is tagged in multiple media items within one post.
- [x] Existing composer flow remains unchanged and functional.
- [x] All touched tests pass; no regression in existing post/comment/like/profile flows.
- [x] Schema and API choices remain additive and documented for later timeline or moment-based video tagging.

## Future Extension Notes (Non-Blocking)

- Introduce a dedicated video timeline table in a later PRD (for example, VideoTagMoment) as an additive relation to existing media tags.
- Keep current media-level video tags as default tags while allowing optional timeline moments to coexist.
- Expand response contract with optional moment arrays, preserving existing member-assignment fields for backward compatibility.
- Add timeline-specific UI only after this MVP is stable and notifications or memory timeline dependencies are clarified.
