---
title: "Post Commenting System"
status: in-progress
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/010-post-system-media-upload-cloudflare-r2/prd.md
    description: "Post system foundation, feed architecture, and post detail route"
  - type: prd
    url: .project/prds/011-post-like-system/prd.md
    description: "Optimistic interaction pattern, rate limiting, and post engagement response shape"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` — when work begins on any phase.
>   - `completed` — when all tasks and acceptance criteria are done.
>   - `on-hold` — if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Post Commenting System

## Description

Fircle currently supports live posts, media attachments, and post likes, but it does not yet let family members respond to posts in conversation. The post detail route already contains placeholder comment UI and the feed card already exposes a comment action, which makes the gap visible in the product.

This PRD introduces a durable commenting system for posts with one-level threaded replies. Authenticated family members should be able to write top-level comments, reply to comments, edit or delete their own comments, and like or unlike comments. The first shipping surface is the post detail page, while feed cards remain the entry point into the thread view.

The implementation should follow the same architectural patterns already used by posts and post likes: Prisma-backed relations, family membership checks through tRPC, rate-limited mutations, cursor-based pagination, and optimistic UI updates on the client.

### Design Decisions

- **Depth-1 threading only**: Replies are supported for one level beneath a top-level comment. This covers the main family conversation use case without introducing arbitrarily deep recursive UI and query complexity in MVP.
- **Post detail page is the only comment authoring surface in v1**: The existing post detail route already contains comment scaffolding and is the right place for full-thread interaction. Feed cards should link into that route rather than expanding inline comments in the feed.
- **Hard delete in v1**: Deleting a comment removes it permanently instead of leaving a tombstone. This matches the chosen scope and keeps backend/query logic simpler for the first version.
- **Own-comment moderation only for v1**: Members can edit and delete their own comments. Admin- or owner-level moderation controls are out of scope for this PRD and can be added in a follow-up moderation PRD.
- **Separate `Comment` and `CommentLike` models**: Comments should not be overloaded onto posts or reused through polymorphic tables. Dedicated models keep the schema explicit and easier to validate.
- **Reuse post interaction patterns**: Comment likes should follow the same `toggleLike` style mutation and optimistic behavior already established for post likes.
- **Thread integrity is enforced server-side**: If a reply is created, the referenced parent comment must belong to the same post and family context as the new comment.
- **Mentions are out of scope**: Comment bodies remain plain text in v1. Mention parsing and notifications can build on top of this system later.

### User Stories

- **As a** family member, **I want** to comment on a post, **so that** I can respond to memories and updates in context.
- **As a** family member, **I want** to reply to another comment, **so that** side conversations stay grouped under the relevant message.
- **As a** family member, **I want** to edit or delete my own comment, **so that** I can correct mistakes or remove something I no longer want visible.
- **As a** family member, **I want** to like a comment, **so that** I can acknowledge a reply without writing another one.
- **As a** family member, **I want** the comment count on a post to be accurate in the feed and on the detail page, **so that** I can tell which posts have active discussion.
- **As a** developer, **I want** comment queries and mutations to reuse existing post/feed patterns, **so that** the implementation stays consistent and easier to maintain.

## Implementation Plan

### Phase 1: Data Model and Post Aggregates

**Goal:** Add first-class comment storage and expose accurate aggregate counts on posts.

#### Tasks

- [x] Update `prisma/schema.prisma` to add a `Comment` model with fields:
  - [x] `id` as CUID primary key.
  - [x] `postId` relation to `Post` with cascade delete.
  - [x] `authorMemberId` relation to `FamilyMember` with cascade delete.
  - [x] `parentCommentId` optional self-reference for replies.
  - [x] `content` string field for plain-text body.
  - [x] `createdAt` and `updatedAt` timestamps.
- [x] Add `CommentLike` model with fields:
  - [x] `id` as CUID primary key.
  - [x] `commentId` relation to `Comment` with cascade delete.
  - [x] `memberIdWhoLiked` relation to `FamilyMember` with cascade delete.
  - [x] `createdAt` timestamp.
  - [x] Unique constraint on `(commentId, memberIdWhoLiked)`.
- [x] Add indexes to support thread queries and reply lookups, including combinations covering `postId`, `parentCommentId`, `createdAt`, and `id` ordering.
- [x] Generate and apply a Prisma migration for the comment schema.
- [x] Regenerate the Prisma client in `generated/prisma`.
- [x] Update `prisma/seed.mjs` to create representative mock comments and replies for seeded posts:
  - [x] Seed top-level comments across multiple posts.
  - [x] Seed depth-1 replies linked through `parentCommentId`.
  - [x] Seed deterministic `CommentLike` records so local/dev environments exercise engagement states.
  - [x] Keep the seed behavior idempotent by clearing or rebuilding comment-related records for seeded posts before recreating them.
- [x] Update post query selections and response mapping in `src/server/api/routers/post.ts` so `commentCount` is sourced from Prisma `_count` instead of hard-coded placeholder values.

### Phase 2: Backend Comment API

**Goal:** Add validated, authorized, and rate-limited comment procedures that fit the current tRPC architecture.

#### Tasks

- [x] Add comment input schemas following existing zod conventions, either in `src/server/api/routers/post.ts` or a dedicated shared schema file:
  - [x] `createCommentInputSchema` with `familyId`, `postId`, `content`, and optional `parentCommentId`.
  - [x] `getCommentsInputSchema` with `familyId`, `postId`, `limit`, `cursor`, and optional `parentCommentId`.
  - [x] `updateCommentInputSchema` with `familyId`, `commentId`, and `content`.
  - [x] `deleteCommentInputSchema` with `familyId` and `commentId`.
  - [x] `toggleCommentLikeInputSchema` with `familyId` and `commentId`.
- [x] Reuse the existing family membership guard pattern so every comment query and mutation verifies the caller belongs to the family attached to the post.
- [x] Implement `createComment` mutation:
  - [x] Enforce per-member rate limiting.
  - [x] Confirm the target post exists in the caller's family.
  - [x] If `parentCommentId` is provided, confirm it belongs to the same post.
  - [x] Persist the comment and return a mapped response with author, timestamps, like state, and reply metadata.
- [x] Implement paginated comment reads:
  - [x] Query top-level comments for a post using cursor pagination aligned with existing `createdAt + id` conventions.
  - [x] Load replies for each parent comment using a bounded initial strategy or a dedicated replies query, while preserving a path for future scaling.
  - [x] Return `likedByCurrentUser`, `likeCount`, and `replyCount` in the response shape.
- [x] Implement `updateComment` mutation with author-only permission checks and content validation.
- [x] Implement `deleteComment` mutation with author-only permission checks and hard-delete behavior.
- [x] Implement `toggleCommentLike` mutation following the same idempotent pattern used by post likes, including rate limiting.
- [x] Add backend tests covering authorization, invalid parent references, like toggling, edit/delete ownership checks, and rate limiting behavior.

### Phase 3: Post Detail Thread UI

**Goal:** Replace placeholder comment UI on the post detail page with live comment and reply interactions.

#### Tasks

- [x] Refactor the existing comment scaffolding in `src/app/(app)/post/[postId]/page.tsx` into reusable components where appropriate, such as:
  - [x] `CommentCard` for individual comments and replies.
  - [x] `CommentList` for paginated top-level comments and reply sections.
  - [x] `CommentInput` for new comments and reply/edit forms.
- [x] Wire the post detail page to the new comment queries and mutations using `api` hooks from `src/trpc/react.tsx`.
- [x] Support top-level comment creation with optimistic insertion and rollback on failure.
- [x] Support reply creation beneath a parent comment with clear visual nesting and mobile-safe spacing.
- [x] Support editing an existing comment in place with pending and error states.
- [x] Support deleting an existing comment with confirmation UI to reduce accidental removal.
- [x] Support comment like toggling with optimistic UI behavior and `aria-pressed` semantics.
- [x] Preserve current loading, empty, and error-state patterns already used elsewhere in the feed experience.

### Phase 4: Feed Entry Point, Counts, and UX Polish

**Goal:** Connect feed cards to the thread experience and ensure counts and accessibility remain consistent across surfaces.

#### Tasks

- [ ] Update `src/components/feed/post-card.tsx` so the comment action navigates to `/post/[postId]` as the primary thread entry point.
- [ ] Ensure feed cards display the live `commentCount` returned from the post router.
- [ ] Invalidate or refresh the relevant post queries after comment create, edit, delete, and like actions so feed and detail views remain consistent.
- [ ] Preserve existing accessibility conventions:
  - [ ] `aria-label` text for comment actions.
  - [ ] `aria-pressed` on like toggles.
  - [ ] `aria-live` messaging for async errors or status updates.
  - [ ] Keyboard-friendly focus behavior for inputs, buttons, and destructive actions.
- [ ] Validate mobile responsiveness for thread layout, nested replies, and composer actions in narrow viewports.
- [ ] Perform manual QA for create, reply, edit, delete, and like flows across desktop and mobile.

## Acceptance Criteria

- [ ] Authenticated family members can create top-level comments on a post detail page.
- [ ] Authenticated family members can reply to existing comments with one level of nesting.
- [ ] Only the author of a comment can edit or delete it in v1.
- [ ] Comment likes are persisted, idempotent, and reflected accurately after refresh.
- [ ] Comment counts on feed cards and post detail views are accurate after comment create and delete actions.
- [ ] All comment mutations enforce family membership and reject cross-post or cross-family parent comment references.
- [ ] Thread queries paginate predictably using stable cursors, even when multiple comments share the same timestamp.
- [ ] Optimistic UI updates are used for comment creation and comment likes, with rollback on failure.
- [ ] The post detail comment experience works on mobile and desktop and preserves existing accessibility patterns.
- [ ] New backend tests pass, and the full affected code passes project lint, type checks, and relevant automated tests.