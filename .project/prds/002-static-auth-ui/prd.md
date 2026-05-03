---
title: "Static Auth UI — Landing, Sign In, and Invite Acceptance"
status: in-progress
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: doc
    url: .project/prds/001-foundation-ui-app-shell-navigation/prd.md
    description: "App shell & navigation foundation"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` — when work begins on any phase.
>   - `completed` — when all tasks and acceptance criteria are done.
>   - `on-hold` — if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Static Auth UI — Landing, Sign In, and Invite Acceptance

## Description

This PRD covers the public-facing authentication UI layer for Fircle: three static, unstyled screens that introduce users to the invite-only model and provide entry points for sign in and account creation.

The three screens are:
1. **Landing page** (`/`) — Welcome screen explaining Fircle is invite-only, with "Sign In" and "I have an invite" CTAs.
2. **Sign In page** (`/auth/signin`) — Email + password form for existing family members.
3. **Invite Acceptance page** (`/auth/invite/[code]`) — Display invite details and allow new users to accept and create an account.

These are **purely static UI** — no auth logic, no form submission, no database queries. Forms submit to `#` and state is mocked. The goal is to establish the visual structure and user flow before wiring to NextAuth and tRPC.

### Design Decisions

- **No auth logic in this phase**: Forms are presentational only. Button clicks do nothing. NextAuth and form validation come later.
- **Route structure**: Auth routes live outside the `(app)` route group, so they don't render the app shell (nav, header).
  - `/` — public landing, outside any group
  - `/auth/signin` — public, routes group `(auth)` optional for clarity
  - `/auth/invite/[code]` — public invite link (must support arbitrary `[code]` segment)
- **Dark mode default**: All screens inherit the dark theme from the root layout. Light mode toggle works globally.
- **Responsive design**: Mobile-first. All screens stack vertically and look good at `sm` (375px) and `lg` (1024px).
- **Card-based layout**: Centered card container (max-width ~400px on small screens) with consistent padding and rounded corners. Matches shadcn component aesthetic.
- **Error states**: Show as alert boxes (error text + icon) but do NOT wire to form validation yet. Examples: "Invite expired", "Invalid credentials", "Email not found".
- **Loading state**: Button text changes to show loading (e.g., "Signing in..." or spinner). Visual only, does not block interaction.
- **Form inputs**: Use shadcn `Input` component for consistency.
- **Buttons**: Use shadcn `Button` component with primary (blue) and secondary (ghost) variants.

### User Stories

- **As a** new family member with an invite, **I want** to see a landing page that explains what Fircle is and offers me an "I have an invite" option, **so that** I understand the app's purpose and can proceed with claiming my invite.
- **As an** existing family member, **I want** to sign in with email and password, **so that** I can access my family's shared memories and posts.
- **As a** new user accepting an invite, **I want** to see who invited me and which family I'm joining, **so that** I can be sure I'm accepting the right invite before creating my account.
- **As a** new user on the invite acceptance page, **I want** to see a single "Accept and Sign Up" CTA, **so that** the flow is clear and unambiguous.

## Implementation Plan

### Phase 1: Auth Routes and Layout

**Goal:** Set up the public auth route group, a minimal layout without the app shell, and establish the three route stubs.

#### Tasks

- [x] Create `src/app/(auth)/layout.tsx`:
  - Renders `children` without app shell
  - Centered content area, inherits dark theme
  - Minimal styling: `flex min-h-screen items-center justify-center px-4 py-8`
- [x] Create `src/app/page.tsx` — redirect to `/auth/signin` or render the landing page directly (decision: keep at root)
- [x] Create `src/app/(auth)/signin/page.tsx` — route stub
- [x] Create `src/app/(auth)/invite/[code]/page.tsx` — dynamic route stub
- [x] Verify routes load without 404 and render inside `(auth)` layout

---

### Phase 2: Landing Page

**Goal:** Build the public-facing welcome screen (`/`).

#### Tasks

- [ ] Create `src/app/page.tsx`:
  - Centered card container
  - Fircle heading (large, bold, branded) — e.g., `<h1 className="text-4xl font-bold">Fircle</h1>`
  - Tagline (gray, smaller) — e.g., "Family memories, privately shared."
  - Description paragraph (muted text) — "Fircle is a private social network for families. Membership is by invite only. No public sign-ups."
  - Two CTA buttons:
    - Primary: "Sign In" (routes to `/auth/signin`)
    - Secondary/Ghost: "I have an invite" (routes to `/auth/invite` or shows inline invite code input)
  - Footer link (optional): "Learn more" or placeholder for future feature info
  - Full responsive design: looks good on mobile and desktop
- [ ] Export as a reusable component `src/app/_components/landing-page.tsx` if multiple routes will use it
- [ ] Add Fircle branding (logo or wordmark) at the top if available, otherwise use text

---

### Phase 3: Sign In Page

