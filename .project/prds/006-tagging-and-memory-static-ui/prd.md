---
title: "Tagging and Memory Static UI — Media Tagging, Tagged Memories, and Notifications"
status: draft
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/003-core-app-static-uis/prd.md
    description: "Feed, composer, and post card static UI foundation"
  - type: prd
    url: .project/prds/004-family-identity-static-ui/prd.md
    description: "Family identity screens and member profile patterns"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` — when work begins on any phase.
>   - `completed` — when all tasks and acceptance criteria are done.
>   - `on-hold` — if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Tagging and Memory Static UI — Media Tagging, Tagged Memories, and Notifications

## Description

This PRD defines the static UI milestone for Fircle's tagging and memory experience.

After establishing the app shell, auth surfaces, feed/composer flow, family identity screens, and invite/settings screens, the next product layer should make memories feel personal and navigable. Users need to be able to preview how they will tag relatives in photos, understand how video tagging will work over time, browse a member-specific memory archive, and see tag-related activity in notifications.

This phase is intentionally static UI only. No database models, no media upload backend, no persisted tags, no notifications API, and no playback-linked tag timing logic are implemented yet. All media, member references, tags, and notification items are mocked locally.

The goal is to lock down the UX, route structure, component model, and information hierarchy for tagging and memory browsing before wiring Prisma, upload storage, tRPC mutations, and queries.

### Design Decisions

- **Static UI only**: All tagging actions, timeline markers, filters, and notifications are presentational. Buttons may toggle local visual state only.
- **Build on the existing create/feed foundation**: Tagging surfaces reuse the composer/media preview patterns from PRD 003 rather than inventing a separate editing language.
- **Tagging supports claimed and unclaimed members**: Member pickers and chips must visibly distinguish claim status so the future data model can support both.
- **Photo and video tagging are separate UIs**: Photos use spatial tag placement on an image canvas; videos use timeline-based tag moments with side-panel member assignment.
- **Member memories are profile-adjacent**: Tagged memories live under a dedicated route nested beneath a member profile so the archive feels like part of the person's identity record.
- **Notifications page becomes a real destination**: The existing notifications route should be upgraded from a placeholder into a fully designed static list for tag events and related memory activity.
- **Mobile-first interactions**: Tag editing must remain usable on narrow screens through stacked panels, bottom sheets, or condensed controls. Desktop can expand into split-pane layouts.
- **No moderation workflow yet**: Users can see and manage tags visually, but tag approval, privacy exceptions, and disputes are out of scope for this PRD.

### User Stories

- **As a** family member creating a post, **I want** to tag people directly in a photo, **so that** memories can be tied to the relatives who appear in them.
- **As a** family member posting a video, **I want** to indicate when a tagged person appears, **so that** video memories feel searchable and person-centered later.
- **As a** user viewing a member profile, **I want** to browse memories associated with that person, **so that** I can relive family moments centered around them.
- **As a** user checking notifications, **I want** to see when I was tagged or when family members were tagged in new memories, **so that** I can discover relevant activity quickly.
- **As a** family organizer, **I want** unclaimed relatives to appear in tag pickers too, **so that** the memory graph stays complete even before everyone joins the app.

## Implementation Plan

### Phase 1: Routes and Mock Data Foundation

**Goal:** Establish the route skeletons and typed mock data that power all tagging and memory screens.

#### Tasks

- [ ] Create `src/lib/mocks/tagging.ts` with typed mock data for tagging editor states, tag anchors, video tag moments, and tagged memory groups.
- [ ] Add types for:
  - [ ] `TaggedPerson`
  - [ ] `PhotoTagAnchor`
  - [ ] `VideoTagMoment`
  - [ ] `TaggedMemoryItem`
  - [ ] `TagNotificationItem`
- [ ] Seed mock data covering:
  - [ ] claimed and unclaimed tagged members
  - [ ] at least 2 photo-tagging examples
  - [ ] at least 2 video-tagging examples
  - [ ] at least 8 tagged memory items across multiple members
  - [ ] at least 6 tag-related notifications with mixed read/unread states
- [ ] Create `src/app/(app)/create/tagging/photo/page.tsx` as the static photo-tagging route.
- [ ] Create `src/app/(app)/create/tagging/video/page.tsx` as the static video-tagging route.
- [ ] Create `src/app/(app)/members/[memberId]/memories/page.tsx` as the tagged memories archive route.
- [ ] Upgrade `src/app/(app)/notifications/page.tsx` from placeholder to the notifications list route used in this PRD.

---

### Phase 2: Photo Tagging UI

**Goal:** Build the static photo-tag editor used after selecting an image in the create flow.

#### Tasks

- [ ] Implement `src/app/(app)/create/tagging/photo/page.tsx`:
  - [ ] page title and helper copy explaining photo tagging
  - [ ] mock selected photo preview inside a bounded editor canvas
  - [ ] visible tag anchor markers positioned over the image
  - [ ] selected-tag state showing label, member avatar/initials, and claim-status badge
  - [ ] side panel or bottom sheet containing tagged members list
  - [ ] primary CTA: `Save tags`
  - [ ] secondary CTA: `Skip for now`
- [ ] Create `src/components/tagging/photo-tag-editor.tsx`:
  - [ ] image canvas shell
  - [ ] clickable marker primitives
  - [ ] selected marker highlight state
  - [ ] optional crosshair/add-tag visual affordance
- [ ] Create `src/components/tagging/tagged-member-picker.tsx`:
  - [ ] search input mock
  - [ ] list of members from existing family-member mocks
  - [ ] clear claim-status treatment for claimed vs unclaimed members
  - [ ] selected state with checkmark or chip
- [ ] Add empty state mock for a photo with no tags yet.
- [ ] Add overflow handling for dense tagging scenarios (for example, stacked marker offsets or a summary chip).

---

### Phase 3: Video Tagging Timeline UI

**Goal:** Build the static video-tagging experience that conveys person appearances over time.

#### Tasks

- [ ] Implement `src/app/(app)/create/tagging/video/page.tsx`:
  - [ ] mock video player frame with poster image
  - [ ] transport bar shell with current time and duration labels
  - [ ] timeline rail containing visible tag markers at different timestamps
  - [ ] selected timestamp state with member assignments
  - [ ] right-side panel or stacked section for tag details
  - [ ] primary CTA: `Save video tags`
  - [ ] secondary CTA: `Back to composer`
- [ ] Create `src/components/tagging/video-tag-timeline.tsx`:
  - [ ] timeline rail
  - [ ] timestamp markers
  - [ ] selected marker detail affordance
  - [ ] legend or helper text for how tagging works
- [ ] Create `src/components/tagging/video-tag-moment-card.tsx`:
  - [ ] timestamp label
  - [ ] one or more tagged members
  - [ ] appearance notes or optional label mock
- [ ] Add empty state for videos with no tags placed yet.
- [ ] Ensure the layout remains legible on mobile without horizontal overflow.

---

### Phase 4: Tagged Memories Archive

**Goal:** Build the member-centric memory browsing surface for tagged media.

#### Tasks

- [ ] Implement `src/app/(app)/members/[memberId]/memories/page.tsx`:
  - [ ] member header summary reused from the existing member profile pattern
  - [ ] page title such as `Memories with Ava`
  - [ ] filter chips: `All`, `Photos`, `Videos`, `Posts`
  - [ ] optional date-group labels (for example, `This month`, `2025`, `Earlier`)
  - [ ] responsive memory grid/list of tagged items
  - [ ] empty state for members with no tagged memories yet
- [ ] Create `src/components/memories/tagged-memory-card.tsx`:
  - [ ] media thumbnail or video poster
  - [ ] post caption/title snippet
  - [ ] author + date row
  - [ ] tagged-people chips
  - [ ] CTA or affordance to view the original post later
- [ ] Add navigation from the existing member profile UI to the new memories route.
- [ ] Ensure claimed/unclaimed member badges still appear where relevant.

---

### Phase 5: Notifications UI for Tag Activity

**Goal:** Turn notifications into a meaningful static destination centered on tag and memory events.

#### Tasks

- [ ] Implement `src/app/(app)/notifications/page.tsx`:
  - [ ] page title and subtitle
  - [ ] filter tabs/chips: `All`, `Tags`, `Invites`, `System`
  - [ ] unread/read sectioning or visual treatment
  - [ ] list of notification cards from mock data
  - [ ] empty state when no notifications exist
- [ ] Create `src/components/notifications/notification-card.tsx`:
  - [ ] icon/avatar leading content
  - [ ] primary text for tag events (for example, `You were tagged in Emma's birthday post`)
  - [ ] metadata row with relative time
  - [ ] unread indicator
  - [ ] optional thumbnail preview for media-related notifications
