# Self-Hosted Storage Migration Guide

This guide is for self-hosted deployments where `SELF_HOSTED=true`.

## Recommended approaches

### Option A: Keep using environment variables

- No immediate action is required.
- Continue setting `R2_*` values in `.env` or your deployment environment.
- The app will use the environment fallback if no owner-managed storage credential is configured.

### Option B: Migrate to owner-managed storage

1. Sign in as the family owner.
2. Open Settings > Integrations.
3. Add a Storage integration.
4. Enter the current R2 credentials.
5. Run the credential test.
6. Save the credential.
7. Once you confirm uploads work, remove or rotate the old environment values if you want the app to rely on the stored credential only.

## Why migrate

- Easier credential updates without editing deployment files.
- A single family owner can rotate storage access from the UI.
- The app preserves the same precedence rules: database credential first, env fallback only when needed in self-hosted mode.

## Notes

- If no owner-managed credential exists and `R2_*` is also missing, storage uploads will be disabled.
- In cloud mode, the environment fallback does not apply.