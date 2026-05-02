---
title: "Foundation UI — App Shell & Navigation"
status: draft
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: image
    url: .project/assets/9976932dc7b2fef4363661166abe5f28.webp
    description: "Mobile reference — 'you & people' app: top header with hamburger + centered logo + notification badge, bottom nav bar with 5 icons"
  - type: image
    url: .project/assets/original-822ee72523e5fd7b7d2d1e968054b218.webp
    description: "Desktop reference — dark dashboard app: fixed icon-only left sidebar (4 nav icons + settings at bottom + FAB), top bar with logo + nav links + user avatar"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` — when work begins on any phase.
>   - `completed` — when all tasks and acceptance criteria are done.
>   - `on-hold` — if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Foundation UI — App Shell & Navigation

## Description

This PRD covers the app shell and navigation layer for Fircle — the persistent structural chrome that wraps every authenticated page.

The layout must feel native on mobile (bottom tab bar, top header) and familiar on desktop (fixed left icon sidebar in the style of x.com). Dark mode is the default experience; light mode must be fully supported and togglable.

This is purely structural and cosmetic UI. No auth gating, no real data, no page content — just the shell that every future screen will live inside.

### Design Decisions

- **Dark mode default**: `next-themes` with `defaultTheme="dark"` and `attribute="class"`. The existing `globals.css` already has complete `.dark` token definitions — no new CSS variables needed.
- **Mobile layout (reference: `9976932dc7b2fef4363661166abe5f28.webp`)**: A fixed top header (hamburger left, centered **fircle** wordmark, notification badge + avatar right) and a fixed bottom nav bar with 5 icon items. The content area fills the space between them and scrolls independently.
- **Desktop layout (reference: `original-822ee72523e5fd7b7d2d1e968054b218.webp`)**: A fixed narrow left sidebar — icon-only width (~64px), icon items vertically stacked in the middle, logo at top, settings + profile at bottom. A floating action button (+) sits at the very bottom left, matching the desktop reference. No top bar on desktop. Content fills the remaining space to the right.
- **Route group `(app)`**: All shell-wrapped pages live under `src/app/(app)/`. This separates auth pages (which won't use the shell) from app pages without affecting URL paths.
- **Nav items (5 total)**: Feed (Home), Members (Users), Create (+), Notifications (Bell), Profile (UserCircle). On mobile these appear in the bottom bar. On desktop these appear in the left sidebar. The Create item is visually prominent on mobile (larger, centered).
- **Theme toggle**: Exposed in the mobile header menu and in the desktop sidebar footer. Uses `next-themes` `useTheme` hook.
- **No sidebar collapse animation in this phase**: The desktop sidebar is always icon-only width for now. Label tooltips on hover are acceptable but not required.
- **Responsive breakpoint**: Mobile layout below `md` (768px), desktop layout at `md` and above. Bottom nav hidden on desktop via `hidden md:flex` and vice versa.

### User Stories

- **As a** family member using Fircle on mobile, **I want** a clearly visible bottom navigation bar with labeled icons, **so that** I can switch between the main sections with one thumb tap.
- **As a** family member using Fircle on desktop, **I want** a compact left sidebar with navigation icons, **so that** the content area gets maximum width without losing access to navigation.
- **As a** user who prefers light mode, **I want** to toggle between dark and light themes, **so that** I can use the app comfortably in any environment.
- **As a** user on mobile, **I want** a top header with the Fircle logo and quick access to notifications, **so that** I always know what app I'm in and can check new activity.

## Implementation Plan

### Phase 1: Theming Infrastructure

**Goal:** Wire `next-themes` into the app so dark mode renders by default and the `dark` class toggles correctly on `<html>`.

#### Tasks

- [ ] Install `next-themes`: `pnpm add next-themes`
- [ ] Create `src/components/theme-provider.tsx`:
  ```tsx
  "use client";
  import { ThemeProvider as NextThemesProvider } from "next-themes";
  export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
    return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
  }
  ```
- [ ] Update `src/app/layout.tsx`:
  - Import and wrap `<TRPCReactProvider>` with `<ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>`
  - Add `suppressHydrationWarning` to the `<html>` tag
- [ ] Create `src/components/theme-toggle.tsx` — a ghost icon button that calls `setTheme` from `useTheme`, rendering `Sun` on dark and `Moon` on light (lucide-react icons)

---

### Phase 2: Navigation Components

**Goal:** Build the three navigation primitives — mobile header, mobile bottom nav, and desktop sidebar — as standalone, composable components.

#### Tasks

**Mobile Header** (`src/components/nav/mobile-header.tsx`)
- [ ] Create component — renders only on `< md`
- [ ] Left: ghost icon button with `Menu` icon (hamburger) — no action needed yet, placeholder for future drawer
- [ ] Center: **fircle** wordmark (text-based logo, `font-bold text-xl tracking-tight`)
- [ ] Right: notification bell with a red badge (hardcoded count `2` for static UI) + avatar placeholder circle
- [ ] Sticky top, full width, `bg-background/80 backdrop-blur-sm border-b border-border`
- [ ] Reference: left hamburger + centered logo + right badges in `9976932dc7b2fef4363661166abe5f28.webp`

**Mobile Bottom Nav** (`src/components/nav/mobile-bottom-nav.tsx`)
- [ ] Create component — renders only on `< md`
- [ ] Fixed bottom, full width, `bg-background border-t border-border`
- [ ] 5 items evenly distributed: Feed (`House`), Members (`Users`), Create (`PlusCircle`), Notifications (`Bell`), Profile (`UserCircle`)
- [ ] Create item is visually larger/prominent (slightly bigger icon, filled circle background)
- [ ] Active item: `text-foreground`; inactive: `text-muted-foreground`
- [ ] Use Next.js `<Link>` with `usePathname()` to derive active state
- [ ] Routes: `/` → Feed, `/members` → Members, `/create` → Create, `/notifications` → Notifications, `/profile` → Profile
- [ ] Reference: bottom bar with 5 icons in `9976932dc7b2fef4363661166abe5f28.webp`

**Desktop Sidebar** (`src/components/nav/desktop-sidebar.tsx`)
- [ ] Create component — renders only on `md+`
- [ ] Fixed left, full height, narrow width (`w-16`), `bg-background border-r border-border`
- [ ] Top: **fircle** logomark (single letter `F` or circle icon, bold)
- [ ] Middle: vertically stacked nav icon buttons — Feed (`House`), Members (`Users`), Notifications (`Bell`), Profile (`UserCircle`)
- [ ] Bottom: `ThemeToggle` button + Settings (`Settings` icon) + floating action Create button (`Plus`) — styled as a rounded pill or circle, matches the `+` FAB in desktop reference `original-822ee72523e5fd7b7d2d1e968054b218.webp`
- [ ] Active item: `bg-muted text-foreground rounded-lg`; inactive: ghost, `text-muted-foreground`
- [ ] Use `usePathname()` to derive active state
- [ ] Add `title` attribute to each button for accessible tooltip on hover

---

### Phase 3: App Shell Layout

**Goal:** Compose the navigation components into a layout that all app pages will inherit.

#### Tasks

- [ ] Create route group directory `src/app/(app)/`
- [ ] Create `src/app/(app)/layout.tsx`:
  ```tsx
  import { MobileHeader } from "~/components/nav/mobile-header";
  import { MobileBottomNav } from "~/components/nav/mobile-bottom-nav";
  import { DesktopSidebar } from "~/components/nav/desktop-sidebar";

  export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
      <div className="flex min-h-screen">
        <DesktopSidebar />
        <div className="flex flex-1 flex-col md:pl-16">
          <MobileHeader />
          <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
            {children}
          </main>
          <MobileBottomNav />
        </div>
      </div>
    );
  }
  ```
- [ ] Create `src/app/(app)/page.tsx` — empty feed placeholder with a centered "Feed coming soon" message so the shell has something to wrap
- [ ] Verify the boilerplate `src/app/page.tsx` either redirects to `/` under `(app)` or is replaced cleanly

---

### Phase 4: Stub Placeholder Pages

**Goal:** Create minimal route stubs so nav links don't 404 and active state works during visual QA.

#### Tasks

- [ ] `src/app/(app)/members/page.tsx` — placeholder
- [ ] `src/app/(app)/create/page.tsx` — placeholder
- [ ] `src/app/(app)/notifications/page.tsx` — placeholder
- [ ] `src/app/(app)/profile/page.tsx` — placeholder
- [ ] Each renders a centered page title only (e.g. `<h1>Members</h1>`)

---

## Acceptance Criteria

- [ ] App loads in dark mode by default without flash of light mode
- [ ] On mobile (< 768px): top header is visible with hamburger, centered fircle wordmark, and notification badge; bottom nav bar is visible with 5 items
- [ ] On desktop (≥ 768px): left sidebar is visible with nav icons, logo, and FAB; mobile header and bottom nav are hidden
- [ ] Active navigation item is visually distinct from inactive items on both mobile and desktop
- [ ] Theme toggle switches between dark and light correctly; preference persists on page refresh
- [ ] All 5 nav routes resolve without 404
- [ ] No TypeScript or lint errors (`pnpm check` passes)
- [ ] Layout does not cause horizontal scroll at any viewport width
