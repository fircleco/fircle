---
title: "Full PWA: WebAPK-First Installability with iOS Baseline Readiness"
status: completed
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/020-web-push-notifications-and-pwa-enablement/prd.md
    description: "Initial push and minimum PWA foundation already delivered"
  - type: prd
    url: .project/prds/017-notifications-platform-foundation-and-unread-badge/prd.md
    description: "Notification routing/deep-link context that push click behavior depends on"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` — when work begins on any phase.
>   - `completed` — when all tasks and acceptance criteria are done.
>   - `on-hold` — if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Full PWA: WebAPK-First Installability with iOS Baseline Readiness

## Description

Fircle already ships a minimum PWA foundation (manifest, service worker, push subscription UX), but Android install quality is still below a WebAPK-ready baseline. Chrome generates WebAPKs automatically from site metadata and service worker behavior, so this PRD focuses on strengthening those inputs to produce a stable, high-quality install experience.

This PRD is WebAPK-first while also adding explicit iOS baseline installability readiness for Safari home-screen usage.

This PRD is intentionally WebAPK-first.

In scope for this PRD:
- Improve manifest completeness for Android install quality (stable app identity, icon metadata, screenshots, shortcuts).
- Add/adjust assets required for polished launcher/splash/notification visuals.
- Harden app metadata and service worker behavior for reliable installed-app launch, navigation fallback, and push click-through routing.
- Add safe-area-aware mobile shell spacing so iPhone notch and home-indicator regions do not overlap app chrome in browser or installed contexts.
- Add QA and docs for Android WebAPK verification workflow.
- Add iOS baseline installability checks and metadata guidance (Safari Add to Home Screen behavior, icon readiness, and mobile-web-app metadata sanity).
- Request notification permission proactively at login so users are opted in early without needing to visit settings.

Out of scope for this PRD:
- Trusted Web Activity (TWA) packaging and Play Store release workflow.
- Native Android wrapper projects or signing pipeline.
- iOS-native push infrastructure (APNS native app path) and iOS-specific native wrapper work.
- Full offline-first architecture (background sync/outbox/conflict resolution).
- Push queue worker architecture beyond current immediate-dispatch model.

### Design Decisions

- **WebAPK input optimization over binary output**: Chrome owns WebAPK generation, so implementation should optimize manifest, icons, screenshots, and service worker behavior rather than attempt custom APK tooling.
- **Stable app identity**: Introduce and preserve a stable manifest `id` to reduce install identity churn across updates.
- **Minimum offline reliability, not offline-first**: Add safe navigation fallback behavior only, avoiding broad runtime caching complexity in this phase.
- **Android-first install polish**: Prioritize maskable icons, screenshot metadata, and shortcut entries that improve Android install prompt and launcher quality.
- **WebAPK-first, iOS-compatible baseline**: Prioritize Android WebAPK quality while ensuring iOS Add-to-Home-Screen flows are not degraded and have explicit metadata support.
- **Shell-level safe areas over per-screen patches**: Handle iOS safe-area insets in the shared mobile app shell so the header, main content, bottom navigation, and slide-out menu all respect notch and home-indicator boundaries consistently.
- **Deterministic iOS video thumbnails for preview tiles**: Use a shared video thumbnail URL strategy that applies a small media-fragment time offset (`#t=0.1`) for non-playing video cards, so Safari/iOS renders a real frame instead of a black placeholder behind the play icon.
- **No TWA coupling**: Keep this PRD independent from Play Store concerns so delivery remains fast and low-risk.

### User Stories

- **As an** Android user, **I want** Fircle to install with a clean launcher icon and correct app identity, **so that** it feels like a trustworthy app rather than a generic browser shortcut.
- **As an** Android user, **I want** the installed app to launch reliably into the correct app scope and URL, **so that** I can use Fircle seamlessly from home screen.
- **As a** family member, **I want** push notification taps from the installed app context to open relevant content consistently, **so that** I can respond quickly without broken navigation.
- **As a** maintainer, **I want** a repeatable WebAPK verification checklist, **so that** Android install regressions are caught before release.
- **As an** iOS user, **I want** home-screen install to launch cleanly with correct app visuals and shell behavior, **so that** the app remains dependable on Safari even without WebAPK.
- **As an** iPhone user, **I want** the app header and bottom navigation to stay clear of the notch and home indicator, **so that** installed and in-browser usage feels native instead of cramped or broken.

## Implementation Plan

### Phase 1: Manifest Identity and Metadata Completion

**Goal:** Bring manifest quality to WebAPK-ready baseline with stable app identity and Android-focused metadata.

#### Tasks

- [x] Update [public/manifest.json](public/manifest.json) to include a stable `id` and preserve consistent `start_url`/`scope` semantics.
- [x] Add/confirm `display_override` ordering and orientation/category metadata for install prompt quality.
- [x] Expand icon entries for Android install quality, including explicit maskable purpose metadata.
- [x] Add screenshots metadata entries (narrow and wide) for richer install surfaces.
- [x] Add app `shortcuts` entries for high-value actions (for example notifications and new post composer entry points).

### Phase 2: Assets for Android Launcher and Prompt Quality

**Goal:** Ship concrete image assets required by manifest metadata and notification surfaces.

#### Tasks