**Goal:** Build the sign-in form page (`/auth/signin`).

#### Tasks

- [ ] Create `src/app/(auth)/signin/page.tsx`:
  - Centered card container
  - Heading: "Sign In"
  - Subheading (gray): "Enter your family credentials"
  - Form with two inputs:
    - Email: `<Input type="email" placeholder="email@family.com" />`
    - Password: `<Input type="password" placeholder="Password" />`
  - Form action: `action="#"` (no submission in this phase)
  - Submit button (primary): "Sign In"
  - Loading state mockup: When clicked, button text changes to "Signing in..." and becomes disabled
  - Below the form: "Forgot password?" link (not functional)
  - Bottom CTA: "Don't have an account? Request an invite" (links to landing or future invite request page)
  - Error alert box (conditional, hidden by default):
    - Example content: "Invalid email or password. Please try again."
    - Uses `Alert` component from shadcn or custom styled box
  - Responsive: Single column layout on mobile, same on desktop (card stays centered)

---

### Phase 4: Invite Acceptance Page

**Goal:** Build the invite acceptance flow (`/auth/invite/[code]`).

#### Tasks

- [ ] Create `src/app/(auth)/invite/[code]/page.tsx`:
  - Extract `code` from `params` (used for display/context only, not functional yet)
  - Centered card container
  - Invite details card (light border, gray background):
    - Heading: "You're invited to join a family"
    - Invited by: "Invited by **John Smith**" (hardcoded for static UI)
    - Family name: "The Smith Family" (hardcoded)
    - Family description (small, gray): "A close-knit family sharing memories, photos, and updates." (optional)
  - Below invite details: "Relationship to family?" (optional pre-fill or add later in sign-up flow)
  - Form with three inputs (can move to next screen if flow gets long):
    - Name: `<Input placeholder="Your full name" />`
    - Email: `<Input type="email" placeholder="email@family.com" />`
    - Password: `<Input type="password" placeholder="Create a password" />`
  - Form action: `action="#"` (no submission)
  - Submit button (primary): "Accept & Create Account"
  - Loading state: Button text changes to "Creating account..."
  - Error states (conditional, hidden by default):
    - Example 1: "This invite has expired. Please request a new one."
    - Example 2: "This invite has already been used."
    - Example 3: "That email is already registered. Try signing in instead."
  - Bottom link: "Already have an account? Sign in" (links to `/auth/signin`)
  - Responsive: Single column, card-centered layout

---

### Phase 5: Error States and Mocking

**Goal:** Add visual representations of common error flows and edge cases.

#### Tasks

- [ ] Sign In page:
  - Add conditional `Alert` component for error message (hardcoded, example: "Invalid credentials")
  - Add conditional empty/loading button states
- [ ] Invite Acceptance page:
  - Add conditional `Alert` for expired invite (with suggested action)
  - Add conditional `Alert` for already-used invite
  - Add conditional `Alert` for email conflict
- [ ] Landing page:
  - Verify CTAs route correctly to sign in and invite pages
- [ ] All error alerts:
  - Use shadcn `Alert` component if available, or custom styled box with `AlertCircle` icon from lucide-react
  - Red/error color from theme (e.g., `text-destructive`)

---

### Phase 6: QA and Polish

**Goal:** Ensure all routes load, no TypeScript errors, and responsive design works across breakpoints.

#### Tasks

- [ ] Test all three routes in browser at breakpoints: 375px (mobile), 768px (tablet), 1024px (desktop)
- [ ] Verify no horizontal scroll at any width
- [ ] Run `pnpm check` — no TypeScript or lint errors
- [ ] Verify form inputs are fully visible and tappable on mobile (no overlap with keyboard)
- [ ] Check dark mode and light mode toggle works on all three pages
- [ ] Placeholder text is visible and appropriately sized
- [ ] Buttons have clear hover/focus states (from shadcn defaults)

---

## Acceptance Criteria

- [ ] `/` (landing page) renders a centered card with Fircle branding, tagline, and two CTA buttons
- [ ] `/auth/signin` renders a sign-in form with email and password inputs, plus error alert example
- [ ] `/auth/invite/[code]` renders invite details (hardcoded family name and inviter) and a sign-up form
- [ ] All three pages are fully responsive: no horizontal scroll at 375px, 768px, or 1024px widths
- [ ] Dark mode is default; light mode toggle works globally and persists
- [ ] All form inputs use shadcn `Input` component
- [ ] All buttons use shadcn `Button` component with appropriate variants
- [ ] Error states are visually distinct (Alert component with error icon and red text)
- [ ] Loading state mockups show button text changes (e.g., "Signing in...")
- [ ] All routes are publicly accessible (no auth gating yet)
- [ ] `pnpm check` passes with no TypeScript or lint errors
- [ ] No functional form submission or API calls in this phase (all forms submit to `#`)