- [ ] Include at least these static notification variants:
  - [ ] current user tagged in a photo
  - [ ] current user tagged in a video
  - [ ] a family member was tagged in a new memory
  - [ ] an unclaimed member was tagged
- [ ] Add a `Mark all as read` UI control as a visual-only action.

---

### Phase 6: QA and Polish

**Goal:** Verify the new tagging and memory routes feel cohesive, responsive, and consistent with the existing Fircle UI language.

#### Tasks

- [ ] Test routes in browser at 375px, 768px, and 1024px:
  - [ ] `/create/tagging/photo`
  - [ ] `/create/tagging/video`
  - [ ] `/members/[memberId]/memories`
  - [ ] `/notifications`
- [ ] Verify no horizontal overflow in tagging editors, memory grids, or notifications list.
- [ ] Run `pnpm check` with no TypeScript or lint errors.
- [ ] Ensure dark mode and light mode both render all new components correctly.
- [ ] Verify tag markers, chips, cards, and filters have clear hover/focus states.
- [ ] Confirm all new screens work inside the existing app shell patterns from PRD 001.

## Acceptance Criteria

- [ ] `/create/tagging/photo` renders a static photo-tagging interface with visible tag markers and tagged-member selection UI.
- [ ] `/create/tagging/video` renders a static video-tagging interface with timestamp markers and tag-moment detail UI.
- [ ] `/members/[memberId]/memories` renders a tagged-memory archive for a family member with media cards and filter controls.
- [ ] `/notifications` renders a static notifications list with tag-related event variants and unread/read treatment.
- [ ] Claimed and unclaimed family members are visually distinguishable in tag pickers, chips, and related UI.
- [ ] All new routes are fully responsive at mobile, tablet, and desktop widths with no horizontal scrolling.
- [ ] All new interactive controls are visual-only in this phase: no API calls, no persisted state, and no database reads.
- [ ] The design is consistent with the existing Fircle shell, members UI, and feed card patterns.
- [ ] `pnpm check` passes with no TypeScript or lint errors once implementation is complete.
