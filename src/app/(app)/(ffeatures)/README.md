# Fircle Feature Routes

Feature-owned routes belong in this route group.

Conventions:

- Put feature pages under this folder (for example `events/`, `tasks/`).
- Do not place base/core pages here.
- Route groups do not change public URL shape.

Activation behavior:

- Render feature links and entry points only when activation state says the feature is enabled.
- If enabled but not ready, show remediation UI that points users to `/settings/integrations`.
- Avoid silent failures when users navigate to a feature route that is not ready.
