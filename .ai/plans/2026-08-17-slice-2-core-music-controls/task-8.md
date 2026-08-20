# Task 8: Add the new command files to the structure check

**Depends on:** 3, 4, 5
**Spec:** `.ai/specs/2026-08-17-slice-2-core-music-controls.md` § Package layout, § Acceptance criteria (no second command-module shape)
**Branch:** `slice-2-core-music-controls`
**Lessons:** Keep the checks baseline empty. No `/check-and-commit`. Do not edit `.ai/plans/`.

**Files:**
- Modify: `packages/checks/configs/structure.ts` — `bot-command-module` requiredFiles
- Copy from (first example): N/A — config list, not UI

**Steps:**
1. Find shape id `bot-command-module` (`match` `packages/bot/src/commands`). Add required files `pause.ts`, `resume.ts`, `nowplaying.ts`, `remove.ts`, `shuffle.ts`, `clear.ts`, `stop.ts`. Keep `play.ts`, `skip.ts`, `queue.ts`.
2. Do not add `np.ts` or `leave.ts`. Do not add a grandfathering baseline entry. Do not change `engine-src` or the R1/R2 scan.

**Verify:**
```bash
bun run checks:structure
```
Expected: prints `[structure] ok` and exits 0.

**Out of scope:**
- New scanners, R3 Java scanner, engine-seam rule changes, command behavior

**Escape hatches:**
- If `bot-command-module` is missing, STOP — slice 1 Task 6 has not landed; do not invent a new shape id.
- If the check fails because a Task 3–5 file is missing, STOP — do not drop that name from requiredFiles.
