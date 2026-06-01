---
title: "Web Push Notifications and PWA Enablement"
status: in-progress
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/017-notifications-platform-foundation-and-unread-badge/prd.md
    description: "Notification domain foundation, unread badge behavior, and producer integration points"
  - type: prd
    url: .project/prds/018-transactional-email-adapter-and-zeptomail-invite-claim/prd.md
    description: "Channel delivery architecture direction and graceful failure handling conventions"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` — when work begins on any phase.
>   - `completed` — when all tasks and acceptance criteria are done.
>   - `on-hold` — if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Web Push Notifications and PWA Enablement

## Description

Fircle has a solid notification foundation (notification records, unread badges, and list/read APIs) but currently delivers in-app notifications only. Users do not receive immediate browser/device alerts when new notification rows are created. At the same time, the app lacks the minimum PWA setup that makes push behavior reliable and install UX smoother, especially on mobile home-screen installs.

This PRD delivers:
- immediate web push dispatch for newly created notification events,
- per-user browser subscription management,
- per-interaction push preference controls (mentions, tags, comments, likes, and other supported event types),
- minimum PWA installability primitives (manifest + service worker registration),
- and notification click-through behavior to the existing deep-link targets.

In scope for this PRD:
- Add push subscription persistence and lifecycle APIs.
- Implement server-side web push delivery with VAPID and delivery-log status updates.
- Trigger push attempts immediately after notification creation.
- Add dedicated notifications settings controls for permission/subscription state and interaction-level push preferences.
- Add PWA manifest and service worker wiring needed for practical push UX.

Out of scope for this PRD:
- Full offline-first caching strategy.
- Background queue/orchestrator for retries beyond basic immediate-attempt flow.
- Multi-channel preference management UX beyond push (for example full email + in-app preference matrix).
- Native mobile app push (APNS/FCM SDK-based).

### Design Decisions

- **Immediate dispatch first**: Attempt push as soon as notification rows are committed so users experience near-real-time alerts.
- **Graceful delivery failures**: Push errors should not rollback domain events; failures are reflected in delivery logs for observability.
- **Current-member-first rollout**: Initial product scope targets current signed-in member subscription flows, then expands to all eligible recipient members in a follow-up.
- **Interaction-level preference filtering**: Push delivery must be filtered by member-level interaction preference rules so users can opt in/out of mentions, tags, comments, likes, and other defined event types.
- **Safe defaults**: New preference records default to an opinionated, non-silent baseline (all enabled for MVP) and can be adjusted immediately in notifications settings.
- **Minimal PWA, not full offline**: Ship only what push reliability needs now (manifest, service worker registration, click routing).
- **Standards-based web push**: Use VAPID + browser PushManager + service worker `push`/`notificationclick` handlers rather than vendor lock-in.
- **Invalid subscription hygiene**: Remove expired/invalid endpoints when providers return terminal errors (for example 404/410 semantics).

### User Stories

- **As a** family member, **I want** to receive push alerts when new notifications are created for me, **so that** I notice activity without manually refreshing or opening the notifications page.
- **As a** family member, **I want** tapping a push notification to open the relevant post/comment/invite destination, **so that** I can act quickly in context.
- **As a** family member, **I want** simple controls to enable or disable browser push from a dedicated notifications settings page, **so that** I can manage interruptions without hunting through unrelated account options.
- **As a** family member, **I want** to choose which interactions generate push (for example mentions, tags, comments, likes), **so that** I only receive alerts I care about.
- **As a** maintainer, **I want** push delivery attempts and outcomes tracked in delivery logs, **so that** failures are diagnosable and future retry systems can be added safely.
- **As a** maintainer, **I want** minimum PWA installability in place, **so that** mobile home-screen installs have dependable push behavior.

## Implementation Plan

### Phase 1: Baseline Stabilization and Environment Setup

**Goal:** Remove blockers and add configuration primitives required for push and PWA wiring.

#### Tasks

- [x] Resolve merge conflict markers in [src/app/layout.tsx](src/app/layout.tsx) and keep a single metadata/icons shape.
- [x] Extend [src/env.js](src/env.js) with push configuration:
  - [x] `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
  - [x] `VAPID_PRIVATE_KEY`
  - [x] `VAPID_SUBJECT` (mailto or URL form)
- [x] Ensure runtime env mapping and validation rules are explicit for development vs production.
- [x] Add environment documentation in [README.md](README.md) for generating and configuring VAPID keys.

### Phase 2: Push Subscription Data Model and Migration

**Goal:** Persist browser push subscriptions and interaction-level push preferences with family/member ownership and maintainable indexes.

#### Tasks

- [x] Add a push subscription model in [prisma/schema.prisma](prisma/schema.prisma) with fields such as:
  - [x] `id`, `familyId`, `memberId`
  - [x] `endpoint`, `p256dh`, `auth`
  - [x] optional `userAgent`
  - [x] `createdAt`, `updatedAt`, optional `lastUsedAt`
