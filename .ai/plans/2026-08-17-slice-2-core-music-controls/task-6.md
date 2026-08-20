# Task 6: Update queue leftover listing and play-while-paused

**Depends on:** 2
**Spec:** `.ai/specs/2026-08-17-slice-2-core-music-controls.md` § `/queue` when idle with leftover upcoming, § play while paused
**Branch:** `slice-2-core-music-controls`
**Lessons:** R1 engine Discord-free; R2 bot → engine; R3 no Java; R4 UX only. Copy `play.ts` / existing `queue.ts`. No `/check-and-commit`. Do not edit `.ai/plans/`.

**Files:**
- Modify: `packages/bot/src/commands/queue.ts` — idle-with-upcoming body
- Modify: `packages/bot/src/commands/queue.test.ts` — leftover listing; no `Now:` when idle
- Modify: `packages/bot/src/commands/play.ts` — only if paused current currently takes the idle `playNow` branch
- Modify: `packages/bot/src/commands/play.test.ts` — play while paused enqueues and stays paused
- Copy from (first example): `packages/bot/src/commands/play.ts`

**Steps:**
1. `executeQueue`: nothing current and upcoming empty → `Nothing is playing and the queue is empty.` Nothing current and upcoming not empty → first line `Nothing is playing.` then the same numbered upcoming list and cap as slice 1 (`N. {title} ({duration})`, max 10, `…and {k} more.`). No `Now:` line. When current is set, keep the slice 1 `Now:` line (title + duration only; no pause marker, no elapsed).
2. `executePlay`: if `currentTrack !== null` (including paused), enqueue and `Queued (#{position}): …`. Do not unpause. Do not `playNow`. Empty args still `Usage: /play <YouTube URL or search words>`.
3. Tests: leftover upcoming listing has no `Now:`; current+upcoming still has `Now:`; play while paused calls enqueue, does not call `playNow` or `unpause`, `isPaused()` stays true.

**Verify:**
```bash
bun test packages/bot/src/commands/queue.test.ts packages/bot/src/commands/play.test.ts
bun run --cwd packages/bot typecheck
```
Expected: tests exit 0 with 0 fail. Typecheck exits 0.

**Out of scope:**
- New command files, `main.ts`, pause marker on `/queue`, live queue edits

**Escape hatches:**
- If `queue.ts` listing format differs from slice 1 (cap 10 / `…and {k} more.`), copy the format that exists — do not invent a third layout.
