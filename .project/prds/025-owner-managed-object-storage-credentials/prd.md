---
title: "Owner-Managed Integration Credentials (BYO)"
status: completed
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
  - type: prd
    url: .project/prds/010-post-system-media-upload-cloudflare-r2/prd.md
    description: "Storage provider abstraction and R2 implementation foundation"
  - type: prd
    url: .project/prds/022-self-hosted-bootstrap-and-setup-readiness/prd.md
    description: "Self-hosted mode gating and setup readiness infrastructure"
  - type: pr
    url: https://github.com/fircle-app/fircle/pull/38
    description: "Implementation pull request - feat: owner-managed integration credentials"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` — when work begins on any phase.
>   - `completed` — when all tasks and acceptance criteria are done.
>   - `on-hold` — if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# Owner-Managed Integration Credentials (BYO)

## Description

Today, object storage (Cloudflare R2) credentials are configured only via environment variables at process startup. This works for single-tenant self-hosted instances, but does not support multi-tenant cloud deployments where each family/tenant should bring their own storage provider and credentials.

This PRD enables family owners to manage their own external-service credentials through a new owner-only settings interface. The first supported use case is object storage, but the model is intentionally future-proofed for other integration-backed credentials such as AI/LLM API keys.

The system resolves provider config with explicit precedence based on deployment mode:

- **Self-hosted mode** (`SELF_HOSTED=true`): Owner-managed DB config takes priority; env fallback is used if DB config is absent.
- **Cloud mode** (`SELF_HOSTED=false`): Owner-managed DB config is required; env R2_* credentials are ignored and a startup warning is logged if detected.

Storing credentials securely requires encryption at rest. A single instance master encryption key (derived from `AUTH_SECRET`) encrypts all tenant credential records in the database.

### Design Decisions

- **Owner-only integration settings**: Credential configuration is owner-scoped, not admin-scoped, matching domain semantics (instance infrastructure, not family content).
- **Category/provider taxonomy**: Use `category` for the broad integration domain (for example `storage`, `ai`) and `provider` for the vendor (for example `r2`, `openai`). Avoid a storage-specific `type` field so the model can grow.
- **Conditional env fallback by deployment mode**: Self-hosted mode allows env → DB fallback for operator convenience; cloud mode requires DB config only to avoid cross-tenant data leakage.
- **Encryption at rest with master key**: Credentials are encrypted using a key derived from `AUTH_SECRET` so rotating the master key invalidates all stored credentials (forcing re-entry). This is intentional and safe.
- **Single unified credential record per tenant/family/category**: No multi-provider or provider rotation within a family/category. Switching providers requires updating the credential record and migrating existing objects out-of-band.
- **Graceful disabled state**: If no owner-managed config exists and cloud mode is active (or env is absent in self-hosted), storage integration is disabled; upload mutations return clear errors instead of silent failures.
- **Optional for cloud if env is set during transition**: Early in rollout, cloud instances may have R2_* env for backward compatibility. The startup warning signals operators to migrate to owner-managed settings.

### User Stories

- **As a** family owner in a multi-tenant cloud deployment, **I want** to provide my own external-service credentials, **so that** my family's data can use tenant-owned infrastructure.
- **As a** self-hosted operator, **I want** to configure credentials in the app once, and avoid managing env vars for future updates.
- **As a** system operator, **I want** cloud deployments to reject env-backed storage credentials and require owner-managed settings, **so that** accidental cross-tenant credential exposure is prevented.
- **As a** family owner, **I want** to verify credentials before saving, **so that** I catch typos or permission issues immediately.
- **As a** maintainer, **I want** credentials encrypted at rest, **so that** database backups and accidental SQL access do not expose raw secrets.

## Implementation Plan

### Phase 1: Database Schema and Encryption Foundation

**Goal:** Add a tenant-scoped credential registry table with encryption support.

#### Tasks

- [x] Add `IntegrationCredential` model to `prisma/schema.prisma`:
  ```prisma
  model IntegrationCredential {
    id               String   @id @default(cuid())
    familyId         String
    category         String   // "storage", "ai", "webhook", etc.
    provider         String   // "r2", "openai", "anthropic", etc.
    
    // Encrypted JSON payload that is provider-specific but category-aware.
    encryptedPayload String   @db.Text
    
    isEnabled        Boolean  @default(true)
    createdAt        DateTime @default(now())
    updatedAt        DateTime @updatedAt
    
    family Family @relation(fields: [familyId], references: [id], onDelete: Cascade)
    
    @@unique([familyId, category])
    @@index([familyId])
    @@index([category])
    @@index([provider])
  }
  ```
- [x] Create and apply Prisma migration for `IntegrationCredential`.
- [x] Add encryption/decryption utilities in `src/lib/encryption.ts`:
  - `encryptCredentials(payload: unknown, masterKey: string): string`
  - `decryptCredentials(encryptedPayload: string, masterKey: string): unknown`
  - Use `crypto.subtle` or `libsodium` (via libsodium.js or tweetnacl) for authenticated encryption.
- [x] Add master key derivation in `src/server/config.ts`:
  - Derive encryption key from `AUTH_SECRET` using HKDF or similar.
  - Ensure key is stable and deterministic so decrypt always works.
- [x] Export utilities for use in credential read/write paths.

### Phase 2: Owner-Only Integration Settings UI

**Goal:** Add a new owner-only settings section for managing integration credentials, starting with object storage.

#### Tasks

- [x] Add `/settings/integrations` route in `src/app/(app)/settings/`:
  - Create `page.tsx` with owner-only access guard (similar to existing domain settings).
  - Add to settings nav in `src/app/(app)/settings/layout.tsx`.
- [x] Create `IntegrationCredentialsForm` component in `src/components/settings/integration-credentials-form.tsx`:
  - Form fields: `category`, `provider`, R2 Account ID, R2 Bucket, R2 Access Key ID, R2 Secret Access Key, R2 Public Base URL.
  - Validation: Require all fields if provider is to be enabled.
  - Submit action: Save credentials (encrypted) to database or display error.
  - Test button: Probe R2 credentials with a `HeadBucket` call before saving (show success/failure feedback).
- [x] Add visual feedback for credential state:
  - Show if credentials are currently enabled/disabled.
  - Show last updated timestamp.
  - Offer ability to disable storage (set `isEnabled=false`) without deleting credentials.
- [x] Add form sections for:
  - Category and provider selection.
  - Current credential status (enabled/disabled, last updated).
  - R2 credentials input with validation.
  - Test/verify button.
  - Save and Cancel actions.

### Phase 3: Credential Resolution Service and Provider Refactoring

**Goal:** Refactor credential resolution to support category/provider-aware config from DB first, then env (self-hosted only).

#### Tasks

- [x] Create `src/server/storage/config-resolver.ts`:
  ```typescript
  export interface StorageConfigResolution {
    driver: StorageDriver;
    config: R2Config | null;
    source: "database" | "environment" | "disabled";
    isValid: boolean;
  }
  
  export async function resolveStorageConfig(
    familyId: string,
    db: PrismaClient,
  ): Promise<StorageConfigResolution>;
  ```
- [x] Implement resolution logic:
  1. If `SELF_HOSTED=false` (cloud):
    - Query `IntegrationCredential` for `familyId` and `category === "storage"`.
     - If present and enabled, decrypt and return config with `source: "database"`.
     - If absent or disabled, return `{ driver: "r2", config: null, source: "disabled", isValid: false }`.
     - If env R2_* is set, log startup warning: "Cloud mode detected with env R2_* credentials; these will be ignored. Please configure storage credentials in app settings."
  2. If `SELF_HOSTED=true`:
    - Query `IntegrationCredential` for `familyId` and `category === "storage"`.
     - If present and enabled, decrypt and return config with `source: "database"`.
     - Else if env R2_* is configured, validate and return with `source: "environment"`.
     - Else return disabled.
- [x] Update `src/server/storage/provider.ts`:
  - Refactor `createStorageProvider()` to accept `StorageConfigResolution` instead of reading env directly.
  - Update `getStorageProvider()` to call `resolveStorageConfig()` and pass result to provider factory.
  - Add context to provider instantiation (for example, pass `familyId` to provider or cache by family).
  - Handle disabled case: throw clear error with remediation hint.
- [x] Ensure upload intent endpoint in `src/app/api/uploads/intent/route.ts` calls the new resolver and surfaces credential errors with clear messaging.

### Phase 4: Credential Management API (tRPC Procedures)

**Goal:** Expose owner-only mutations for credential CRUD and testing.

#### Tasks

- [x] Create `src/server/api/routers/integration.ts`:
  - `saveIntegrationCredential`: Owner-only mutation to save encrypted integration credentials.
    - Input: `familyId`, `category`, `provider`, `payload`.
    - Validate all required fields.
    - Call `testIntegrationCredential()` optionally to probe before save (controlled by input flag).
    - Encrypt and upsert `IntegrationCredential`.
    - Return success with credential state (no secrets in response).
  - `getIntegrationCredentials`: Owner-only query to fetch current credential state (metadata only, no decrypted secrets).
    - Return: enabled status, last updated, category, provider.
  - `testIntegrationCredential`: Owner-only mutation to validate credentials without saving.
    - Input: `category`, `provider`, `payload`.
    - Call the provider-specific validation hook (for storage, `HeadBucket` on R2).
    - Return: `{ ok: boolean, message: string }`.
  - `disableIntegrationCredential`: Owner-only mutation to disable a credential without deleting records.
    - Set `IntegrationCredential.isEnabled = false`.
  - Register `integrationRouter` in `src/server/api/root.ts`.

### Phase 5: Startup Validation and Setup Readiness Updates

**Goal:** Update setup readiness checks to account for owner-managed storage in cloud mode.

#### Tasks

- [x] Update `src/server/api/routers/setup.ts` `getSetupReadiness` procedure:
  - If cloud mode: Check for valid `IntegrationCredential` record for the storage category or note that storage is required.
  - If self-hosted mode: Keep existing env + optional owner-config logic.
  - Display storage readiness status clearly in setup UI.
- [x] Add startup warning logic:
  - On app boot, if `SELF_HOSTED=false` and env R2_* are set, log warning to console and structured logs.
  - Suggest operators migrate to owner-managed settings.
- [x] Update setup/readiness UI to show:
  - Storage status and remediation if missing in cloud.
  - Note that storage is optional in self-hosted but required in cloud.

### Phase 6: Documentation and Migration Guide

**Goal:** Document the new credential management flow and provide migration steps for existing deployments.

#### Tasks

- [x] Update `README.md`:
  - Add section on owner-managed storage in the app settings.
  - Note the difference between self-hosted (env optional) and cloud (DB required).
  - Document the test/verify credential flow.
- [x] Add deployment guide for cloud operators:
  - Step-by-step: Create R2 account → Get credentials → Go to Family Settings → Integrations → Add Storage → Test → Save.
  - Explain what happens if credentials are missing (uploads fail with clear error).
- [x] Add self-hosted migration guide:
  - Option A: Keep env, no action needed.
  - Option B: Migrate to owner-managed settings via app for easier future updates.

## Acceptance Criteria

- [x] `IntegrationCredential` table exists and stores encrypted integration credential records.
- [x] Encryption/decryption utilities work correctly with master key derived from `AUTH_SECRET`.
- [x] Owner-only `/settings/integrations` page loads and displays current credential state.
- [x] Owner can enter R2 credentials, test them, and save them successfully.
- [x] Credentials are stored encrypted in the database and inaccessible in plaintext queries.
- [x] Storage provider resolution prioritizes DB config over env in both self-hosted and cloud modes per the specified precedence.
- [x] Cloud mode (`SELF_HOSTED=false`) ignores env R2_* and logs a warning if detected.
- [x] Cloud mode fails with clear error if no DB credential record exists and upload is attempted.
- [x] Self-hosted mode falls back to env if no DB record and env is configured.
- [x] Setup readiness checks account for owner-managed storage status and display it correctly.
- [x] Upload intent endpoint resolves credentials correctly and returns errors if storage is disabled.
- [x] tRPC integration router procedures work: save, get, test, disable.
- [x] Documentation reflects the new flow and deployment differences.
