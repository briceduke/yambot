---
name: execute
description: Execute an approved implementation plan from .ai/plans/. Default is to fan out one implementer per ready task in each parallel group. Parent runs verify, /check-and-commit (code and slice .ai/ docs), Progress updates, and a finish report that pastes the spec's human smoke steps. Use when asked to implement an approved plan. Do not use without plan approval. Do not redesign; a plan gap means stop and re-plan.
disable-model-invocation: true
---

# execute — run an approved plan

Input: an **approved** plan at `.ai/plans/{date}-{slug}.md`. Output: working,
verified, committed code and slice `.ai/` docs on the feature branch, with the
plan Progress checklist fully checked off.

Your job is to follow the plan exactly — not to improve it. Deviations are
blockers, not judgment calls.

**Human gate:** if the plan status is not approved, or the user has not approved
it in this session, **STOP** and return to `/plan`. Do not start coding.

**Announce at start:** "Using the execute skill — implementing the approved plan
at {path}."

## Anti-patterns (named)

1. **"I will do the whole plan myself in one agent."** Wrong when the plan has
   a parallel group with 2+ ready tasks and disjoint files. Fan out implementers
   is the default.
2. **"Spawn a check-and-commit agent per finished task."** Wrong. The parent runs
   `/check-and-commit` **in this session**. A fresh commit agent pays a full cold
   start (skill + lessons + plan) to re-run gates the implementer already reported.
   Spawn a commit subagent only if the parent cannot run Shell.
3. **"Read lessons + whole plan + group file" in every worker brief.** Wrong.
   Brief = Task N card only (see Worker brief). Do not point workers at the main
   plan except the parent (Progress only).
4. **"Smoke nit → root-cause → fix → test → commit agents."** Wrong. After the
   slice ships, a 1–3 file smoke bug is parent `/fix` + one `/check-and-commit`
   unless it spans >2 packages or needs an unknown multi-file root cause.
5. **"Code is committed, .ai/ can wait."** Wrong. Spec, plan, task cards, grill
   or research runs, and architecture/lessons that belong to the slice go through
   the serial commit lane. Do not leave them untracked.
6. **"CI passed, so live pause/leave is proved."** Wrong. Paste the spec's
   human smoke steps for the operator. Do not mark unverifiable voice behavior
   as proved from CI.

## Step 1: Load and sanity-check

1. Read the whole plan file. Confirm: status is approved, you are on the branch
   it names, the spec it references exists, task dependencies are consistent, and
   `## Parallel groups` exists.
2. Read the first-example / precedent files named in upcoming tasks before you edit.
3. If anything is missing or contradictory → **STOP** and report before touching
   code.

## Step 2: Fan out implementers by parallel group

Walk groups in order (A, then B, then …). For each group:

1. **Announce** which group, how many implementers, and which tasks. Example:
   "Group B — 3 implementers — Tasks 4, 5, 6."
2. **If the group has 2+ ready tasks** with unmet deps cleared and disjoint
   files → **fan out one implementer subagent per task in the same turn** (or
   Multitask when the user is in that mode).
3. **Worker brief (required):** give **only** the Task N block (or path to a
   `task-N.md` card ≤80 lines). Include the branch name and these hard limits:
   - Implement the task steps only.
   - Do **not** run `/check-and-commit`.
   - Do **not** edit `.ai/plans/` (including Progress checkboxes). Hard fail if
     you touch the plan file.
   - Do **not** read the main plan file. Do **not** read a whole group novel.
   - Do **not** read all of `.ai/lessons.md`. Use only the plan’s **Lessons**
     line (tags or ≤40-line digest). If the plan has no Lessons line, rely on
     `AGENTS.md` Always / Never and the task’s own hard rules.
   - Return a short done report: paths touched, Verify command + exit code +
     relevant output (or “Verify deferred — parent will run: {command}”).
4. **Sequential implementers only when** a task has unmet dependencies or would
   share a file with another in-flight task.
5. **Hard rule:** never two agents on the same file.
6. Follow **slice boundaries**. Do not “finish the data layer first” unless the
   plan says a shared foundation is required.

### Parent vs implementers

| Who | Does |
|-----|------|
| Implementer | Task steps only. No commit. No plan file edits. Thin context only. |
| Parent (you) | After implementers return: **serial** verify (if needed) → `/check-and-commit` **in-process** → check Progress off. One task at a time. Docs commit for slice `.ai/` files (Step 3). Finish report pastes the spec's human smoke steps. |

Parallelism stops at implementation. The shared branch and the plan Progress
list have a **single writer**: the parent, in a serial commit lane.

### Single proof ownership

Pick one owner per check. Default under `/execute`:

- Implementer may **skip** the Verify command when the parent will run the same
  command in the commit lane within the same group turn. The done report must
  name the deferred command.
- If the implementer already ran Verify and the report includes command + exit
  code + expected output match, the parent **trusts** that report and does not
  re-run the same package tests before `/check-and-commit`. Re-run only when
  the report is thin, contradictory, or the diff grew after the report.
