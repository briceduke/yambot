---
name: check-and-commit
description: Only committing skill. Derives scope from the diff, runs ordered gates (migration drift, format/lint, scoped typecheck, scoped tests, conditional build), then creates a conventional commit with bun. Use when work is ready to commit.
disable-model-invocation: true
---

# Check and commit

This is the **only** skill that commits. Every other skill stops before `git commit`.

## When to use

- A feature, bug fix, or chore is ready and local gates should run before commit.
- A human asks you to commit a finished slice.

## Hard rules

- Do not commit if any required gate fails.
- Do not use `--no-verify` or skip hooks unless the user explicitly orders it.
- Do not push unless the user asks for push.
- Do not amend unless the user asks and the amend rules in the repo allow it.
- Use bun for scripts. Do not use pnpm.
- Conventional commits only: `type(scope): summary` (types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `ci`, `build`).
- Follow `AGENTS.md`. Do not add Carbon ERP rules.
- Do **not** edit plan Progress checklists (`.ai/plans/**`). That is the execute
  parent’s job after this skill returns. Under `/execute`, the parent runs this
  skill **in-process** (one commit at a time on the shared branch). Do not spawn
  a fresh agent whose first job is to re-read this skill unless the parent cannot
  run Shell.

## Derive scope from the diff

1. Run `git status` and `git diff` (staged and unstaged).
2. List touched paths. Infer packages and folders.
3. Choose **scoped** typecheck and test commands for those paths. Prefer package-local scripts over a full monorepo run when the app has packages.
4. Note whether schema or migration files changed (migration drift gate).
5. Note whether a build is needed (UI/public API / next build scripts exist and the diff touches them). Skip build when the diff is docs-only or clearly non-build.

## Ordered gates

Run in this order. Stop on first failure. Fix or hand back; do not reorder.

| Order | Gate | When | Typical command |
|------:|------|------|-----------------|
| 1 | Migration drift | Schema or migration files in the diff | App’s migrate/check script (for example `bun run db:check` or `bun run drizzle-kit check`). If the app has no database, skip and say so. |
| 2 | Format / lint | Always when code or configs changed | `bun run format` / `bun run lint` (use the scripts this app defines) |
| 3 | Scoped typecheck | TypeScript or typed configs in the diff | Package or root `bun run typecheck` scoped to touched packages when possible |
| 4 | Scoped tests | Logic, UI, or tests in the diff | `bun test` or package test script limited to affected tests |
| 5 | Conditional build | Diff needs a build artifact or the app’s Validation table requires it | `bun run build` (or package build). Skip with a one-line reason when not needed. |

Also run checks when the Validation table lists them for commit time. Default seed:

- `bun run checks:structure`

Add conformance or invariant scripts only when this app invented a real rule. Do not invent empty scanners.

Treat a check you did not run as failed for that claim.

Cite `.ai/rules/raptor-milspec.md` if the diff adds parts that do not earn their keep — flag before commit; do not “fix” design in the commit skill.

## Commit steps

1. Confirm all required gates passed. Record command → result.
2. Stage only the files that belong to this change. Do not stage secrets (`.env`, credentials).
3. Draft a short conventional message that states **why**, not a file list.
4. Commit with that message (non-interactive). On Windows PowerShell, pass `-m` with a clear multi-line string if needed.
5. Run `git status` and confirm a clean or expected post-commit state.
6. Report the commit hash and gate summary.

## Report format

```markdown
# Check-and-commit report

- **Commit:** `<hash>` — `<conventional message>`
- **Scope:** <packages/paths>

## Gates
| Gate | Command | Result |
|------|---------|--------|
| Migration drift | `...` | pass / skip (reason) / fail |
| Format/lint | `...` | pass / fail |
| Scoped typecheck | `...` | pass / fail |
| Scoped tests | `...` | pass / fail |
| Build | `...` | pass / skip (reason) / fail |
| Checks (if run) | `...` | pass / fail |

## Not committed
- <secrets or out-of-scope files left unstaged, or "none">
```

## Stop conditions

- Any required gate fails → do not commit. Report the failing command and output.
- Ask First territory in the diff without approval → do not commit.
- Work you can’t prove yet → draft PR flagged for a human; do not pretend gates passed.
