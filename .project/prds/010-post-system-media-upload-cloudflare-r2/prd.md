---
title: "Post System - Live Creation, Media Uploads, and Cloudflare R2 Storage"
status: draft
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/003-core-app-static-uis/prd.md
    description: "Feed, composer, and post card static UI foundation"
  - type: prd
    url: .project/prds/008-unclaimed-member-creation-and-claim-flow/prd.md
    description: "FamilyMember identity model used for post ownership and future tagging"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` - when work begins on any phase.
>   - `completed` - when all tasks and acceptance criteria are done.
>   - `on-hold` - if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Post System - Live Creation, Media Uploads, and Cloudflare R2 Storage

## Description

This PRD transitions Fircle from mocked feed/composer UI to a production-ready post system with real media uploads.

Users should be able to create memory posts with text, photos, videos, or mixed media. Media files should upload to Cloudflare R2 through signed-upload flows, then be persisted as post media records in Prisma and rendered in the live feed.

In addition to the post-level caption, each individual media item should be able to carry its own optional caption. This is especially important for archival and family-history workflows where a single post may bundle photos or videos from different events, years, or people, and each item needs its own descriptive context.

This PRD intentionally sets the storage layer up for future Bring Your Own Storage (BYOS), while implementing Cloudflare R2 as the first concrete provider for MVP.

### Design Decisions

- **Cloudflare R2 now, provider abstraction from day one**: Implement an internal storage adapter contract and an R2 adapter implementation. Post and upload logic must depend on the contract, not R2 SDK types directly.
- **FamilyMember is the author identity**: Post ownership is attached to `FamilyMember` (family-scoped identity), not directly to `User`.
- **Two-step upload and finalize flow**: Client requests upload intents, uploads directly to object storage via signed URLs, then sends finalized media metadata in `post.create` mutation.
- **Provider-agnostic media metadata**: Persist `provider`, `bucket`, `objectKey`, `mimeType`, `sizeBytes`, and optional dimensions/duration instead of relying solely on a public URL.
- **Per-media captions are distinct from the post caption**: The post `caption` remains the overall post-level description, while each `PostMedia` record can store its own optional caption for item-specific context.
- **Server-verified limits**: Enforce upload limits (count, file size, mime types) on the server-side intent endpoint and mutation validation.
- **MVP scope excludes tagging authoring**: This PRD delivers live posts and media uploads only. Media tagging authoring is tracked in a follow-up implementation PRD.
- **Single-family operational assumption**: Continue MVP single-family behavior while keeping schema and service boundaries migration-friendly for multi-family and BYOS.

### User Stories

- **As a** family member, **I want** to create a post with text and media, **so that** I can share memories in realistic formats.
- **As a** family member, **I want** photos and videos to upload reliably before publish, **so that** I do not lose my post progress.
- **As a** family historian, **I want** to caption each photo or video separately, **so that** mixed-era or mixed-event archive posts still preserve item-level context.
- **As a** family member, **I want** to see newly published posts in the feed immediately, **so that** the timeline feels live.
- **As a** maintainer, **I want** storage logic abstracted behind an internal interface, **so that** future BYOS support does not require feed/composer rewrites.

## Implementation Plan

### Phase 1: Data Model for Posts and Media

**Goal:** Replace scaffold post schema with production models that support text/media posts and provider-agnostic media metadata.

#### Tasks

- [ ] Update `prisma/schema.prisma`:
  - [ ] Replace scaffold `Post` shape (`name`) with domain fields including `caption` (optional), `type`, and author relation to `FamilyMember`.
  - [ ] Add `PostType` enum (`TEXT`, `PHOTO`, `VIDEO`, `MIXED`).
  - [ ] Add `PostMedia` model with fields: `id`, `postId`, `provider`, `bucket`, `objectKey`, `url`, `mimeType`, `sizeBytes`, `width`, `height`, `durationMs`, `caption`, `sortOrder`, `createdAt`.
  - [ ] Add `PostMediaType` enum (`IMAGE`, `VIDEO`).
  - [ ] Add indexes needed for feed and media ordering (`postId`, `sortOrder`, `createdAt`).
- [ ] Generate and apply Prisma migration for local/dev.
- [ ] Regenerate Prisma client in `generated/prisma`.
- [ ] Update any server types importing old `Post` fields to align with the new schema.

### Phase 2: Storage Abstraction and R2 Adapter

**Goal:** Introduce a storage provider interface with a concrete Cloudflare R2 implementation.

#### Tasks

- [ ] Add storage contract module under `src/server/storage/`:
  - [ ] Define `StorageProvider` interface (sign upload, build object URL/read URL, delete object).
  - [ ] Define typed input/output shapes (`UploadIntentRequest`, `UploadIntentResponse`, `StoredObjectRef`).
- [ ] Implement `R2StorageProvider` using S3-compatible signing for Cloudflare R2.
- [ ] Add provider factory/resolver that selects provider from env (`STORAGE_DRIVER=r2`).
- [ ] Add env variables to `src/env.js` and docs references:
  - [ ] `STORAGE_DRIVER`
  - [ ] `R2_ACCOUNT_ID`
  - [ ] `R2_BUCKET`
  - [ ] `R2_ACCESS_KEY_ID`
  - [ ] `R2_SECRET_ACCESS_KEY`
  - [ ] `R2_PUBLIC_BASE_URL` (or equivalent read URL base)
- [ ] Ensure post/media code consumes only the storage contract, not provider-specific classes.

### Phase 3: Upload Intent API and Validation

**Goal:** Enable secure direct-to-R2 upload intent generation with server-side validation.

#### Tasks

- [ ] Add authenticated upload route under `src/app/api/` (for example `src/app/api/uploads/intent/route.ts`).
- [ ] Validate request payload on server:
  - [ ] accepted mime types for image/video
  - [ ] max file size per type
  - [ ] max files per post
- [ ] Return signed upload URLs plus required headers/fields and canonical object references.
- [ ] Scope object keys by family/member and date prefix to avoid collisions.
- [ ] Add explicit error responses for unsupported media, oversize files, and auth/permission failures.

### Phase 4: tRPC Post Mutations and Queries

**Goal:** Replace scaffold post router with live create/feed behavior that persists media metadata.

#### Tasks

- [ ] Replace scaffold procedures in `src/server/api/routers/post.ts`:
  - [ ] remove scaffold-only `hello` and `getSecretMessage` procedures.
  - [ ] implement `create` mutation accepting caption, type, and uploaded media object references including optional per-media captions.
  - [ ] in `create`, resolve caller's `FamilyMember` membership and enforce family access.
  - [ ] persist `Post` and ordered `PostMedia` records transactionally.
- [ ] Implement `getFeed` query with cursor pagination ordered by newest first.
- [ ] Include author identity (member name/avatar) and media records, including per-media captions, in feed response.
- [ ] Keep API response shapes aligned with feed UI component needs.

### Phase 5: Composer and Feed Integration

**Goal:** Wire existing feed/composer UI to live upload and post APIs.

#### Tasks

- [ ] Update `src/components/feed/post-composer-dialog.tsx`:
  - [ ] Add file input handling for photos/videos.
  - [ ] Show selected media previews and allow removal before publish.
  - [ ] Add optional caption input for each selected media item.
  - [ ] Call upload intent API, perform direct uploads, and track per-file progress/errors.
  - [ ] Publish via `api.post.create` after successful uploads.
- [ ] Update `src/components/feed/composer-entry.tsx` shortcuts to open composer with intended media mode.
- [ ] Replace mocked feed in `src/app/(app)/page.tsx` with `api.post.getFeed` query.
- [ ] Update media rendering components (`post-media-grid`, `post-video-card`, viewer) to consume real media URLs and metadata.
- [ ] Render per-media captions in gallery/carousel/viewer contexts without replacing the post-level caption.
- [ ] Preserve loading/empty/error states for good first-use UX.

### Phase 6: Security, Reliability, and Test Coverage

**Goal:** Ensure production-safe behavior with clear constraints and automated verification.

#### Tasks

- [ ] Add server-side authorization checks for post create/feed read by family membership.
- [ ] Enforce max media count and allowed file types on both intent and mutation boundaries.
- [ ] Add unit tests for post input validation and storage key generation.
- [ ] Add integration tests for post creation with mixed media metadata persistence.
- [ ] Add UI tests for composer happy path and publish blocking on failed uploads.
- [ ] Ensure no secrets are logged in error paths.

## Acceptance Criteria

- [ ] Authenticated family members can create text-only, photo-only, video-only, and mixed-media posts from the composer.
- [ ] Media uploads go directly to Cloudflare R2 using short-lived signed upload intents from the app backend.
- [ ] Persisted post media records include provider-agnostic object metadata (`provider`, `bucket`, `objectKey`, `mimeType`, `sizeBytes`) and display URL.
- [ ] Persisted post media records can store and return optional per-media captions distinct from the post caption.
- [ ] Feed renders live posts from database data (not local mocks) with correct media ordering and author identity.
- [ ] Feed and viewer UI can display per-media captions for mixed-photo or mixed-video posts without losing the overall post caption.
- [ ] Upload and create flows reject unsupported mime types, oversized files, and over-limit media counts with clear errors.
- [ ] Storage implementation is isolated behind an internal provider interface so adding a second provider does not require changing composer/feed domain logic.
- [ ] Existing invite/member/role features continue to function without regression.
