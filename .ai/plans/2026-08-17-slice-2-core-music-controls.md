# Slice 2 core music controls — implementation plan

**Spec:** `.ai/specs/2026-08-17-slice-2-core-music-controls.md`
**Research:** `.ai/research/discord-and-youtube-platform.md`
**Branch:** `slice-2-core-music-controls`
**Status:** approved
**Ordering:** shared foundation required — `TrackQueue` methods and session pause/leave block every command module. After that, command files are slice-first and disjoint.
**Lessons:** `engine-seam`, `product`, `process`

Worker digest (do not read `.ai/lessons.md`):
- R1: `packages/audio-engine` never imports Discord. R2: bot → engine only. R3: no Java/JVM/Lavalink/lavaplayer. R4: UX parity, do not copy JMusicBot internals.
- Copy `packages/bot/src/commands/play.ts`. Do not mint a second command-module shape. Prefix aliases live in the dispatch table; do not add `np.ts` or `leave.ts`.
- No engine Player. No pause field on `TrackQueue`. No new packages or production dependencies. No ffmpeg/opus/sodium.
- Idle leave (nothing playing, 5 minutes) is not the alone-timer (nobody else in the channel). Alone-timer stays out.
- Proof trichotomy: live pause/resume/leave/elapsed is unverifiable in CI. Workers never edit `.ai/plans/`. Commit only through parent `/check-and-commit`.

## Raptor check (readonly, 2026-08-17; idle-leave addendum 2026-08-19)

Read `.ai/rules/raptor-milspec.md` against this spec. Rejected as extra parts: engine Player, pause flag on `TrackQueue`, RNG injection on shuffle, extra command files for `np`/`leave`, new `CommandContext` fields, ffmpeg/volume path, live now-playing editor, alone-timer (`VoiceStateUpdate` membership listener), extra packages. Kept: three pure `TrackQueue` methods, `VoicePort` pause/unpause/elapsed/destroy, one leave helper, one idle-leave `setTimeout` behind injectable `scheduleIdleLeave`, one file per command, prefix alias map in the existing dispatch table.

## Progress

- [x] Task 1: Add TrackQueue removeAt, shuffle, and clear
- [x] Task 2: Add session pause, leave helper, and idle leave
- [x] Task 3: Add pause, resume, and nowplaying commands
- [x] Task 4: Add remove, shuffle, and clear commands
- [x] Task 5: Add the stop command
- [x] Task 6: Update queue leftover listing and play-while-paused
- [x] Task 7: Wire aliases, slash registration, and README names
- [x] Task 8: Add the new command files to the structure check
- [x] Task 9: Final scoped proof

## Parallel groups

### Group A
**Depends on:** none
**Tasks:** 1
**Files disjoint:** n/a (single task)
**Workers:** parent agent

### Group B
**Depends on:** Group A
**Tasks:** 2
**Files disjoint:** n/a (single task)
**Workers:** parent agent

### Group C
**Depends on:** Group B
**Tasks:** 3, 4, 5, 6
**Files disjoint:** yes
**Workers:** fan out one subagent per task (cards: `.ai/plans/2026-08-17-slice-2-core-music-controls/task-{N}.md`)

### Group D
**Depends on:** Tasks 3, 4, 5 (not Task 6)
**Tasks:** 7, 8
**Files disjoint:** yes
**Workers:** fan out one subagent per task (cards: `task-7.md`, `task-8.md`)

### Group E
**Depends on:** Tasks 6, 7, 8
**Tasks:** 9
**Files disjoint:** n/a (single task)
**Workers:** parent agent

## Dependencies

Task 1 blocks Task 2 (`TrackQueue.clear` is what stop uses so idle cannot play leftovers). Task 2 blocks Tasks 3–6 (session pause/leave/idle). Tasks 3–6 own disjoint files and run together. Tasks 7–8 need the new command modules on disk (3–5), not the queue listing change. Task 9 is final proof.

## Global out of scope

- Volume, seek, lyrics, search picker, `repeat`, `playnext`, `move`, `skipto`
- Reconnect-with-position after a voice drop (slice 1 drop behavior stands)
- Live-updating now-playing message, channel topic, `settc`
- Requester-only remove/shuffle, DJ roles, alone-timer (`VoiceStateUpdate`), `stayinchannel` / idle-leave duration config
- New source sites, playlists-as-sources, persistence, extra workspace packages
- ffmpeg, opus encoder, volume transformer, sodium, dotenv
- Java, JVM, Lavalink, lavaplayer
- Web dashboard, SaaS, remote player protocol, public engine release
- A second command-module shape; extra files for prefix aliases

