# Task 5: Add the stop command

**Depends on:** 2
**Spec:** `.ai/specs/2026-08-17-slice-2-core-music-controls.md` § stop, § Bot session additions (Stop vs skip vs empty)
**Branch:** `slice-2-core-music-controls`
**Lessons:** R1 engine Discord-free; R2 bot → engine; R3 no Java; R4 UX only. Copy `play.ts`. No `/check-and-commit`. Do not edit `.ai/plans/`.

**Files:**
- Create: `packages/bot/src/commands/stop.ts`
- Create: `packages/bot/src/commands/stop.test.ts`
- Copy from (first example): `packages/bot/src/commands/play.ts`

**Steps:**
1. Same module shape. Slash name `stop`, no options, description `Stop playback and leave the voice channel.` Do not create `leave.ts`.
2. `executeStop`: no session → `Nothing is playing.` Do not join.
3. Current track: `clearUpcoming()`, then `dropSession(ctx.guildId)`, reply `Stopped.`
4. No current, `hasVoiceConnection()` true, upcoming size 0: `dropSession`, reply `Stopped.`
5. Else: `Nothing is playing.` Do not clear, do not drop.
6. Tests: session missing; leftover upcoming and no current (queue unchanged); current-track `Stopped.` drops now; idle-wait `Stopped.` drops now.

**Verify:**
```bash
bun test packages/bot/src/commands/stop.test.ts
bun run --cwd packages/bot typecheck
```
Expected: tests exit 0 with 0 fail. Typecheck exits 0.

**Out of scope:**
- Prefix alias `leave` (Task 7), `skip.ts` reply strings, reconnect-with-position

**Escape hatches:**
- If `dropSession`, `clearUpcoming`, or `hasVoiceConnection` is missing, STOP — do not call `skipCurrent` as a stand-in (skip leaves the queue in place).
