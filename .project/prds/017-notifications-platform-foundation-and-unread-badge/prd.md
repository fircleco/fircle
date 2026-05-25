---
title: "Notifications Platform Foundation and Unread Navigation Badge"
status: in-progress
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/014-member-tagging-live-photo-and-simple-video/prd.md
    description: "Live media tagging model and APIs that should emit notification events"
  - type: prd
    url: .project/prds/015-member-mention-in-post-captions/prd.md
    description: "Structured mention model and APIs that should emit mention notifications"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` — when work begins on any phase.
>   - `completed` — when all tasks and acceptance criteria are done.
>   - `on-hold` — if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Notifications Platform Foundation and Unread Navigation Badge

## Description

Fircle currently has a static notifications experience at /notifications and hardcoded badge visuals in navigation. The UI shape is validated, but there is no durable notifications domain model, no server query/mutation surface, and no real unread count that can power navigation badges.

This PRD delivers the notifications foundation layer before transactional email and push delivery work.

Scope in this PRD:
- Add durable notification persistence and supporting platform entities needed for future channels.
- Add server procedures for listing notifications, unread counts, and read-state updates.
- Wire live unread count badge to navigation surfaces.
- Replace static notifications-page data with real database-backed data.
- Auto-mark notifications as read when the notifications page is opened.
- Cover comment, reply, and like-driven activity as part of the same notification domain foundation, even if the actual producers are introduced in later phases.

Out of scope in this PRD:
- Sending transactional emails.
- Sending web push notifications.
- Service worker push plumbing and PWA install/push UX.
- Notification preference management UI.
- System-event producer rollout (SYSTEM_EVENT creation flows) beyond foundational typing/UI support.

### Design Decisions

- **Member-scoped unread source of truth**: Unread count is scoped to the signed-in claimed member in the currently selected family context.
- **Foundation before transport**: Persist events and delivery metadata now, but do not implement outbound delivery execution in this phase.
- **Channel-agnostic event model**: Notification records should be source-event oriented (tag, mention, engagement, invite/system) and leave transport concerns to future phases.
- **Role and family boundaries are mandatory**: Reuse existing family membership checks and authorization patterns from current routers.
- **Auto-read on destination open**: Opening /notifications should mark currently unread items as read to keep badge behavior intuitive.
- **Badge compactness rule**: Navigation badge displays numeric count capped at 99+.
- **Surface scope for this phase**: Show badge on desktop sidebar notifications icon and mobile header bell icon; do not change mobile bottom nav in this PRD.

### User Stories

- **As a** claimed family member, **I want** real notifications to be persisted, **so that** my activity history survives refreshes and sessions.
- **As a** claimed family member, **I want** to see unread count on navigation, **so that** I can notice new activity quickly without opening the notifications page.
- **As a** claimed family member, **I want** notifications to be marked read when I open /notifications, **so that** unread badges stay accurate.
- **As an** admin/owner, **I want** invite and system activity to produce notifications, **so that** operational family events are visible in the same activity stream.
- **As a** family member, **I want** comments, replies, and likes to generate notifications, **so that** I can follow conversation and reaction activity in one place.
- **As a** maintainer, **I want** a notification domain foundation with event and delivery-log structure, **so that** email and push channels can be added without reworking core data contracts.

## Implementation Plan

### Phase 1: Notification Domain Schema and Migration

**Goal:** Introduce durable notification entities and indexes that support unread counting, event context, and future delivery channels.

#### Tasks

- [x] Add notification enums and models in [prisma/schema.prisma](prisma/schema.prisma), including:
  - [x] Notification category and event-type enums, including engagement-oriented activity.
  - [x] Notification entity linked to recipient FamilyMember and optional actor/context entities.
  - [x] Read-state fields (isRead/readAt) and createdAt ordering fields.
- [x] Add platform support models required for future channel rollout:
  - [x] NotificationPreference entity (stored defaults, no UI wiring yet).
  - [x] NotificationDeliveryLog (or equivalent) for channel/status attempt tracking.
- [x] Add relation fields and indexes optimized for:
  - [x] unread count by recipient member.
  - [x] newest-first notification listing.
  - [x] event correlation and delivery log lookup.
- [x] Create migration under [prisma/migrations](prisma/migrations) and regenerate client in [generated/prisma](generated/prisma).

### Phase 2: Notification Router and API Contracts

**Goal:** Expose protected family-scoped API procedures for notifications list/count/read operations.

#### Tasks

- [x] Create [src/server/api/routers/notification.ts](src/server/api/routers/notification.ts).
- [x] Register notification router in [src/server/api/root.ts](src/server/api/root.ts).
- [x] Implement protected procedures with membership checks:
  - [x] getUnreadCount(familyId) -> { count }.
  - [x] listByFamily(familyId, cursor?, limit?) -> paginated items.
  - [x] markAsRead(notificationId) for single-item updates.
  - [x] markAllAsRead(familyId) for bulk read-state update.
- [x] Define stable response DTOs for notifications page rendering and badge count consumption.
- [x] Ensure list ordering is deterministic (createdAt desc, id desc tie-break).

### Phase 3: Notification Event Producers (No Transport Sending)

**Goal:** Start creating notification records from existing product events without introducing email/push delivery execution.

#### Tasks

- [x] Add shared notification creation service/helper in server domain layer (co-located under [src/server](src/server)).
- [x] Integrate event creation into tagging flows in [src/server/api/routers/tag.ts](src/server/api/routers/tag.ts):
  - [x] Media tag create/update should notify claimed tagged members.
  - [x] Skip self-notifications when actor and recipient are the same member.
- [x] Integrate event creation into mention flows in [src/server/api/routers/post.ts](src/server/api/routers/post.ts):
  - [x] Post mentions notify claimed mentioned members.
  - [x] Comment mentions notify claimed mentioned members.
- [x] Add notification coverage for post comments and likes as engagement events in the notification model and later producer phases.
- [x] Integrate initial admin-facing events in [src/server/api/routers/invite.ts](src/server/api/routers/invite.ts) for invite/system foundation cases.
- [x] Record delivery-log rows as queued/pending metadata only (no external delivery provider calls).

### Phase 4: Notifications Page Live Data and Auto-Read Behavior

**Goal:** Replace static mocks on /notifications with live API data and automatic read-state updates.

#### Tasks

- [x] Refactor [src/app/(app)/notifications/page.tsx](src/app/(app)/notifications/page.tsx) to query notification router data.
- [x] Replace mock filtering with API-backed filtering and sections for unread/read groups.
- [x] Wire Mark all as read button to markAllAsRead mutation.
- [x] Trigger auto-mark-read when page opens after initial successful load.
- [x] Keep existing visual style and card structure while swapping data source.
- [x] Update [src/components/notifications/notification-card.tsx](src/components/notifications/notification-card.tsx) typing/mapping as needed for live DTOs.
- [x] Freeze notification section placement and card visual state (highlight, bold, unread dot) for the duration of the page visit so auto-read mutations do not reshuffle items in real time. Snapshot initial `isRead` values on first successful query load; pass snapshot value as `initialIsRead` prop to `NotificationCard` for styling; use snapshot for unread/read section grouping.
- [x] Personalize notification card copy using actor member names where available instead of generic "Someone" messaging.
- [x] Add deep-link targets from notifications to relevant product context:
  - [x] post mentions/likes -> post detail page.
  - [x] comment mentions/replies/likes -> post detail page with comment target.
  - [x] media tags -> post detail page with media tag target.
  - [x] invite events -> invites settings view.
- [x] On post detail route, support notification target landing behaviors by URL params (`commentId`, `mediaTagId`) including auto-scroll/open and temporary target highlighting.
- [x] Apply role-aware notification filter visibility on /notifications: hide admin-oriented Invite/System tabs for non-admin members while keeping those tabs available to OWNER/ADMIN roles.

### Phase 5: Navigation Badge Integration

**Goal:** Surface real unread count in selected nav icons with compact display rules.

#### Tasks

- [x] Add unread count query wiring to [src/components/nav/desktop-sidebar.tsx](src/components/nav/desktop-sidebar.tsx).
- [x] Add unread count query wiring to [src/components/nav/mobile-header.tsx](src/components/nav/mobile-header.tsx).
- [x] Enable unread-count polling in nav shell surfaces (desktop sidebar + mobile header) while user is outside /notifications.
- [x] Disable unread-count polling while user is on /notifications to keep page content and styling stable during a visit.
- [x] Implement badge display behavior:
  - [x] hide when count is 0.
  - [x] show exact number for 1-99.
  - [x] show 99+ when count > 99.
- [x] Keep [src/components/nav/mobile-bottom-nav.tsx](src/components/nav/mobile-bottom-nav.tsx) unchanged in this phase.
- [x] Ensure nav layout does not shift when badge appears/disappears.

### Phase 6: Testing and Quality Validation

**Goal:** Validate correctness of notification persistence, scoping, read behavior, and badge rendering.

#### Tasks

- [x] Add router tests in [test/server/api/routers](test/server/api/routers) for:
  - [x] family/membership scoping and authorization.
  - [x] unread count accuracy.
  - [x] list ordering and pagination behavior.
  - [x] mark-as-read and mark-all-as-read behavior.
- [x] Add event-producer tests for tagging/mention/invite pathways creating expected recipient notifications.
- [x] Add UI tests (where supported) for badge rendering and 99+ cap behavior.
- [x] Run lint and targeted tests for changed areas.
- [x] Perform manual QA on desktop and mobile shell for unread badge consistency and auto-read behavior.

## Acceptance Criteria

- [x] Notification domain models and migration are present and applied successfully.
- [x] Notification router is registered and exposes unread count, list, mark one read, and mark all read procedures.
- [x] Tagging and mention flows create notification records for claimed recipients only.
- [x] Comment, reply, and like activity is recognized in the notification model as engagement-class activity.
- [x] Initial admin invite/system events create notification records in foundation scope.
- [x] /notifications renders database-backed notifications instead of static mocks.
- [x] Opening /notifications auto-marks unread items as read.
- [x] Notification section placement and card styling remain stable for the duration of a page visit — items do not visually reshuffle when auto-read fires.
- [x] Notification cards use personalized actor-aware copy for mention/tag/engagement/invite event types.
- [x] Notification cards deep-link to contextual destinations (post/comment/media tag/invite settings) when target metadata is available.
- [x] Notification deep links to post details provide visible target focus (scroll + temporary highlight for comments; media viewer opens and highlights targeted tag).
- [x] Notification filter tabs are role-aware: non-admin members do not see Invite/System tabs, while OWNER/ADMIN users retain full filter visibility.
- [x] Desktop sidebar and mobile header show unread badges with 99+ cap behavior.
- [x] Unread badge in shell surfaces refreshes in-session outside /notifications without requiring navigation.
- [x] Badge count is scoped to signed-in claimed member in active family context.
- [x] Mobile bottom nav remains unchanged in this PRD.
- [x] No email or push delivery execution is introduced in this phase.
- [x] Tests and lint for modified areas pass.

### Future Extension: SYSTEM Notifications

`SYSTEM_EVENT` is defined in the notification domain model and UI mapping, but producer pathways are intentionally deferred from this PRD's completed scope.

Planned implementation extension:
- Add explicit server-side producer hooks for `category: "SYSTEM"` and `eventType: "SYSTEM_EVENT"`.
- Initial candidate triggers:
  - family settings changes (name/image/policy updates),
  - operational notices (maintenance/degraded features),
  - security-oriented notices (account/session risk events).
- Scope recipients intentionally (default: claimed OWNER/ADMIN members unless event is explicitly member-facing).
- Store source metadata (`sourceType`, `sourceId`) for deterministic deep links and auditability.
- Route notification cards to the appropriate destination context (for example: settings surfaces or incident detail context) using the existing `targetHref` pattern.

Delivery/quality expectations for the extension:
- Add producer tests verifying recipient scoping and deduplication semantics.
- Add router/list tests ensuring `SYSTEM_EVENT` ordering and pagination behavior remain stable.
- Add UI checks confirming copy/icon rendering and destination routing.
