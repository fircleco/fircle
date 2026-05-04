---
name: frontend-ui-qa
description: 'Run reusable frontend UI QA workflows. Use when users ask to verify page reachability, open pages in the integrated browser, run Playwright checks, validate interactions/responsive behavior/theme states, and report pass-fail evidence.'
argument-hint: 'Base URL, target routes, and behaviors to verify'
user-invocable: true
---

# Frontend UI QA Guide

A generic, project-agnostic workflow for validating frontend behavior using terminal reachability checks, integrated browser verification, and Playwright-driven interaction checks.

## When to Use

- User asks to test or QA frontend/UI behavior.
- User asks to verify that routes/pages are reachable and render.
- User asks to validate responsive behavior or no-horizontal-scroll.
- User asks to run integrated browser checks.
- User asks to use Playwright for interaction or state verification.
- User asks for evidence-backed pass/fail results before marking tasks complete.

## Inputs

- Base URL (prefer `http://127.0.0.1:<port>` if browser tooling struggles with `localhost`).
- Target routes to verify.
- Requested behaviors (for example: nav active state, modal flows, copy button states, theme behavior).
- Optional breakpoint set (default recommendation: 375, 768, 1024 widths).

## Procedure

### 1. Confirm Reachability

1. Confirm the app server is running.
2. Check base URL and each target route returns successful HTTP response.
3. If any route is unreachable, report blocker immediately and stop deeper UI checks.

### 2. Open Integrated Browser

1. Open a target route in the integrated browser.
2. If navigation fails on `localhost`, retry with `127.0.0.1`.
3. Confirm the page snapshot contains expected heading/landmark content.

### 3. Define QA Scope From User Request

1. Extract exactly what the user asked to verify.
2. Build a focused checklist for only those behaviors.
3. Avoid unrelated checks unless they are obvious prerequisites.

### 4. Validate Route and Navigation State

1. Navigate each target route.
2. Verify page loads with expected content.
3. If route-based navigation exists, verify active state behavior (for example `aria-current="page"`).

### 5. Run Responsive and Overflow Checks (if requested)

1. Set viewport sizes (recommended 375, 768, 1024).
2. Validate each target route at each breakpoint.
3. Check horizontal overflow by comparing client width vs scroll width.
4. Record exact metrics for failures.

### 6. Run Interaction Checks with Playwright

Execute only user-requested behavior flows, such as:

- Open/close panel or modal.
- Form interactions and visual state changes.
- Success and error state rendering.
- Confirm/cancel flows.
- Copy-button or clipboard UI state changes.
- Theme switching behavior (dark/light).

For each check, capture:

- Route
- Action
- Expected result
- Actual result
- Pass/fail

### 7. Run Quality Gate (if relevant)

1. Run project lint/typecheck command (for example `pnpm check`).
2. Capture concise result and include key output lines.

### 8. Report Evidence Clearly

Return a structured summary:

1. Scope tested
2. Passed checks
3. Failed checks
4. Warnings (non-blocking)
5. Blockers (prevented verification)
6. Recommended next actions

## Decision Points

- If route is unreachable: stop and report blocker.
- If integrated browser fails on `localhost`: retry using `127.0.0.1`.
- If Playwright action is flaky: retry once with explicit wait and narrow selector.
- If behavior cannot be verified in current environment: report as unverified, do not mark as passed.

## Completion Criteria

A QA run is complete only when:

- All requested checks are either passed, failed with evidence, or explicitly marked unverified.
- Reachability status is documented.
- Integrated browser verification was attempted and result recorded.
- Playwright checks (if requested) are executed and reported with evidence.
- Quality gate results are included when relevant.

## Rules

- Never claim a check passed unless it was actually executed.
- Do not mark task/PRD checkboxes complete for unverified checks.
- Keep results evidence-based and reproducible.
- Separate blockers from warnings.
- Keep reports concise but auditable.

## Example Prompts

- `/frontend-ui-qa-guide Verify http://127.0.0.1:3000 routes /settings,/settings/invites,/settings/roles with responsive and interaction checks.`
- `/frontend-ui-qa-guide Test modal open/close and copy-button behavior on /settings/invites and summarize pass/fail evidence.`
- `/frontend-ui-qa-guide Run quick QA for /checkout at 375/768/1024 and report horizontal overflow issues.`
