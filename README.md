# Fircle

Family-first social network focused on private sharing and memory preservation.

## Product Direction

Fircle is currently optimized for shipping a functional MVP quickly:

- Single-family mode first (faster path to usable product)
- Invite-only registration
- Family member profiles that can exist before account creation (unclaimed members)
- Account claiming flow for later ownership
- Photo/video posts with member tagging

Multi-tenancy is planned after the MVP is functional and validated.

## Tech Stack

- Next.js (App Router)
- TypeScript
- tRPC
- Prisma
- NextAuth.js
- Tailwind CSS
- shadcn/ui
- PostgreSQL

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

Create a `.env` file in the project root.

Required variables:

- `DATABASE_URL` (PostgreSQL connection string)
- `AUTH_SECRET` (required in production, optional in development)
- `NODE_ENV` (`development`, `test`, or `production`)
- `STORAGE_DRIVER` (`r2`)
- `R2_ACCOUNT_ID` (Cloudflare account id)
- `R2_BUCKET` (R2 bucket name)
- `R2_ACCESS_KEY_ID` (R2 API access key id)
- `R2_SECRET_ACCESS_KEY` (R2 API secret access key)
- `R2_PUBLIC_BASE_URL` (public read URL base for uploaded objects)

Example:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/fircle"
AUTH_SECRET="dev-secret"
NODE_ENV="development"
STORAGE_DRIVER="r2"
R2_ACCOUNT_ID="your-cloudflare-account-id"
R2_BUCKET="fircle-media"
R2_ACCESS_KEY_ID="your-r2-access-key-id"
R2_SECRET_ACCESS_KEY="your-r2-secret-access-key"
R2_PUBLIC_BASE_URL="https://media.example.com"
```

### 3. Start a local database

Option A (Linux/macOS, or Windows via WSL):

```bash
./start-database.sh
```

Option B: use your own PostgreSQL instance and set `DATABASE_URL` accordingly.

### 4. Apply schema

For local development:

```bash
pnpm db:generate
```

Alternative quick sync:

```bash
pnpm db:push
```

### 5. Run the app

```bash
pnpm dev
```

Open http://localhost:3000.

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm preview` - Build and start production locally
- `pnpm lint` - Run lint checks
- `pnpm lint:fix` - Auto-fix lint issues where possible
- `pnpm typecheck` - Run TypeScript checks
- `pnpm check` - Run lint + typecheck
- `pnpm format:check` - Check formatting
- `pnpm format:write` - Write formatting changes
- `pnpm db:generate` - Run Prisma migrate dev
- `pnpm db:migrate` - Run Prisma migrate deploy
- `pnpm db:push` - Push Prisma schema to DB
- `pnpm db:studio` - Open Prisma Studio

## Current Focus

MVP implementation priorities:

- Invite-only registration
- Family auth and onboarding
- Unclaimed member profiles
- Account claiming flow
- Posts with photos/videos
- Member tagging in media

## Contributing

Contributions are welcome. Open an issue or pull request for bug fixes, improvements, and feature work aligned with the MVP roadmap.
