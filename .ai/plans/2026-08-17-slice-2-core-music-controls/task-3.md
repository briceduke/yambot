# Task 3: Add pause, resume, and nowplaying commands

**Depends on:** 2
**Spec:** `.ai/specs/2026-08-17-slice-2-core-music-controls.md` § pause, § resume, § nowplaying, § Scene failure modes 1 and 3
**Branch:** `slice-2-core-music-controls`
**Lessons:** R1 engine Discord-free; R2 bot → engine; R3 no Java; R4 UX only. Copy `play.ts`. No `/check-and-commit`. Do not edit `.ai/plans/`.

**Files:**
- Create: `packages/bot/src/commands/pause.ts`
- Create: `packages/bot/src/commands/pause.test.ts`
- Create: `packages/bot/src/commands/resume.ts`
- Create: `packages/bot/src/commands/resume.test.ts`
- Create: `packages/bot/src/commands/nowplaying.ts`
- Create: `packages/bot/src/commands/nowplaying.test.ts`
- Copy from (first example): `packages/bot/src/commands/play.ts`

**Steps:**
1. Copy `play.ts` shape: `*SlashData` + `execute*(ctx, session | undefined)`. No `Interaction` / `Message` imports. No extra helpers file. No `CommandContext` changes.
2. Slash names: `pause`, `resume`, `nowplaying`. No options. Descriptions: `Pause the current track.`, `Resume the paused track.`, `Show the current track and elapsed time.`
3. `executePause`: no session or `currentTrack === null` → `Nothing is playing.` `session.isPaused()` → `Already paused.` Else `session.pause()`, reply `Paused: {title}`.
4. `executeResume`: no current → `Nothing is playing.` Current and not paused → `Nothing is paused.` Else `session.unpause()`, reply `Resumed: {title}`.
5. `executeNowPlaying`: no current → `Nothing is playing.` Else two lines. Elapsed = `formatDuration(Math.floor(session.playbackDurationMs() / 1000))`. Duration = `formatDuration(track.durationSeconds)`. Paused: `Paused: {title} ({elapsed} / {duration})\n<{uri}>`. Else: `Now playing: {title} ({elapsed} / {duration})\n<{uri}>`.
6. Tests with a fake session (no network, no Discord login): success replies; nothing playing for all three; already paused; resume while playing → `Nothing is paused.`; nowplaying paused vs playing vs idle (elapsed formatted, URL wrapped). Assert pause does not call a fake idle/advance hook.

**Verify:**
```bash
bun test packages/bot/src/commands/pause.test.ts packages/bot/src/commands/resume.test.ts packages/bot/src/commands/nowplaying.test.ts
bun run --cwd packages/bot typecheck
```
Expected: tests exit 0 with 0 fail. Typecheck exits 0.

**Out of scope:**
- `main.ts` doors and aliases, `queue.ts` pause marker, embed/thumbnail/progress bar, live-edit now-playing

**Escape hatches:**
- If `play.ts` export names differ from `playSlashData` / `executePlay`, copy the names that exist. If `play.ts` or `format-duration.ts` is missing, STOP.
