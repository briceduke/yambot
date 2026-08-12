---
name: root-cause
description: Read-only bug diagnosis. Finds the real cause and writes a brief with reproduction steps and a proposed fix path. Use when investigating a bug before /fix. Does not edit code or commit.
disable-model-invocation: true
---

# Root cause

Diagnose a bug. Do not change code. Do not commit.

Bug flow after this skill: `/fix` → `/test` → `/check-and-commit`.

## When to use

- A bug report, failing test, or wrong behavior needs a cause before a fix.
- A cloud or IDE agent should produce a read-only brief for someone else to fix.

## Hard rules

- Read only. Do not edit files, run formatters that rewrite files, or commit.
- Prefer evidence over guesses. A check you did not run does not count.
- Use proved / disproved / unverifiable. Absence of proof is not disproof.
- Do not invent Carbon ERP rules (`companyId`, RLS module shapes, tenant tables). Follow this app’s constitution in `AGENTS.md`.
- Use bun for package scripts. Do not use pnpm.

## Steps

1. Read `AGENTS.md`, `.ai/lessons.md`, and any bug binding or issue notes.
2. State the expected behavior and the actual behavior in one sentence each.
3. Reproduce. Record the exact path: command, URL, input, or test name. If you cannot reproduce, mark the cause **unverifiable** and stop with what is missing.
4. Narrow the cause. Trace from the failure site to the first wrong assumption or state. Prefer the smallest explanation that fits the evidence.
5. Name the primary cause and any secondary factors. Cite files, lines, logs, or command output.
6. Propose a minimal fix direction (what to change, not a full patch). Name the regression that should fail before the fix and pass after.
7. Write the brief below. Hand off to `/fix`. Do not start the fix in this skill.

## Brief format

```markdown
# Root-cause brief

- **Bug:** <short title>
- **Status:** cause found | unverifiable | needs more data
- **Expected:** <one sentence>
- **Actual:** <one sentence>

## Reproduction
1. <exact steps or command>
2. ...
- **Command / path:** `<exact>`
- **Observed output:** <relevant lines>

## Cause
- **Primary:** <one sentence>
- **Evidence:**
  - `<path>` — <what it shows>
  - `<command>` → `<relevant output>`
- **Secondary (optional):** <factors that made it worse>

## Proposed fix path
- **Minimal change:** <what to touch; keep scope small>
- **Regression:** <test or check that should go red, then green, on this same path>
- **Out of scope:** <do not change these>

## Open questions
- <blocking question, or "none">
```

## Stop conditions

- Stop when the brief is complete or when reproduction fails and you need human input.
- Do not call `/fix` until the user or parent agent asks for the fix.
- Do not commit.