## Global escape hatches

- If `packages/bot/src/commands/play.ts`, `packages/bot/src/guild-music-session.ts`, `packages/bot/src/main.ts`, or `packages/bot/src/format-duration.ts` is missing, STOP — slice 1 is not far enough to copy.
- If a task would add a production dependency, a new workspace package, an engine Player, or a Discord import inside `packages/audio-engine`, STOP and report.
- If `bun add` pulls a Java/JVM package, STOP and report.
- If a task must edit a file owned by another in-flight task, STOP — do not merge by guess.
- If `AudioPlayer.pause` / `unpause` / `playbackDuration` are missing from the installed `@discordjs/voice` types, STOP — do not add a decoder or an elapsed clock.

## Proof (automated vs unverifiable)

Automated (Task 9 plus per-task Verify): `bun run checks`, `bun run typecheck`, `bun test packages/audio-engine`, `bun test packages/bot`.

Unverifiable in CI (human smoke in the spec § Proof plan, steps 0–14): audible pause/resume of the same track; `playbackDuration` advancing and freezing while paused; the bot leaving voice on `stop` and when idle-leave fires in a real guild; drop-while-paused keeping leftover upcoming; slash names appearing (`/np` and `/leave` must not); prefix `!np` / `!leave`. Do not wait 5 minutes in smoke. Ship stays a draft PR until that script passes. Do not mark the slice green without it.

---

## Task 1: Add TrackQueue removeAt, shuffle, and clear

**Depends on:** none
**Spec:** `.ai/specs/2026-08-17-slice-2-core-music-controls.md` § Seam additions (engine), § Acceptance criteria (`TrackQueue` tests)
**Files:**
- Modify: `packages/audio-engine/src/track-queue.ts` — add `removeAt`, `shuffle`, `clear`
- Modify: `packages/audio-engine/src/track-queue.test.ts` — tests listed in Verify
- Copy from (first example): N/A — not UI; extend the existing `TrackQueue` class in place

**Steps:**
1. Keep the class Discord-free and I/O-free. Do not add a pause field. Do not add a Player class. Do not change `packages/audio-engine/src/index.ts` (class is already exported).
2. `removeAt(index: number): Track | null` — 0-based. If `index < 0` or `index >= size`, return `null` and leave the list unchanged. Else `splice` that index, return the removed track, shift the rest.
3. `shuffle(): void` — Fisher-Yates in place on `#tracks`. Size and membership stay the same. No RNG argument. Size 0 and 1 are no-ops.
4. `clear(): void` — drop every upcoming track (`#tracks.length = 0`).
5. JSDoc `@param` / `@returns` on the three methods, same style as `enqueue`.
6. Tests in `track-queue.test.ts` (reuse `sampleTrack`; no network): existing FIFO test still passes; `removeAt(1)` on `[a,b,c]` returns `b` and list is `[a,c]`; `removeAt(-1)`, `removeAt(5)` on size 2, and `removeAt(0)` on empty return `null` and leave the list unchanged; `shuffle` on three tracks keeps `size === 3` and the same three titles (do not assert a new order); `shuffle` on empty and on one track does not throw; `clear` empties then `enqueue` still works.

**Verify:**
```bash
bun test packages/audio-engine/src/track-queue.test.ts
bun run --cwd packages/audio-engine typecheck
```
Expected: tests exit 0 with 0 fail. Typecheck exits 0. `packages/audio-engine/src` has no new `player.ts` and no Discord import.

**Out of scope:**
- `packages/bot/**`, `youtube.ts`, `track.ts`, new engine exports, seeded shuffle

**Escape hatches:**
- If `TrackQueue` in `track-queue.ts` is missing or no longer a class with `#tracks`, STOP and report — do not invent a second queue type.

---

## Task 2: Add session pause, leave helper, and idle leave

**Depends on:** 1
**Spec:** `.ai/specs/2026-08-17-slice-2-core-music-controls.md` § Bot session additions, § Advance loop, § Voice drop (pause addendum)
**Files:**
- Modify: `packages/bot/src/guild-music-session.ts` — `VoicePort` + leave helper + idle leave + pause/elapsed wrappers
- Modify: `packages/bot/src/guild-music-session.test.ts` — replace empty-queue-stay tests; add pause/leave/idle-leave/drop cases
- Modify: `packages/bot/src/discord-voice.ts` — map `AudioPlayer.pause` / `unpause`, Idle-only advance, `playbackDuration`, connection destroy
- Copy from (first example): N/A — not a command module; extend the slice 1 session and `VoicePort`

