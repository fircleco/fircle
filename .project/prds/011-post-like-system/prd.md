---
title: "Post Like System"
status: completed
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/010-post-system-media-upload-cloudflare-r2/prd.md
    description: "Post system foundation"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` - when work begins on any phase.
>   - `completed` - when all tasks and acceptance criteria are done.
>   - `on-hold` - if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Post Like Toggle System

## Description

This PRD introduces a durable like system for posts, allowing authenticated family members to like or unlike any post in their family feed. Likes are persisted in the database, reflected in the UI with optimistic updates, and protected by rate limiting and family membership checks. This feature builds on the live post system and is a prerequisite for future reactions, analytics, and notifications.

## Design Decisions
- Likes are toggled via a single mutation endpoint (`toggleLike`).
- Self-likes are allowed for engagement tracking and simplicity.
- Notifications for likes are explicitly out of scope for this phase.
- Optimistic UI updates are required for a responsive experience.
- Rate limiting is enforced per member to prevent spam.
- The schema is designed for future extensibility (e.g., reactions, notifications).

## User Stories
- As a family member, I want to like or unlike any post in my family feed, so I can show appreciation for memories shared by others (or myself).
- As a family member, I want the like button to update instantly when I tap it, so the app feels fast and responsive.
- As a family member, I want to see how many likes each post has and whether I have liked it, so I can track engagement.
- As a developer, I want likes to be idempotent and safe from race conditions, so users can't double-like or unlike in error.

## Implementation Plan

### Phase 1: Data Model & Migration
- [x] Add `PostLike` model to `prisma/schema.prisma`:
  - Fields: id (CUID), postId (FK), memberIdWhoLiked (FK), createdAt
  - Unique constraint on (postId, memberIdWhoLiked)
  - Cascade delete on post/member removal
- [x] Create and apply migration for PostLike
- [x] Confirm Prisma client exposes new relation fields
- [x] Update `prisma/seed.mjs` to mock `PostLike` records for seeded family posts
  - Deterministic pattern across seeded members/posts
  - Idempotent behavior by clearing likes for seeded posts before re-creating

### Phase 2: Backend API & Response Shape
- [x] Update post router response mapping to include real `reactionCount` and `likedByCurrentUser`
- [x] Update `getFeed`, `getById`, and `getPostsByMember` to select like counts and current user's like state efficiently
- [x] Add protected `toggleLike` mutation:
  - Input: familyId, postId
  - Auth: requireFamilyMembership
  - Logic: create like if absent, delete if present (idempotent)
  - Allow self-likes
  - Rate limit per member (e.g., 100/min)
- [x] Add backend tests for toggle behavior, guards, and rate limiting

### Phase 3: Frontend Integration
- [x] Extend post card data contract to include `likedByCurrentUser`
- [x] Wire heart button to toggleLike mutation with optimistic update and rollback
- [x] Invalidate/refetch feed queries on mutation success
- [x] Add pending/disabled state and accessibility attributes (aria-pressed, aria-label)
- [x] Manual QA for mobile/desktop, error handling, and persistence

## Acceptance Criteria
- [x] Likes are persisted and reflected in the UI for all posts in the feed
- [x] Like/unlike is idempotent and safe from double-tap/race conditions
- [x] Optimistic UI updates on tap, with rollback on error
- [x] Like counts and current-user like state are accurate after refresh
- [x] Rate limiting prevents excessive like/unlike attempts
- [x] All new code is covered by backend tests and passes lint/type checks
- [x] Manual QA confirms correct behavior on desktop and mobile
