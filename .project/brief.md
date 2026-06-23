# Fircle - Project Brief

## Overview

Fircle is a family-focused social network: a private space designed for families to connect, share updates, and preserve memories together.

## Problem and Goal

Mainstream social platforms are public-first and not built around real family structure and privacy needs. Fircle solves this by offering a family-first network with controlled access, identity-aware sharing, and memory-centered features.

Goal for the near term: move from MVP foundation into Phase 2 by shipping a reliable notifications system across transactional email and push, supported by a solid PWA experience.

## Target Audience

Families (parents, siblings, children, and extended relatives) who want a dedicated private space to stay connected.

## Product Direction

- Build in single-family mode first to reduce complexity and reach usable product fast.
- Keep architecture migration-friendly so multi-tenancy can be added later without major rewrites.
- Prioritize features that create immediate user value: invites, posting, member identity, and tagging.

## Core Features for MVP

- Invite-only registration for a family site (no open sign-up).
- Family member creation without required immediate presence (unclaimed member profiles).
- Account claiming flow so real people can claim previously created member profiles.
- Posts with photo and video support.
- Member tagging in photos and videos, including unclaimed members.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| API | tRPC |
| Database ORM | Prisma |
| Auth | NextAuth.js |
| Styling | Tailwind CSS + shadcn/ui |
| Package Manager | pnpm |

## Scope

Open-source MVP focused on becoming functional quickly for one family instance, then expanding to multi-family hosting.

## Current Status

### Delivered (Phase 1 MVP foundation)
- [x] Project scaffolded
- [x] Invite-only registration
- [x] Family member auth and onboarding
- [x] Unclaimed member profile creation
- [x] Account claiming flow
- [x] Post creation with photo and video uploads
- [x] Member tagging in photos and videos
- [x] Member mention in post caption
- [x] Media Gallery (general and member)

### Active Focus (Phase 2)
- [x] Notifications platform foundation
- [x] Transactional email notifications
- [x] Push notifications (web push)
- [x] PWA enablement for reliable install and push UX

## Roadmap

### Phase 1 - Functional MVP (single-family mode) [Completed]
- Invite-only registration
- Family member auth and onboarding
- Unclaimed member profiles
- Account claiming flow
- Post creation with photos and videos
- Member tagging in media
- Member mention in post
- Media Gallery

### Phase 2 - Notifications and Engagement [Completed]
- Build notifications domain model (events, preferences, delivery logs)
- Add transactional email pipeline for core events
- Add web push subscription and delivery flow
- Convert app to PWA (manifest, service worker, installability)
- Ensure notification UX works well on mobile home-screen installs
- Complete member mention in post caption and connect to notifications

### Phase 3 - Memory Experience
- Per-member memory timeline (all tagged photos and videos)
- Tag notification refinements for claimed members
- Basic moderation and content controls for family admins

### Phase 4 - Multi-tenancy and Hosting [Completed]
- Multi-tenancy model for isolated family instances
- Tenant-aware auth, routing, and data boundaries
- Self-hosting and deployment guidance per family instance