**Steps:**
1. Extend `VoicePort` with `pause(): boolean`, `unpause(): boolean`, `isPaused(): boolean`, `playbackDurationMs(): number`, `destroy(): void`. Keep existing join/play/stop/idle/disconnect methods.
2. In `discord-voice.ts`: `pause` → `AudioPlayer.pause()`; `unpause` → `unpause()`; `isPaused` true only when `player.state.status === AudioPlayerStatus.Paused`; `playbackDurationMs` reads `playbackDuration` from Playing or Paused state, else `0`; `destroy` destroys the voice connection. Call the idle handler only on `AudioPlayerStatus.Idle`, never on `Paused`.
3. Export `IDLE_LEAVE_AFTER_MS = 300_000`. Export `dropSession(guildId: string): void`. Cancel any idle-leave callback, delete the map entry first, then `stop()` and `destroy()` the voice port if a session was present. Idempotent when already gone. Next `play` uses `createSession`.
4. Extend `CreateSessionInput` with optional `scheduleIdleLeave?: (callback: () => void, delayMs: number) => () => void` (return value cancels). Default implementation: `setTimeout` / `clearTimeout`. Tests pass a fake: store the callback, return a cancel that clears it. Do not sleep 5 minutes.
5. Idle handler: if `getSession(guildId)` is undefined, return. Dequeue next. If a track, cancel idle leave, open and play, announce `Now playing: {title} ({duration})`. Mid-queue open failure still announces `Skipping {title}: couldn't play it` and continues. If none and `getChannelId() !== null`, schedule idle leave for `IDLE_LEAVE_AFTER_MS` (no extra message). If none and not in voice, do not schedule.
6. `playNow` cancels any scheduled idle leave before playing. `onDisconnected`: if `getSession` is undefined, return. Else keep slice 1 drop behavior: stop playback, drop current (including paused current), keep upcoming, keep the session. Cancel idle leave. Do not `dropSession`. Do not schedule idle leave.
7. Session wrappers used by commands: `isPaused()`, `playbackDurationMs()`, `pause()` / `unpause()` (delegate to voice), `hasVoiceConnection(): boolean` (`getChannelId() !== null`), `removeUpcomingAt(index: number): Track | null`, `shuffleUpcoming(): void`, `clearUpcoming(): number` (size before `queue.clear()`), `stopPlayer(): void` (`voice.stop()` only). Paused is not idle: `currentTrack` stays set; `isOccupiedInOtherChannel` stays true while paused.
8. Tests with fakes (no Discord login, no network). Fake `stop()` must call the idle handler synchronously. Fake `pause()` must not. Cover: pause does not advance; skip while paused starts the next track playing (`isPaused() === false`); last-track skip / natural idle / last dead-open schedule idle leave (session still present, no extra message) and firing the fake callback drops the session; `playNow` after schedule cancels so fire is a no-op; `dropSession` while a track is current leaves now (no wait); `clearUpcoming` / `pause` while current do not drop; voice-drop while paused drops current, keeps upcoming, keeps the session, does not schedule idle leave.

**Verify:**
```bash
bun test packages/bot/src/guild-music-session.test.ts
bun run --cwd packages/bot typecheck
```
Expected: tests exit 0 with 0 fail. Typecheck exits 0. No test still expects forever-stay on an empty queue, and no test drops the session on last-track idle without firing the injected schedule.

**Out of scope:**
- `packages/bot/src/commands/*`, `main.ts`, `register-commands.ts`, engine Player, alone-timer, reconnect-with-position

**Escape hatches:**
- If `VoicePort` or `getSession` / `createSession` names differ from slice 1, extend the names that exist — do not invent a second session type. If the session file is missing, STOP.
- If `AudioPlayerStatus.AutoPaused` makes `/resume` need a behavior change, STOP and report — do not add an alone-timer.

---

## Task 3: Add pause, resume, and nowplaying commands

