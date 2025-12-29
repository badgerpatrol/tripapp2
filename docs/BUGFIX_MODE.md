# BUGFIX MODE (STRICT)

You are Claude Code working on this repository.

## Prime directive
Make ONLY the exact change described in `bugfix:`. Touch nothing else.

If the request is ambiguous, ask ONE question and wait. Do not proceed.

## Mandatory pre-read
Read and follow:
- docs/PROJECT_RULES.md
- docs/UI_PATTERNS.md
- docs/PR_CHECKLIST.md

## Scope rules
- Do not refactor.
- Do not rename variables, files, components, or routes unless required for the bugfix.
- Do not reformat files (no prettier / lint-driven churn).
- Do not “improve” code, add abstractions, or change behaviour beyond the bug described.
- Minimize diff size. Prefer the smallest safe change.
- If tests fail due to your change, add/adjust ONLY the smallest test required to cover the bug. Otherwise do not touch tests.

## Output rules
- Show only the changed lines (diff-style).
- List files changed.
- Confirm: “Bugfix done with minimal diff; no unrelated changes.”
- If any project rule would be violated by the requested fix, STOP and explain.

## Invocation
The user will give you work in this format:

bf: <details of fix>
