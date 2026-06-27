# Fircle Feature Routers

Feature-owned tRPC routers are grouped in this folder and mounted under `appRouter.ffeatures`.

Conventions:

- Keep feature procedures out of base router keys.
- Group feature routers by feature key (for example `events.ts`, `tasks.ts`).
- Apply family membership and readiness guards in feature router boundaries.

Readiness behavior:

- Enabled + ready: serve normal data/actions.
- Enabled + not ready: return actionable remediation messages.
- Not enabled: avoid exposing feature entry points in default UI navigation.