**Depends on:** 2
**Spec:** `.ai/specs/2026-08-17-slice-2-core-music-controls.md` § pause, § resume, § nowplaying, § Scene failure modes 1 and 3
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
2. Slash names: `pause`, `resume`, `nowplaying`. No options. Descriptions one sentence each (`Pause the current track.`, `Resume the paused track.`, `Show the current track and elapsed time.`).
3. `executePause`: no session or `currentTrack === null` → `Nothing is playing.` `session.isPaused()` → `Already paused.` Else `session.pause()`, reply `Paused: {title}`.
4. `executeResume`: no current → `Nothing is playing.` Current and not paused → `Nothing is paused.` Else `session.unpause()`, reply `Resumed: {title}`.
5. `executeNowPlaying`: no current → `Nothing is playing.` Else two lines. Elapsed = `formatDuration(Math.floor(session.playbackDurationMs() / 1000))`. Duration = `formatDuration(track.durationSeconds)`. Paused body: `Paused: {title} ({elapsed} / {duration})\n<{uri}>`. Else: `Now playing: {title} ({elapsed} / {duration})\n<{uri}>`.
6. Tests with a fake session (no network, no Discord login): the three success replies; nothing playing for all three; already paused; resume while playing → `Nothing is paused.`; nowplaying paused vs playing vs idle (elapsed formatted, URL wrapped in `<>`). Assert pause does not call a fake idle/advance hook.

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

---

## Task 4: Add remove, shuffle, and clear commands

**Depends on:** 2
**Spec:** `.ai/specs/2026-08-17-slice-2-core-music-controls.md` § remove, § shuffle, § clear
**Files:**
- Create: `packages/bot/src/commands/remove.ts`
- Create: `packages/bot/src/commands/remove.test.ts`
- Create: `packages/bot/src/commands/shuffle.ts`
- Create: `packages/bot/src/commands/shuffle.test.ts`
- Create: `packages/bot/src/commands/clear.ts`
- Create: `packages/bot/src/commands/clear.test.ts`
- Copy from (first example): `packages/bot/src/commands/play.ts`

**Steps:**
1. Same module shape as `play.ts`. Parse `remove` from `ctx.args` only (doors will stringify the slash integer later). Do not add `CommandContext` fields.
2. `removeSlashData`: name `remove`, required integer option `position`, `setMinValue(1)`. Prefix/body: trim `ctx.args`; if empty or not a whole base-10 integer (`/^-?\d+$/`), reply `Usage: /remove <position>` and do not mutate. Else `n = Number.parseInt`. If `n < 1` or `n > upcoming size` (session missing counts as size 0), reply `No track at position {n}.` Else `removeUpcomingAt(n - 1)`, reply `Removed: {title}`.
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

---

## Task 5: Add the stop command

**Depends on:** 2
**Spec:** `.ai/specs/2026-08-17-slice-2-core-music-controls.md` § stop, § Bot session additions (Stop vs skip vs empty)
**Files:**
- Create: `packages/bot/src/commands/stop.ts`
- Create: `packages/bot/src/commands/stop.test.ts`
- Copy from (first example): `packages/bot/src/commands/play.ts`

**Steps:**
1. Same module shape. Slash name `stop`, no options, description `Stop playback and leave the voice channel.` Do not create `leave.ts`.
2. `executeStop`: no session → `Nothing is playing.` Do not join.
3. Current track: `clearUpcoming()`, then `dropSession(ctx.guildId)`, reply `Stopped.` (map delete first so idle cannot play a leftover or start idle leave).
4. No current, `hasVoiceConnection()` true, upcoming size 0 (idle-leave wait): `dropSession`, reply `Stopped.`
5. Else (leftover upcoming after a drop, or not in voice): `Nothing is playing.` Do not clear, do not drop.
6. Tests: nothing playing (session missing; leftover upcoming and no current — queue unchanged, `dropSession` not called); current-track success replies `Stopped.` only, upcoming empty, session dropped, leftover never played, idle-leave callback never required; idle-wait success (in voice, nothing current, empty queue) replies `Stopped.` and drops.

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

---

## Task 6: Update queue leftover listing and play-while-paused

**Depends on:** 2
**Spec:** `.ai/specs/2026-08-17-slice-2-core-music-controls.md` § `/queue` when idle with leftover upcoming, § play while paused
**Files:**
- Modify: `packages/bot/src/commands/queue.ts` — idle-with-upcoming body
- Modify: `packages/bot/src/commands/queue.test.ts` — leftover listing; no `Now:` when idle
- Modify: `packages/bot/src/commands/play.ts` — only if paused current currently takes the idle `playNow` branch
- Modify: `packages/bot/src/commands/play.test.ts` — play while paused enqueues and stays paused
- Copy from (first example): `packages/bot/src/commands/play.ts` (queue already copied this in slice 1)

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

---

## Task 7: Wire aliases, slash registration, and README names

