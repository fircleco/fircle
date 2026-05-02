# Fircle - Project Brief

## Overview

Fircle is a family-focused social network: a private space designed for families to connect, share updates, and preserve memories together.

## Problem and Goal

Mainstream social platforms are public-first and not built around real family structure and privacy needs. Fircle solves this by offering a family-first network with controlled access, identity-aware sharing, and memory-centered features.

Goal for the near term: ship a functional MVP quickly.

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

- [x] Project scaffolded
- [ ] Invite-only registration
- [ ] Family member auth and onboarding
- [ ] Unclaimed member profile creation
- [ ] Account claiming flow
- [ ] Post creation with media uploads
- [ ] Member tagging in photos and videos

## Roadmap

### Phase 1 - Functional MVP (single-family mode)
- Invite-only registration
- Family member auth and onboarding
- Unclaimed member profiles
- Account claiming flow
- Post creation with photos and videos
- Member tagging in media

### Phase 2 - Memory Experience
- Tag notifications for claimed members
- Per-member memory timeline (all tagged photos and videos)
- Basic moderation and content controls for family admins

### Phase 3 - Multi-tenancy and Hosting
- Multi-tenancy model for isolated family instances
- Tenant-aware auth, routing, and data boundaries
- Self-hosting and deployment guidance per family instance