- [x] Add maskable-ready icon asset(s) under [public](public) and wire them in manifest.
- [x] Add screenshot assets under [public](public) matching manifest `screenshots` metadata.
- [x] Add/validate iOS home-screen icon asset(s) under [public](public) and wire metadata references from app layout.
- [x] Validate icon and badge paths used by push notifications to avoid broken image references in installed context.
- [x] Confirm favicon/icon consistency so Android launcher, splash, and notification visuals are coherent.

### Phase 3: App Metadata and Service Worker Hardening

**Goal:** Improve installed-app reliability for launch/navigation and push click behavior without broad offline-first scope.

#### Tasks

- [x] Update [src/app/layout.tsx](src/app/layout.tsx) with explicit App Router `viewport` export and mobile-web-app metadata needed for predictable install behavior on Android and iOS.
- [x] Add shared safe-area inset handling in the mobile app shell so [src/app/(app)/layout.tsx](src/app/(app)/layout.tsx), [src/components/nav/mobile-header.tsx](src/components/nav/mobile-header.tsx), and [src/components/nav/mobile-bottom-nav.tsx](src/components/nav/mobile-bottom-nav.tsx) reserve notch and home-indicator space consistently.
- [x] Apply a shared iOS-safe video thumbnail source helper for non-playing media cards so [src/components/gallery/gallery-media-tile.tsx](src/components/gallery/gallery-media-tile.tsx), [src/components/feed/post-media-grid.tsx](src/components/feed/post-media-grid.tsx), [src/components/feed/post-video-card.tsx](src/components/feed/post-video-card.tsx), and [src/components/feed/post-mixed-media-stack.tsx](src/components/feed/post-mixed-media-stack.tsx) render preview frames instead of black tiles.
- [x] Ensure [src/components/pwa/pwa-registration.tsx](src/components/pwa/pwa-registration.tsx) registration behavior aligns with service worker update expectations.
- [x] Harden [public/sw.js](public/sw.js) push payload parsing so both legacy and current payload URL shapes route correctly.
- [x] Add minimal navigation offline fallback logic in [public/sw.js](public/sw.js) for installed-app baseline resilience.
- [x] Ensure notification click handling safely focuses existing client windows and navigates to same-origin targets.

### Phase 4: QA, Documentation, and Release Guardrails

**Goal:** Validate WebAPK readiness in real Android flows and document a repeatable verification process.

#### Tasks

- [x] Add/update automated tests for service worker-adjacent routing logic where practical (payload URL mapping and fallback behavior).
- [x] Run `pnpm check` and targeted test suites for modified areas.
- [x] Perform manual Android validation on Chrome:
  - [x] install from browser,
  - [x] verify launcher icon quality and app launch behavior,
  - [x] verify push click-through in installed context,
  - [x] verify WebAPK listing/details via `about://webapks`.
- [x] Perform manual iOS baseline validation on Safari:
  - [x] Add to Home Screen flow is available and usable,
  - [x] installed icon/title rendering is acceptable,
  - [x] app launches in expected standalone/fullscreen shell behavior,
  - [x] top and bottom app chrome respect safe areas on notched iPhone devices,
  - [x] video preview tiles show real thumbnail frames instead of black placeholders,
  - [x] core navigation remains functional after install.
- [x] Update [README.md](README.md) with WebAPK-only verification/troubleshooting notes and known caveats.

### Phase 5: Proactive Notification Permission at Login

**Goal:** Ensure authenticated users are prompted to grant notification permission as early as possible — on first login — rather than requiring them to discover the settings page.

#### Tasks

- [x] Create [src/components/pwa/push-permission-request.tsx](src/components/pwa/push-permission-request.tsx) — a `"use client"` component that:
  - Guards on `isBrowserPushSupported()` and `getNotificationPermissionState() === "default"`.
  - Waits 3 seconds after mount before calling `Notification.requestPermission()` so the initial page render is not disrupted.
  - Renders nothing (no visible UI — browser native dialog only).
- [x] Mount `<PushPermissionRequest />` in [src/app/(app)/layout.tsx](src/app/(app)/layout.tsx) so it fires on every authenticated shell render but is a no-op once permission is decided.

## Acceptance Criteria

- [x] Manifest contains a stable `id` and WebAPK-relevant metadata (maskable icon entries, screenshots, shortcuts) with valid asset references.
- [x] Required image assets for maskable icons and screenshots exist and load correctly from manifest URLs.
- [x] Installed Android experience shows expected app identity and launcher quality (no generic/broken icon behavior).
- [x] iOS Safari Add-to-Home-Screen baseline behavior is documented and manually validated (icon/title/shell launch behavior acceptable).
- [x] Shared mobile shell respects iPhone safe areas so the header, navigation, and drawer content do not overlap the notch or home indicator.
- [x] iOS video preview tiles render non-black thumbnail frames in gallery/feed card contexts before playback.
- [x] Service worker click routing opens/focuses the app and navigates to valid in-app targets from push notifications.
- [x] Minimal offline navigation fallback works for top-level app navigation after an initial online load.
- [x] Existing push subscription and notification delivery flows remain functional after changes.
- [x] README documents WebAPK validation steps, including Android device checks and `about://webapks` inspection.
- [x] Lint/typecheck/tests for touched areas pass.
- [x] Authenticated users are prompted for notification permission shortly after login without navigating to settings.

## Further Considerations

- A separate follow-up PRD can address TWA and Play Store distribution (Digital Asset Links, Bubblewrap, signing/release pipeline).
- A later PWA maturity PRD can introduce full offline-first runtime caching, background sync, and richer service worker telemetry.