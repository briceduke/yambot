---
name: test
description: Prove a feature or fix against the app's proof ladder — unit or fixture tests first when they are enough, then browser or other behavior checks for user-facing flows. Builds a short test plan from the branch diff, runs the checks with bun where applicable, and records pass/fail evidence. Use after /execute or /fix for user-facing changes, or when asked to verify in the browser.
---

# test — prove the change works

Drive the cheapest sufficient proof for the change type (see the proof ladder in
`AGENTS.md`). A user-facing change that has not passed this skill (or an
equivalent listed proof) is not done.

**Automated proof owns CI.** This skill runs the automated ladder. It does not
pretend to cover external client permission, ACK, live naming, or other
platform truth that only a human can smoke.

Absence of proof is not success. A verification you did not run counts as failed.
Use proved / disproved / unverifiable — never silent skip.

**Announce at start:** "Using the test skill — proving {feature/flows}."

## Arguments

- Feature description: `/test creating an invite`
- GitHub issue: `/test #123`
- Nothing: infer targets from the branch diff

## Step 1: Choose the proof level

Read the proof ladder in `AGENTS.md` (filled by `/constitution`). Pick the
cheapest level that can prove this change:

| Change type (typical) | Start here |
|-----------------------|------------|
| Pure logic / service | `bun test` (or package test script) on the touched paths |
| Sim / game core | Golden replay or property test named in the constitution |
| Bot / handler | Fixture-event unit test |
| Library / CLI | Public-API type test or transcript snapshot |
| Web UI | Unit test if enough; else browser on preview or local app |

If the constitution section is still blank, ask which proof applies, then proceed
with the narrowest safe check.

## Step 2: Decide what to test

- Feature given → that is the target.
- Issue given → `gh issue view <number> --json title,body`.
- Nothing given → read the diff:

```bash
git diff $(git merge-base origin/main HEAD) --stat
git log --oneline $(git merge-base origin/main HEAD)..HEAD
```

Pick 1–3 concrete workflows or assertions tied to acceptance criteria from the
spec (or the PR body). Prefer criteria that can fail clearly.

## Step 3: Write the test plan

Print a short plan before running anything:

```markdown
## Test plan
1. {workflow or assertion}
   - Proof: {command or browser steps}
   - Expected: {observable result}
```

Wait only if the user asked to approve the plan; otherwise run it.

## Step 4: Run automated proof first

Prefer bun:

```bash
bun test {path-or-filter}
# or the package script named in AGENTS.md Validation
bun run test
```

Record command, exit code, and the part of the output that proves the claim.
If unit/fixture proof is enough for this change type, skip browser steps and go
to Step 6.

## Step 5: Browser or environment behavior proof (when required)

Use Cursor browser tools (or the app's documented preview URL) for web UI.

Per workflow: **navigate → act → verify**.

- Navigate to the real route (local or Vercel preview). Prefer seeded branch
  data when the app uses Neon branches — never point at production.
- Fill and submit the way a user would. Prefer role/label selectors over brittle
  indexes.
- Verify an observable result: URL change, visible record, success message, or
  API response the UI depends on.
- On failure: capture what you saw (URL, visible error, console if needed), mark
  FAIL, continue with remaining tests.

If the app cannot boot or the preview is down → mark **unverifiable**, not pass.
Say what blocked you.

### Optional playbook cache

After a PASS on a stable flow, you may write
`.ai/docs/playbooks/{feature-slug}.md` with steps described by label/role (never
session-only refs). Update an existing playbook instead of duplicating it.

## Step 6: Report

```markdown
## Test report
| # | Case | Result | Proof | Notes |
|---|------|--------|-------|-------|
| 1 | {name} | PASS / FAIL / SKIP / UNVERIFIABLE | {command or browser} | {detail} |
```

Rules:

- PASS only with evidence you ran.
- SKIP only with a missing prerequisite stated clearly.
- UNVERIFIABLE when the environment cannot support the check — flag for human
  verification; do not treat as green.
- When the Proof plan lists **unverifiable** items: report each as
  **UNVERIFIABLE**, name the **human smoke script**, and do **not** mark the
  slice green. Automated PASS does not clear those rows.
- Never abort the whole run for one failure — finish the planned cases.

## Done when

- [ ] Every planned case has a result and evidence
- [ ] User-facing flows required by the proof ladder are PASS or explicitly
      UNVERIFIABLE with a blocker
- [ ] Report is shown to the user
