# Task 4: Add remove, shuffle, and clear commands

**Depends on:** 2
**Spec:** `.ai/specs/2026-08-17-slice-2-core-music-controls.md` § remove, § shuffle, § clear
**Branch:** `slice-2-core-music-controls`
**Lessons:** R1 engine Discord-free; R2 bot → engine; R3 no Java; R4 UX only. Copy `play.ts`. No `/check-and-commit`. Do not edit `.ai/plans/`.

**Files:**
- Create: `packages/bot/src/commands/remove.ts`
- Create: `packages/bot/src/commands/remove.test.ts`
- Create: `packages/bot/src/commands/shuffle.ts`
- Create: `packages/bot/src/commands/shuffle.test.ts`
- Create: `packages/bot/src/commands/clear.ts`
- Create: `packages/bot/src/commands/clear.test.ts`
- Copy from (first example): `packages/bot/src/commands/play.ts`

**Steps:**
1. Same module shape as `play.ts`. Parse `remove` from `ctx.args` only. Do not add `CommandContext` fields.
2. `removeSlashData`: name `remove`, required integer option `position`, `setMinValue(1)`. Trim `ctx.args`; if empty or not `/^-?\d+$/`, reply `Usage: /remove <position>` and do not mutate. Else `n = Number.parseInt`. If `n < 1` or `n > upcoming size` (session missing = size 0), reply `No track at position {n}.` Else `removeUpcomingAt(n - 1)`, reply `Removed: {title}`.
3. `executeShuffle`: upcoming size 0 (or no session) → `The queue is empty.` Else `shuffleUpcoming()`, reply `Shuffled {n} tracks.` (size 1 still that reply).
4. `executeClear`: upcoming size 0 (or no session) → `The queue is empty.` Else `n = clearUpcoming()`, reply `Cleared {n} tracks.`, then if `currentTrack === null` call `dropSession(ctx.guildId)` (no extra message). While a track is current, do not drop.
5. Tests: remove success; `0`, `99`, empty args, `abc`; shuffle empty vs n tracks; clear empty vs n; clear leftover with no current calls `dropSession`; clear while current does not. Queue unchanged on remove errors.

**Verify:**
```bash
bun test packages/bot/src/commands/remove.test.ts packages/bot/src/commands/shuffle.test.ts packages/bot/src/commands/clear.test.ts
bun run --cwd packages/bot typecheck
```
Expected: tests exit 0 with 0 fail. Typecheck exits 0.

**Out of scope:**
- `queue.ts` listing text, `stop.ts`, requester-only remove, `move` / `skipto`

**Escape hatches:**
- If `removeUpcomingAt` / `shuffleUpcoming` / `clearUpcoming` / `dropSession` are missing after Task 2, STOP — do not reach into a private queue field or invent a second registry.
