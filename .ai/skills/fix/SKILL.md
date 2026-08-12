---
name: fix
description: Minimal bug fix with a red-then-green regression on the same path that reproduced the bug. Use after /root-cause. Does not commit; hand off to /test then /check-and-commit.
disable-model-invocation: true
---

# Fix

Apply the smallest change that fixes the bug. Prove it with a regression that fails first, then passes.

Bug flow: `/root-cause` (done) → **`/fix`** → `/test` → `/check-and-commit`.

## When to use

- You have a root-cause brief (or equal evidence) and the user wants the fix.
- Do not use this for new features. Use the feature pipeline instead.

## Hard rules

- Minimal change only. Do not refactor neighbors unless the fix requires it.
- Red → green on the **same path** that reproduced the bug (same test, command, or check).
- Do not commit. `/check-and-commit` is the only committing skill.
- Follow this app’s constitution in `AGENTS.md`. Do not add Carbon ERP patterns.
- Use bun for package scripts. Do not use pnpm.
- If the root cause is unverifiable, stop and ask. Do not guess a large patch.

## Steps

1. Read the root-cause brief, `AGENTS.md`, and relevant `.ai/lessons.md` entries
   (by tag if the brief names them; otherwise skim for this surface — do not
   treat “read the whole file” as mandatory for a 1–2 file fix).
2. Confirm reproduction still fails (or recreate the failing state).
3. Add or extend a regression that fails for the right reason on that path. Run it. It must be red.
4. Apply the minimal fix.
5. Run the same regression. It must be green.
6. Run nearby scoped checks if the change touches types or shared modules (for example `bun run` typecheck/tests for the affected package). Do not run the full commit gate here.
7. Summarize what changed and what still needs `/test` and `/check-and-commit`.

## Report format

```markdown
# Fix report

- **Bug:** <title>
- **Cause (from brief):** <one sentence>
- **Change:** <files and what you did>

## Red → green
- **Regression:** `<command or test>`
- **Before:** FAIL — <short reason>
- **After:** PASS — <short proof>

## Out of scope left alone
- <list>

## Next
- Run `/test`, then `/check-and-commit`.
```

## Stop conditions

- Stop if the red regression cannot be written without new product decisions. Ask first.
- Stop if the fix needs Ask First territory (FROZEN surfaces, auth, scoping model). Do not bypass.
- Do not commit from this skill.