- [x] Add uniqueness and lookup indexes for endpoint and member-scoped reads.
- [x] Add relation wiring to existing family/member entities in Prisma schema.
- [x] Extend notification preference modeling for interaction-level push controls (event-type granularity, not only coarse category), including clear uniqueness constraints for member/channel/event scope.
- [x] Define and document default preference behavior for newly eligible members.
- [x] Create migration in [prisma/migrations](prisma/migrations) and regenerate Prisma client output in [generated/prisma](generated/prisma).

### Phase 3: Server Push Delivery Module and Notification Integration

**Goal:** Add server-side web push sending and connect it to notification creation flow.

#### Tasks

- [x] Add `web-push` dependency in [package.json](package.json).
- [x] Create server push module (for example under [src/server/notifications](src/server/notifications)) to:
  - [x] initialize VAPID settings once,
  - [x] send JSON payloads with title/body/url metadata,
  - [x] map/send errors to typed outcomes.
- [x] Extend [src/server/notifications.ts](src/server/notifications.ts) to create PUSH delivery-log rows alongside IN_APP where applicable.
- [x] Apply interaction-level preference filtering before push send attempts:
  - [x] if push is disabled for a notification interaction type, mark PUSH delivery as `SKIPPED` with reason metadata,
  - [x] if enabled, proceed with send and normal status transitions.
- [x] Implement immediate dispatch entrypoint invoked after notification rows are created in producer flows:
  - [x] [src/server/api/routers/post.ts](src/server/api/routers/post.ts)
  - [x] [src/server/api/routers/tag.ts](src/server/api/routers/tag.ts)
  - [x] [src/server/api/routers/invite.ts](src/server/api/routers/invite.ts)
- [x] Update delivery-log transitions in DB:
  - [x] `QUEUED` -> `SENT` on success,
  - [x] `QUEUED` -> `FAILED` on transient error,
  - [x] `QUEUED` -> `SKIPPED`/cleanup on terminal invalid subscription errors.

### Phase 4: Subscription Management API and Notifications Settings UX

**Goal:** Allow authenticated members to subscribe/unsubscribe browser endpoints and manage state from a dedicated notifications settings surface.

#### Tasks

- [x] Add protected tRPC procedures in [src/server/api/routers/notification.ts](src/server/api/routers/notification.ts) (or dedicated push router) for:
  - [x] `getPushSubscriptionState(familyId)`
  - [x] `subscribePush(familyId, subscriptionPayload)`
  - [x] `unsubscribePush(familyId, endpoint)`
  - [x] `getPushInteractionPreferences(familyId)`
  - [x] `updatePushInteractionPreferences(familyId, preferences)`
- [x] Register any new router surface in [src/server/api/root.ts](src/server/api/root.ts).
- [x] Add dedicated notifications settings page UI in [src/app/(app)/settings/notifications/page.tsx](src/app/(app)/settings/notifications/page.tsx):
  - [x] capability checks (`Notification`, `serviceWorker`, `PushManager`),
  - [x] permission status display,
  - [x] enable/disable subscription actions,
  - [x] interaction-level preference controls (mentions, tags, comments, likes, and any additional supported interactions),
  - [x] success and recovery messaging for denied permissions.
- [x] Add notifications settings route entry in [src/app/(app)/settings/layout.tsx](src/app/(app)/settings/layout.tsx) so the page is discoverable in settings navigation.
- [x] Add client helper/hook for PushManager registration and VAPID key usage under [src/lib](src/lib) or [src/components/notifications](src/components/notifications).

### Phase 5: PWA Minimum Viable Installability for Push UX

**Goal:** Provide manifest and service worker plumbing needed for dependable install + push interactions.

#### Tasks

- [x] Create [public/manifest.json](public/manifest.json) with required fields:
  - [x] `name`, `short_name`, `start_url`, `display`, `background_color`, `theme_color`, icons.
- [x] Add service worker in [public](public) with handlers for:
  - [x] `push` event to display notifications,
  - [x] `notificationclick` to focus/open app and route to payload target URL.
- [x] Register service worker from app shell (client component mounted via [src/app/layout.tsx](src/app/layout.tsx)).
- [x] Wire manifest and icon metadata from [src/app/layout.tsx](src/app/layout.tsx).
- [x] Keep [next.config.js](next.config.js) changes minimal unless required by implementation constraints.

### Phase 6: Testing, QA, and Rollout Guardrails

**Goal:** Validate push correctness, routing behavior, and regression safety before release.

#### Tasks

- [x] Extend router tests in [test/server/api/routers/notification.test.ts](test/server/api/routers/notification.test.ts) for subscribe/unsubscribe and membership scoping.
- [x] Extend router tests in [test/server/api/routers/notification.test.ts](test/server/api/routers/notification.test.ts) for interaction preference read/update behavior and authorization boundaries.
- [x] Add or extend producer tests to verify push dispatch hooks and delivery-log behavior:
  - [x] [test/server/api/routers/post.test.ts](test/server/api/routers/post.test.ts)
  - [x] [test/server/api/routers/tag.test.ts](test/server/api/routers/tag.test.ts)
  - [x] [test/server/api/routers/invite.test.ts](test/server/api/routers/invite.test.ts)
