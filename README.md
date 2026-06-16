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

Optional transactional email variables (required only when `EMAIL_DRIVER=zeptomail`):

- `EMAIL_DRIVER` (`zeptomail`)
- `EMAIL_FROM_ADDRESS` (sender email address)
- `EMAIL_FROM_NAME` (sender display name)
- `ZEPTOMAIL_API_KEY` (ZeptoMail API key)
- `ZEPTOMAIL_ACCOUNT_ID` (ZeptoMail account id)
- `ZEPTOMAIL_API_BASE_URL` (optional override, defaults to `https://api.zeptomail.com`)

Web push variables:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (browser-safe VAPID public key)
- `VAPID_PRIVATE_KEY` (server-only VAPID private key)
- `VAPID_SUBJECT` (`mailto:you@example.com` or an `https://` URL)

Push env behavior:

- In `production`, all three VAPID variables are required.
- In `development` and `test`, VAPID variables are optional unless any one of them is set; then all three are required.

Generate VAPID keys:

```bash
pnpm dlx web-push generate-vapid-keys
```

Copy the generated values into `.env` as `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`, then set `VAPID_SUBJECT` to a valid `mailto:` or `https://` value.

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

# Optional: transactional email provider
# Leave EMAIL_DRIVER unset to run without outbound email.
EMAIL_DRIVER="zeptomail"
EMAIL_FROM_ADDRESS="noreply@example.com"
EMAIL_FROM_NAME="Fircle"
ZEPTOMAIL_API_KEY="your-zeptomail-api-key"
ZEPTOMAIL_ACCOUNT_ID="your-zeptomail-account-id"
# Optional override
# ZEPTOMAIL_API_BASE_URL="https://api.zeptomail.com"

# Optional in development/test, required in production for web push
NEXT_PUBLIC_VAPID_PUBLIC_KEY="your-vapid-public-key"
VAPID_PRIVATE_KEY="your-vapid-private-key"
VAPID_SUBJECT="mailto:you@example.com"
```

### 3. Start a local database

Option A (Linux/macOS, or Windows via WSL):

```bash
./start-database.sh
```

Option B: use your own PostgreSQL instance and set `DATABASE_URL` accordingly.

### Cloudflare R2 CORS (required for browser uploads)

Direct uploads from the browser to signed R2 URLs require bucket CORS rules.
If uploads fail with a network/CORS-style error, configure the R2 bucket CORS to allow:

- `AllowedOrigins`: your app origin (for local dev, `http://localhost:3000`)
- `AllowedMethods`: `PUT`, `GET`, `HEAD`
- `AllowedHeaders`: `content-type`
- `ExposeHeaders`: `etag`

You can add additional origins for staging/production as needed.

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

### 6. First-time instance setup (single-family)

For a fresh self-hosted instance with no family data yet:

1. Open `/auth/setup` in your browser.
2. Enter your family name, owner name, owner email, and password.
3. Submit once to create the first family and owner account.

This setup route is only available before the first family is created.

### Setup readiness troubleshooting

The setup wizard runs active readiness probes before allowing first-family bootstrap:

- Database: fresh Prisma connect + `SELECT 1`
- Object storage: R2 `HeadBucket` with configured credentials
- Web push: VAPID presence and runtime key compatibility validation
- Transactional email: ZeptoMail auth probe when `EMAIL_DRIVER=zeptomail`

If you change `.env` values while the dev server is running, restart `pnpm dev` before re-checking readiness so updated environment values are applied.

## PWA and WebAPK Verification

Fircle uses a WebAPK-first PWA approach for Android Chrome installs, with iOS Safari Add to Home Screen baseline support.

### Local verification checklist

1. Start the app with `pnpm dev` and open `http://localhost:3000`.
2. Open DevTools > Application:
	- verify `manifest.json` is detected,
	- verify service worker `/sw.js` is active and controlling the page,
	- verify app icons and screenshots resolve.
3. In notification settings, enable push and verify browser permission flow and subscription success.
4. Trigger a notification-producing event and verify push click-through routing opens expected in-app context.

### Android (WebAPK) validation

1. Open Fircle in Chrome on Android.
2. Install from browser menu (or install prompt).
3. Verify launcher icon quality and app launch behavior.
4. Validate push click-through while app is installed.
5. Inspect `about://webapks` in Chrome for generated WebAPK details.

### iOS baseline validation

1. Open Fircle in Safari on iOS.
2. Use Share > Add to Home Screen.
3. Verify icon/title rendering and standalone launch behavior.
4. Verify core navigation remains functional after install.

### Troubleshooting notes

- If push subscription fails in VS Code integrated browser, test in regular Chrome or Edge.
- If service worker updates do not apply, reload once after registration update.
- If install visuals look stale, clear site data and reinstall.

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