- `/check-and-commit` still runs its own scoped gates from the diff. Do not spawn
  a second agent whose only job is to re-read that skill.

## Step 3: Serial commit lane (parent only)

As implementers finish a group (or a single task), **queue** them. Do not launch
commit subagents in parallel — and prefer **no** commit subagent at all.

For each queued task, **one at a time**, **you** (the parent):

1. **Verify** — if the done report already proved the task’s Verify block with
   exit code + output, skip re-run. Otherwise run that Verify block; compare to
   expected output. A verification you did not run and did not receive as a
   thick report counts as failed.
2. **Commit** — run `/check-and-commit` **yourself** in this session. Wait until
   it finishes before starting the next task’s commit. One commit per task.
   This skill does not invent a second commit door; it runs the existing skill.
3. **Progress** — after that commit succeeds, **you** check that task off in
   the plan Progress list. Never ask a commit agent to edit the plan. Never edit
   Progress for task N+1 until task N’s commit + checkbox are done. Include the
   plan file in the next serial commit (or the docs commit below).
4. **Docs commit** — after the code tasks (or as its own serial commit), stage
   the slice `.ai/` files that belong to this work: spec, plan, task cards, grill
   or research runs, architecture and lessons updates. Stage only those docs.
   Do not stage secrets. Run `/check-and-commit` in-process. Do not leave those
   files untracked. Workers still must not edit `.ai/plans/` Progress.

Reminders that override anything the plan forgot:

- Prefer bun for install, scripts, and tests (`bun test`, `bun run <script>`).
- Never rebuild or reset a shared database to make a task pass — stop and report.
- Never touch files listed as out of scope.
- If an escape hatch fires, STOP — do not invent a new design.

## Step 4: Blockers — when to STOP

Stop at once and report (do not guess) when:

- A verification fails and one focused fix attempt does not make it pass.
- The plan has a gap: missing step, wrong path, unstated decision.
- An escape hatch condition in the plan triggers.
- You are about to touch a file the task lists as out of scope.
- Ask-first territory appears that the plan did not cover.
- Two tasks would edit the same file in parallel.

Report format: what happened, exact command + output, what you tried, 1–2
options if you have them. After the human resolves it, resume. If the plan
itself is wrong, go back to `/plan` and update the plan file first — never push
through with an unplanned design change.

Red flags — if you think any of these, STOP:

- "the plan is close enough, I'll adapt this step"
- "I'll run all the verifications together at the end"
- "this extra fix is obviously needed"
- "the verification failed but the code looks right"
- "I will do the whole plan myself in one agent"
- "I'll finish the data layer first even though the plan is slice-first"
- "three tasks finished — I'll spawn three check-and-commit agents now"
- "I'll tell every worker to read lessons.md and the whole plan"
- "I'll leave the spec and plan untracked until the PR"
- "CI passed, so live pause/leave is proved"

## Step 5: Finish (and smoke)

After the last task:

1. Run the scoped tests or validation commands named in the plan (and any
   constitution Validation commands in `AGENTS.md` that apply). Prefer packages
   touched in this plan plus one integration set. Do **not** re-run the full
   monorepo ladder as a ritual if every task commit already passed scoped gates —
   run the full ladder once before PR when the user asks for a PR, or when the
   plan’s final proof task says so.
2. For user-facing work: run `/test` (or the prove command for this change
   type). A UI change without a passing behavior proof is **not done**.
3. If the spec Proof plan has a **human smoke script**, paste those steps in
   the finish report. Point at the spec path. Copy from the spec — do not invent
   a second script. Do not wait 5 minutes in smoke if the spec already says the
   timer seam is CI-covered. Do not mark live pause, leave, elapsed, or other
   unverifiable voice behavior as proved from CI.
4. Review the branch with `/self-review`.
5. Report:

```markdown
## Implementation complete
**Plan:** .ai/plans/{date}-{slug}.md (all tasks checked)
**Branch / commits:** {branch}, {N} commits
**Parallelism used:** {groups + implementer counts, or sequential reason}
**Commit lane:** serial, parent in-process (code + slice .ai/ docs)
**Tests:** {commands + results}
**Behavior proof:** {flows via /test, or explicit N/A for non-UI}
**Human smoke:** pasted below from {spec path} — operator must run; not proved by CI
**Deviations from plan:** {none, or list with reasons}
**Ready for:** PR (only if the user asked)

## Human smoke
**Spec:** {spec path}

{paste the spec's numbered human smoke steps here, unchanged}

Do not wait 5 minutes if the spec says the timer seam is CI-covered.
Do not mark live pause/leave as proved from CI.
```

### Post-smoke protocol

When smoke or manual QA finds a small bug after the slice:

1. Default: **parent** patches in this session (or `/fix`) → prove → one
   `/check-and-commit`.
2. Do **not** spawn root-cause / fix / test / commit subagents for a 1–3 file
   nit (copy, ACK timing, one Zod message, one flag bit).
3. Spawn `/root-cause` only when the defect spans >2 packages or the cause is
   unknown after one focused look.

Open a PR only if the user asked for one.