- [x] Add filtering tests confirming disabled interaction types produce `SKIPPED` push logs and do not call push send.
- [x] Add unit coverage for push provider error mapping and invalid endpoint cleanup.
- [x] Run `pnpm check` and relevant targeted test suites.
- [ ] Execute manual QA scenarios:
  - [ ] permission states (`default`, `granted`, `denied`),
  - [ ] subscribe/unsubscribe lifecycle,
  - [ ] push delivery and deep-link click routing,
  - [ ] installed home-screen behavior on mobile browsers.

## Acceptance Criteria

- [ ] Push subscription records are persisted with member/family ownership and can be removed cleanly.
- [ ] Authenticated users can enable and disable browser push from a dedicated notifications settings page.
- [ ] Authenticated users can configure interaction-level push preferences (mentions, tags, comments, likes, and supported event types) from notifications settings.
- [ ] Notification-producing flows attempt push delivery immediately after notification creation.
- [ ] Push delivery is suppressed for interaction types the member has disabled and logged as skipped.
- [ ] Push payloads render user-visible notifications with meaningful title/body content.
- [ ] Clicking push notifications opens or focuses the app and navigates to the appropriate destination context.
- [ ] Delivery logs reflect push attempt outcomes with clear status transitions.
- [ ] Invalid/expired subscriptions are cleaned up automatically after terminal provider errors.
- [ ] PWA manifest and service worker registration are present and working in supported browsers.
- [ ] Existing in-app notification list/unread badge behavior remains functional.
- [ ] Lint/typecheck/targeted tests for modified areas pass.

## Further Considerations

- Add a background retry worker in a follow-up PRD for guaranteed delivery semantics under transient failures.
- Expand from current-member-first rollout to all eligible claimed recipients once operational confidence is established.
- Expand settings UX in a follow-up to support cross-channel preferences (push/email/in-app) in one unified notification preferences screen.

## Follow-up: Full PWA Maturity Scope

The current PRD intentionally targets minimum installable PWA requirements needed for reliable web push UX. The items below define the follow-up scope required to reach full PWA maturity.

### Full PWA Objectives

- Deliver resilient offline-first behavior for core read surfaces and graceful offline handling for write flows.
- Provide predictable service worker update lifecycle with explicit user-facing refresh controls.
- Add install and runtime telemetry so product decisions are based on actual adoption and reliability data.
- Set quality bars (performance, accessibility, and PWA audits) and enforce them in CI.

### Follow-up Workstreams

#### Workstream 1: Offline Runtime Strategy

- Define caching policy by surface:
  - App shell and static assets (precache).
  - Route-level/document caching for key read pages.
  - API/runtime caching rules by endpoint criticality.
  - Media caching limits and eviction behavior.
- Add offline fallback experiences:
  - Route fallback page for offline navigation failures.
  - Component-level empty/degraded states for failed fetches.
  - Retry affordances when connectivity returns.
- Add data freshness controls (stale-while-revalidate, max-age, cache invalidation hooks).

#### Workstream 2: Background Sync and Write Resilience

- Introduce queued write handling for selected actions when offline (outbox pattern).
- Implement sync/retry orchestration when connectivity resumes.
- Prevent duplicate writes through idempotency keys and client/server reconciliation.

#### Workstream 3: Service Worker Lifecycle and Safety

- Add explicit update lifecycle UX:
  - Detect waiting service worker.
  - Prompt user to refresh for latest version.
  - Safe activation flow to avoid abrupt data-loss moments.
- Add rollback/kill-switch strategy for service worker incidents.
- Add version tagging and structured runtime logs for diagnostics.

#### Workstream 4: Installability and Manifest Polish

- Expand manifest quality:
  - maskable icons,
  - screenshots,
  - shortcuts,
  - richer metadata for platform install prompts.
- Add in-app install guidance UX for platforms with weaker native prompts.
- Validate install flow behavior across desktop, Android, and iOS home-screen contexts.

#### Workstream 5: Performance, Accessibility, and Observability

- Establish Lighthouse thresholds for PWA/performance/accessibility and run in CI.
- Track PWA funnel and reliability metrics:
  - install prompt shown/accepted,
  - push permission conversion,
  - push delivery/open click-through,
  - service worker error rates and update success.
- Add alerting/monitoring on service worker and push delivery regressions.

### Exit Criteria for Full PWA Follow-up

- Core read paths remain usable with meaningful offline fallback behavior.
- Selected critical writes are recoverable after temporary offline periods.
- Service worker updates are transparent, user-safe, and operationally observable.
- Install experience is polished and validated on target platforms.
- CI enforces defined performance/accessibility/PWA quality bars.