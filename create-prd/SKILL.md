---
name: create-prd
description: "Create a new PRD (Product Requirement Document) in the .project/prds/ directory. Use when: user asks to create a PRD, write a PRD, draft a PRD, plan a feature, or requests a product requirement document. Generates PRDs following the project's established format with incremental numbering."
argument-hint: "Describe the feature or change you want a PRD for"
---

# Create PRD

## When to Use

- User asks to create, write, or draft a PRD
- User wants to plan a new feature or change
- User says "create a PRD for X" or "I need a PRD for X"

## Procedure

### Step 1: Determine the Next PRD Number

1. List the contents of `.project/prds/` to find the highest-numbered directory.
2. The next PRD number is `highest + 1`, zero-padded to 3 digits (e.g. `016`).

### Step 2: Gather Context

1. Read the project brief at [.project/brief.md](./../.project/brief.md) to understand the project scope and tech stack.
2. **Always** scan the titles and frontmatter of existing PRDs in `.project/prds/` to understand what has been built and find related work. This gives essential context for writing a well-informed PRD.
3. Link the most relevant prior PRDs in the `references` frontmatter — but **limit to 2–3 references max**. Only link PRDs that directly carry context forward (prerequisites, dependencies, or features this PRD extends). Do not link loosely related PRDs.
4. If the user's request is vague, ask clarifying questions:
   - What specific feature or change does this PRD cover?
   - Are there any existing PRDs this depends on or extends?
   - What is the expected user-facing outcome?

### Step 3: Derive the Folder Slug

Convert the PRD title into a lowercase, hyphenated slug (e.g. "Mail Account Credentials" → `mail-account-credentials`).

### Step 4: Create the PRD File

Create the file at `.project/prds/<NNN>-<slug>/prd.md` using the template below.

### Step 5: Fill in the PRD

Write the PRD content following these conventions observed across the project's existing PRDs:

- **Frontmatter**: YAML with `title`, `status: draft`, and `references` linking to the project brief, related PRDs, or issues.
- **Agent instructions block**: Always include the standard agent instruction callout verbatim (see template).
- **Description**: A clear explanation of the problem and what the PRD addresses.
- **Design Decisions**: Always include a Design Decisions sub-section unless there is genuinely nothing worth noting (which is rare). Most features involve trade-offs, architectural choices, or scope boundaries that should be documented.
- **User Stories**: Written in the "As a / I want / So that" format. Cover the distinct user-facing behaviors the feature introduces.
- **Implementation Plan**: Broken into sequentially numbered phases, each with a goal and a task checklist (`- [ ]`). The number of phases is flexible — use as many or as few as the feature naturally requires. Tasks should be specific and implementable — reference file paths, model names, function signatures where relevant. Code snippets for schemas or key interfaces are encouraged.
- **Acceptance Criteria**: A checklist of specific, measurable conditions that must be met for the PRD to be considered complete.

### Step 6: Present the PRD

After creating the file, summarize:
- The PRD number and title
- The file path
- A brief overview of the phases

## PRD Template

```markdown
---
title: "PRD Title"
status: draft
references:
  - type: doc
    url: .project/brief.md
    description: "Project brief"
---

> **Instructions for AI Agents:**
> - Mark each task checkbox (`- [x]`) immediately upon completion.
> - Update the `status` field in the frontmatter to reflect the current state:
>   - `in-progress` — when work begins on any phase.
>   - `completed` — when all tasks and acceptance criteria are done.
>   - `on-hold` — if work is blocked or paused.
> - Do not skip tasks or mark them complete without implementing the work.

# PRD Title

## Description

[Clear explanation of the problem and what this PRD addresses.]

### Design Decisions

- **Decision name**: Rationale for the decision.

### User Stories

- **As a** [type of user], **I want** [goal/desire], **so that** [benefit/reason].

## Implementation Plan

### Phase 1: [Phase Name]

**Goal:** [Brief description of what this phase achieves]

#### Tasks

- [ ] Task 1 description
- [ ] Task 2 description

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
```

## Reference Types for Frontmatter

Use these `type` values in the `references` array:

| Type | When |
|------|------|
| `doc` | Links to the project brief or other documentation |
| `prd` | Links to related or prerequisite PRDs |
| `issue` | Links to GitHub issues |
| `pull-request` | Links to GitHub PRs |
| `other` | Anything else |
