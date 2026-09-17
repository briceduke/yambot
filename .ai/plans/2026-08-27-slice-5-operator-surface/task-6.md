# Task 6: Grow structure check, README, env example, First examples

**Depends on:** Task 4
**Spec:** `.ai/specs/2026-08-27-slice-5-operator-surface.md` § Package layout
**Branch:** `cursor/slice-5-operator-surface-8944`
**Lessons:** No grandfathering baseline. No `/check-and-commit`. Do not edit `.ai/plans/`.

**Files:**
- Modify: `packages/checks/configs/structure.ts`
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `AGENTS.md`

**Steps:**
1. Require `operator-config.ts` in bot-src. Require `help.ts`, `settings.ts`, `setdj.ts`, `prefix.ts`, `settc.ts`, `setvc.ts` in bot-command-module. Do not drop names.
2. README: new commands, mention-as-prefix, env knobs, overlay dies on restart, unset DJ stays open.
3. `.env.example`: `COMMAND_PREFIX`, `DJ_ROLE_ID`, `STAY_IN_CHANNEL`, `ALONE_TIME_UNTIL_STOP`, `IDLE_LEAVE_SECONDS`.
4. AGENTS.md First examples: Guild operator config → `packages/bot/src/operator-config.ts`.

**Verify:**
```bash
bun run checks:structure
```
Expected: `[structure] ok` exit 0.

**Out of scope:** command behavior, new scanners
**Escape hatches:** If a required command file is missing, STOP — do not drop the required name.
