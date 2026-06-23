# Cloud Storage Deployment Guide

This guide is for cloud operators and family owners using a cloud deployment where `SELF_HOSTED=false`.

## What to expect

- Storage is configured per family from Settings > Integrations.
- `R2_*` environment variables are ignored in cloud mode.
- Uploads will fail until a storage credential exists and is enabled.

## Setup steps

1. Create or confirm your Cloudflare R2 bucket.
2. Get the bucket details and API credentials for the family that will own the storage.
3. Sign in as the family owner.
4. Open Settings > Integrations.
5. Click Add integration.
6. Choose Storage, then the storage provider.
7. Enter the credentials.
8. Click Test to verify access.
9. Save the credential after the test passes.

## If storage is missing

- The feed page will show a notice to the owner.
- Media uploads will be unavailable until storage is configured.
- The app will surface a clear storage-disabled error instead of failing silently.

## Notes for operators

- Keep the owner-managed credential as the source of truth for cloud deployments.
- Do not rely on environment variables for tenant-specific storage in cloud mode.
- If you need to rotate credentials, update the family credential in the app and verify the new access before removing the old one.