**Depends on:** 3, 4, 5
**Spec:** `.ai/specs/2026-08-17-slice-2-core-music-controls.md` § Client / platform contract (registration, ACK), § Prefix aliases, § Package layout
**Files:**
- Modify: `packages/bot/src/main.ts` — prefix aliases; slash args for `remove`; dispatch new names
- Modify: `packages/bot/src/register-commands.ts` — bulk PUT includes the seven new slash JSON bodies
- Modify: `packages/bot/src/doors.test.ts` — aliases, remove args, registration names
- Modify: `README.md` — add the new command names and prefix aliases to the operator command list
- Copy from (first example): N/A — wiring, not a command module. Commands already exist at `packages/bot/src/commands/play.ts`

**Steps:**
1. Prefix-only alias map in the existing dispatch table (same file `doors.test.ts` already imports): `np` → `nowplaying`, `leave` → `stop`. Slash door uses `commandName` as-is (no `/np`, no `/leave`).
2. Slash args: `play` still reads option `query`. `remove` reads integer option `position` and sets `ctx.args` to `String(n)` or `""` when missing. Other new commands: `args` is `""`.
3. Dispatch `pause` / `resume` / `nowplaying` / `remove` / `shuffle` / `clear` / `stop` to the Task 3–5 `execute*` functions. Same session rule as skip/queue: `getSession` only; do not `createSession` or rebind announce. Defer slash at receipt; prefix sends a channel message; `allowedMentions: { parse: [] }` on every reply.
4. `registerGuildCommands` bulk-PUTs play, skip, queue, plus the seven new names. `remove` includes required integer `position`. Array must not contain `np` or `leave`.
5. `doors.test.ts`: `!np` and `!leave` call the nowplaying and stop modules; slash names `np` / `leave` are unknown (no dispatch); `remove` with args `"1"` hits `executeRemove`; exported registration names are exactly those 10.
6. README: list `/pause` `/resume` `/nowplaying` `/remove` `/shuffle` `/clear` `/stop` and prefix `!np` / `!leave`. Do not claim `/np` or `/leave` exist. One sentence: after the last track the bot stays 5 minutes, then leaves; `/stop` leaves now.

**Verify:**
```bash
bun test packages/bot/src/doors.test.ts
bun run --cwd packages/bot typecheck
```
Expected: tests exit 0 with 0 fail. Typecheck exits 0. `README.md` contains `nowplaying`, `!np`, and `5 minutes`, and does not document a slash `/np`.

**Out of scope:**
- Global (non-guild) registration, ephemeral replies, Message Content portal prose beyond the existing README

**Escape hatches:**
- If `dispatchCommand` / `registerGuildCommands` names differ from slice 1, extend the names that exist — do not add a second dispatch module. If `main.ts` or `README.md` is missing, STOP.

---

## Task 8: Add the new command files to the structure check

**Depends on:** 3, 4, 5
**Spec:** `.ai/specs/2026-08-17-slice-2-core-music-controls.md` § Package layout, § Acceptance criteria (no second command-module shape)
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

---

## Task 9: Final scoped proof

**Depends on:** 6, 7, 8
**Spec:** `.ai/specs/2026-08-17-slice-2-core-music-controls.md` § Acceptance criteria, § Proof plan
**Files:**
- Modify: none unless a Verify command is red (then fix only the failing package; do not start slice 3)
- Copy from (first example): N/A — proof only

**Steps:**
1. Run the commands in Verify. Record exit codes and the lines that prove each check.
2. Confirm `packages/audio-engine/package.json` still has no Discord or Java dependencies and no new production dependency since slice 1. Confirm `packages/bot/package.json` still depends on `@yambot/audio-engine` and gained no new production dependency.
3. Confirm no `packages/audio-engine/src/player.ts`, no Discord import under `packages/audio-engine`, no `packages/bot/src/commands/np.ts` or `leave.ts`. Confirm `AGENTS.md` First examples still point at slice 1 `play.ts` / `youtube.ts` / `main.ts`.
4. List unverifiable items from the spec § Proof plan. Do not mark them proved. Human smoke steps 0–14 remain the ship gate.

**Verify:**
```bash
bun run checks
bun run --cwd packages/audio-engine typecheck
bun test packages/audio-engine
bun run --cwd packages/bot typecheck
bun test packages/bot
bun run typecheck
```
Expected: `bun run checks` prints `[structure] ok` and `[engine-seam] ok` and exits 0. All typecheck and test commands exit 0 with 0 fail.

**Out of scope:**
- Running the human smoke script unless the user is at the test guild with a token
- Opening a PR, `/execute`, `/judge`

**Escape hatches:**
- If any Verify command is red, STOP and fix or report — do not treat unrun or failed checks as proved.
- If live pause/leave was not heard, the slice is unverifiable, not green.
