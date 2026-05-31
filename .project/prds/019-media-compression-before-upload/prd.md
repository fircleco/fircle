---
title: "Media Compression Before Upload (WebP Images + Server-Side Video Processing)"
status: completed
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/010-post-system-media-upload-cloudflare-r2/prd.md
    description: "Live post media upload architecture and upload-intent flow"
  - type: prd
    url: .project/prds/013-member-profile-and-user-account-management/prd.md
    description: "Avatar and profile image upload/edit flows"
  - type: pr
    url: https://github.com/babblebey/fircle/pull/30
    description: "Implementation pull request - feat: unified media upload compression"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` - when work begins on any phase.
>   - `completed` - when all tasks and acceptance criteria are done.
>   - `on-hold` - if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Media Compression Before Upload (WebP Images + Server-Side Video Processing)

## Description

Fircle currently uploads selected media files to Cloudflare R2 largely as-is. This creates avoidable storage and bandwidth costs, especially for modern phone photos (including HEIC/HEIF) and large videos. Image compression should happen client-side at publish/save time, while video compression should happen server-side before writing final assets to R2.

This PRD introduces a unified media-compression module used by all active upload surfaces:
- post composer: images and videos
- profile avatar editor: images
- family settings image editor: images

The implementation is phased to ship image compression first and then server-side video transcoding with FFmpeg.

### Design Decisions

- **Compression timing is publish/save-time**: Compress only when user confirms submit, not at file-selection time, to avoid complex dual-state handling (original + compressed files) in picker UI.
- **HEIC preview compatibility at selection-time**: For browser previews only, detect HEIC/HEIF files and convert to a browser-displayable image via `heic2any` before creating preview object URLs.
- **Image defaults prioritize quality and practical limits**: Max dimension 2048px with WebP output quality target of 85%.
- **HEIC/HEIF normalization**: Convert HEIC/HEIF to WebP output for consistent rendering and improved compression efficiency.
- **Image output contract**: Default all compressed image uploads to `image/webp` across composer, avatar, and family image flows.
- **Video output contract**: Normalize to `video/mp4` using H.264/AAC, max 1280px width, `CRF 28`, `preset fast`.
- **Server-side video transcoding (chosen stack)**: Videos are posted to an authenticated server ingest endpoint and transcoded in Node runtime using `fluent-ffmpeg` with `ffmpeg-static`; only compressed outputs are persisted to R2.
- **Progress visibility in composer**: Extend composer selected-media state to represent compression progress separately from upload progress.
- **No browser SharedArrayBuffer dependency**: Do not require COOP/COEP for this feature because video processing is not performed in the browser.

### User Stories

- **As a** family member publishing a post, **I want** images and videos compressed automatically before upload, **so that** uploads are faster and less likely to fail on poor networks.
- **As a** family member uploading HEIC photos, **I want** them converted to WebP automatically, **so that** media remains efficient to store and fast to load.
- **As a** family member selecting a HEIC photo, **I want** to see an immediate thumbnail preview in the browser, **so that** I can confirm the chosen image before publishing or saving.
- **As a** member updating my avatar or family image, **I want** client-side compression to happen transparently, **so that** I get quicker saves without extra steps.
- **As a** maintainer, **I want** one shared compression utility used by all upload surfaces, **so that** behavior and defaults remain consistent.

## Implementation Plan

### Phase 1: Image Compression Foundation and Surface Integration

**Goal:** Ship client-side image compression everywhere media/image uploads are initiated, while preparing an interface for video compression.

#### Tasks

- [x] Install `browser-image-compression` via `pnpm add browser-image-compression`.
- [x] Create [src/lib/media-compression.ts](src/lib/media-compression.ts) with exports:
  - [x] `compressImage(file): Promise<File>` using max 2048px and 85% quality.
  - [x] HEIC/HEIF input normalization to WebP output (`image/webp`).
  - [x] `shouldUseServerVideoCompression(file): boolean` helper (or equivalent) used by composer publish flow.
  - [x] `createPreviewUrl(file): Promise<string>` helper that detects HEIC/HEIF and uses `heic2any` to produce browser-compatible preview object URLs.
- [x] Integrate compression into [src/components/feed/composer-entry.tsx](src/components/feed/composer-entry.tsx):
  - [x] Add `isCompressing` state.
  - [x] In `handlePublish`, compress selected image files before upload intent fetch.
  - [x] Route selected video files to server-side ingest path from Phase 2 (no client-side transcode).
  - [x] Extend selected-media item shape with `compressionProgress`.
  - [x] Update per-item progress UI to reflect image compression, direct upload, and server video processing states.
  - [x] Send compressed image `mimeType` and `sizeBytes` in upload intent payload.
  - [x] Add button-state handling for `Compressing...` alongside existing `Uploading...`.
  - [x] Use `createPreviewUrl` for selected image previews so HEIC/HEIF selections render correctly in-browser.
- [x] Integrate into [src/components/members/edit-profile-dialog.tsx](src/components/members/edit-profile-dialog.tsx):
  - [x] Compress `selectedAvatarFile` in `handleSave` before upload intent/upload.
  - [x] Use `createPreviewUrl` so selected HEIC/HEIF avatars render preview before save.
- [x] Integrate into [src/app/(app)/settings/family/page.tsx](src/app/(app)/settings/family/page.tsx):
  - [x] Compress `selectedFamilyImageFile` in `handleSave` before upload intent/upload.
  - [x] Use `createPreviewUrl` so selected HEIC/HEIF family images render preview before save.

### Phase 2: Server-Side Video Compression Pipeline

**Goal:** Implement an authenticated server ingest flow that transcodes videos to MP4 before persisting final media to R2.

#### Tasks

- [x] Install server-side video tooling via `pnpm add fluent-ffmpeg ffmpeg-static`.
- [x] Add FFmpeg bootstrap utility (for example under `src/server/media/`) that wires `fluent-ffmpeg` to the `ffmpeg-static` binary path.
- [x] Add authenticated ingest endpoint for video uploads (for example [src/app/api/uploads/video/ingest/route.ts](src/app/api/uploads/video/ingest/route.ts)):
  - [x] Accept multipart video file input.
  - [x] Enforce allowed video MIME types and max input size limits.
  - [x] Write input to temporary server storage for processing.
  - [x] Transcode to MP4 (`video/mp4`) with H.264/AAC.
  - [x] Scale output to max 1280px width with preserved aspect ratio.
  - [x] Use `CRF 28` and `preset fast` defaults.
  - [x] Upload transcoded output to R2 through existing storage provider abstraction.
  - [x] Return canonical uploaded object metadata (`provider`, `bucket`, `objectKey`, `mimeType`, `sizeBytes`, optional width/height/duration).
- [x] Update composer publish flow in [src/components/feed/composer-entry.tsx](src/components/feed/composer-entry.tsx):
  - [x] For videos, call server ingest endpoint instead of direct signed-URL upload.
  - [x] Map ingest response into existing `post.create` media payload shape.
  - [x] Surface clear `Processing video...` and failure states.
- [x] Confirm endpoint uses Node runtime (not Edge runtime) where FFmpeg execution is supported.

### Phase 3: Validation, QA, and Hardening

**Goal:** Confirm compression correctness, compatibility, and regression safety.

#### Tasks

- [x] Manual verification checklist:
  - [x] Upload a large JPEG/PNG from composer and confirm R2 object size reduction after WebP conversion.
  - [x] Upload a HEIC photo and confirm stored MIME is `image/webp` and render is correct.
  - [x] Select a HEIC/HEIF image in composer and confirm preview renders before publish.
  - [x] Upload a video and confirm server-side MP4 transcode and successful publish.
  - [x] Upload avatar and family image and confirm pre-upload compression behavior.
  - [x] Select HEIC/HEIF files for avatar and family image and confirm previews render before save.
- [x] Run project tests with `pnpm test` and resolve any regressions.
- [x] Validate user-facing failure behavior:
  - [x] Image compression and server video processing failures surface actionable errors and block publish/save safely.
  - [x] Existing upload error UX remains intact.
- [x] Add/update targeted tests around compression integration points where practical (composer publish path, video ingest route, and profile/family save paths).

## Acceptance Criteria

- [x] All three upload surfaces use shared client-side image compression before upload intent requests.
- [x] HEIC/HEIF image inputs are converted to WebP outputs prior to upload.
- [x] HEIC/HEIF files are preview-detectable and browser-preview compatible on all active upload surfaces by using `heic2any` conversion for preview URLs.
- [x] Composer visibly represents compression/upload/processing phases, including `Compressing...` and video processing action states.
- [x] Upload intent metadata (`mimeType`, `sizeBytes`) reflects compressed outputs, not originals.
- [x] Compressed image uploads persist with `image/webp` MIME across composer, avatar, and family image surfaces.
- [x] Video uploads are transcoded server-side to MP4 (`video/mp4`) with configured constraints before final storage in R2.
- [x] No client-side ffmpeg.wasm dependency is required for video processing.
- [ ] Avatar and family settings image saves compress files before storing.
- [x] `pnpm test` passes with no new regressions.

## Risks and Further Considerations

- **Server runtime constraints**: FFmpeg processing requires Node runtime and sufficient CPU/memory; serverless limits may require queue/offload strategy for larger videos.
- **Request timeout risk**: Synchronous transcode in request lifecycle may exceed platform timeouts; background job orchestration may be required if limits are hit.
- **Temporary file handling**: Ingest route must clean up temp input/output files on both success and failure paths.
- **WebP compatibility edge cases**: While modern browsers support WebP, downstream integrations or non-browser consumers should be validated if they assume JPEG-only image MIME.
- **State model expansion in composer**: Adding `compressionProgress` introduces a two-phase lifecycle that should stay explicit and test-covered to avoid UI race conditions.
