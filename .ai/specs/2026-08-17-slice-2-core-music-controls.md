# Slice 2 — Core music controls

**Status:** ready-for-plan
**Research:** `.ai/research/discord-and-youtube-platform.md` (same Discord
surface as slice 1; no new client). Domain research N/A — JMusicBot UX
parity plus the slice 2 grill settle the domain.
**Grill:** `.ai/runs/2026-08-17-grill-slice-2-core-music-controls.md`
(decisions 1–5 carried into this spec).
**Depends on:** `.ai/specs/2026-08-11-slice-1-core-playback.md` (copy those
command modules, doors, session, and seam; do not invent a second layout).

## Problem

Slice 1 proves play, queue, and skip. Everyday control of one playing
session is still missing: pause and resume, now playing, remove, shuffle,
clear, stop/leave, and when the bot leaves voice. This slice adds that
control on the same session and the same zero-transcode seam.

## Goals

- A user in a guild with something playing can pause, inspect now playing
  (elapsed + URL), resume the same track, remove or shuffle upcoming
  tracks, clear upcoming, and stop — on both doors (slash and prefix).
- Leave policy: leave now on `stop`. When nothing is current and the
  upcoming list is empty while the bot is still in voice, wait 5 minutes
  with no extra message, then leave and drop the session. Stay on
  `clear` while a track is current, on `pause`, and when the bot is the
  only one in the voice channel (no alone-timer). Voice drop keeps the
  surviving queue (slice 1 stands).
- `TrackQueue` grows remove, shuffle, and clear. Pause, resume, stop, and
  leave stay on the bot session (`AudioPlayer` + voice connection). No
  engine Player. No new packages. No new production dependencies.
- Empty-queue stay from slice 1 is replaced when this slice ships: the
  bot waits 5 minutes of nothing playing, then leaves and drops the
  session.

## Non-goals

- Volume (needs decode; Discord user volume covers it), seek, lyrics,
  search picker, `repeat`, `playnext`, `move`, `skipto`.
- Reconnect-with-position after a voice drop (slice 1 drop behavior
  stands: next `play` rejoins; the current track is not resumed). Slice 1
  non-goals named reconnect as slice 2 work; this slice does not take it.
- Live-updating now-playing message or channel topic (slice 5 `settc`).
- Requester-only remove/shuffle (no requester field yet).
- New source sites, playlists-as-sources, DJ roles, alone-timer
  (leave because nobody else is in the channel), `stayinchannel` /
  `alonetimeuntilstop` / idle-leave duration config (slice 5). The
  5-minute nothing-playing wait in this slice is a fixed constant, not
  that config.
- ffmpeg, opus encoder, volume transformer, or any other decode path.
- New packages, persistence, or a public engine API change beyond
  `TrackQueue` methods.
- Permanent cuts stand: no dashboard, no SaaS, no JVM, no remote player
  protocol, no public engine release.

## Design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Command inventory | Both doors: `pause`, `resume`, `nowplaying` (prefix alias `np`), `remove <position>`, `shuffle`, `clear`, `stop` (prefix alias `leave`). Empty `play` stays the slice 1 usage reply; resume is its own command. | Named everyday set from the grill; keeps the slice 1 seam. (Grill 1) |
| Leave policy | `stop` / `leave`: wipe current + queue, leave now, reply `Stopped.`, drop the session. Empty queue while still in voice (natural end, skip of last track, last dead track): stay 5 minutes with no extra message, then leave and drop the session. A later `play` in that window cancels the wait. `stop` during the wait leaves now (`Stopped.`). `clear` while something is current, or `pause`: stay (timer does not run). Alone in channel: stay. Voice drop: not a leave (slice 1); do not start the idle-leave timer. | Grill 2 plus 2026-08-19 idle-leave addendum. Alone-timer stays slice 5. Supersedes slice 1 empty-queue stay. |
| Pause model | Paused is not idle; a track is still current. Pause is `AudioPlayer.pause()` on the bot session. Skip while paused starts the next track playing. `play <query>` while paused enqueues and stays paused. | Engine stays resolver + `TrackQueue` + pipe (R1). No engine Player. (Grill 3) |
| Now playing | One-shot plain text with elapsed + URL; no embed, thumbnail, progress bar, requester, or live edit. Pause state lives here, not on `/queue`. Elapsed from `@discordjs/voice` `playbackDuration`. | Fewest parts; URL wrapped in `<>` to suppress unfurl. (Grill 4) |
| Scene | Happy path and three failure modes walked at the grill (see Scene). | Client-touching slice; scene is load-bearing. (Grill 5) |
| Scoping | Same in-memory `Map<guildId, GuildMusicSession>`; one session per guild. Leave drops the map entry. No new store. | Constitution scoping axis; persistence is ask-first. |
| Hard rules | R1: pause/elapsed/leave stay bot-side; engine gains only pure `TrackQueue` methods. R2: bot → engine. R3: zero Java. R4: UX parity; do not copy JMusicBot/lavaplayer internals. | Same scan as slice 1. No Discord types in the engine. |
| Pattern to copy | Slice 1 bot command module (one file per command, thin `CommandContext`) and slice 1 `TrackQueue`. Prefix aliases are a dispatch-table map in `main.ts`, not extra command files. | First examples exist (or are minted) in slice 1; do not invent a second layout. |
| Proof | Typecheck + `bun test packages/audio-engine` + `bun test packages/bot` + named human smoke for voice. Structure check unchanged. | Constitution §5: voice-visible change needs smoke. |
| Frozen surfaces | None. | `BACKWARD_COMPATIBILITY.md` is empty. |
| Ask first | No new production dependencies. No persistence. No package beyond bot / audio-engine / checks. | AGENTS ask-first; pause uses `AudioPlayer` already in slice 1. |
| Symmetric ops | pause↔resume; `play` joins ↔ `stop` (leave now) and idle-leave (leave after 5 minutes of nothing playing); enqueue ↔ `remove` / `clear`. No unshuffle. | Markers are in-memory only (player paused flag, queue contents, session presence, idle-leave timer). |
| Client / platform | Copy slice 1: slash defers at receipt; prefix sends a channel message; guild-scoped bulk PUT grows by the new names; every reply suppresses mentions; all replies public; same invite permissions. | Same Discord surface; platform note already covers ACK, registration, sanitize. |
| Transition | No persisted state to map. Behavior change vs slice 1: last track ending now starts a 5-minute idle-leave wait, then leaves and drops the session. | Operators on slice 1 will see the bot leave five minutes after the queue empties. Rollback is not running this slice. |
| Unverifiable | Audible pause/resume, elapsed clock, real leave, drop-while-paused, 5-minute wall-clock idle leave. Named smoke script below. | CI has no Discord voice. Do not wait 5 minutes in smoke. |
| Zero-transcode seam | Unchanged `{ stream, format }` with `webm/opus` only. | Volume/seek would break this; they stay out. |
| `remove` index | 1-based position in the upcoming list (the numbers `/queue` already shows). Current is not removable this way (use `skip`). Engine method is 0-based. | Matches slice 1 `/queue` listing. (Grill 2, settled not asked) |
| Anyone may invoke | Same as slice 1 `skip` until slice 5. Invoker need not be in voice. | DJ gate is slice 5. |
| Raptor refuse | No engine Player, no pause flag on `TrackQueue`, no ffmpeg/volume path, no live now-playing editor, no alone-timer (voice-state listener), no extra packages. Idle-leave is one `setTimeout` behind an injectable schedule, not a second player. | Alone-timer watches membership. Idle-leave watches nothing playing. |

## Behavior

Copy slice 1 unless this section replaces it. `play` / `skip` / `/queue`
`Now:` line / voice-drop reconnect / hybrid doors / mention suppress /
registration shape stay as slice 1, with the replacements called out
below.

### Seam additions (engine)

`Track`, `TrackAudio`, `resolveTrack`, `openTrackAudio`, and the closed
format list do not change. `TrackQueue` grows three pure methods:

```typescript
/** Per-guild FIFO of tracks waiting to play. Pure state; no I/O. */
export class TrackQueue {
  enqueue(track: Track): void;
  dequeueNext(): Track | null;
  list(): readonly Track[];
  get size(): number;
  /** 0-based. Returns the removed track, or null if the index is out of range. */
  removeAt(index: number): Track | null;
  /** Reorder upcoming tracks in place. Size and membership stay the same. */
  shuffle(): void;
  /** Drop every upcoming track. */
  clear(): void;
}
```

No engine Player. No pause field on `TrackQueue`. No Discord types (R1).

The command module still consumes slice 1 `CommandContext`. `remove`
parses `args` (prefix remainder) or the slash integer option; do not add
fields to `CommandContext`.

Prefix aliases live in the dispatch table only: `np` → `nowplaying`,
`leave` → `stop`. Slash names are the canonical set (`/nowplaying`,
`/stop`). Do not add extra command files for aliases.

### Bot session additions

`GuildMusicSession` still holds the engine `TrackQueue`, current track,
voice connection, audio player, and announce channel id.

- **Paused ≠ idle.** `AudioPlayer.pause()` / `unpause()`. The idle
  (advance) handler runs only on Idle — not on Paused. A paused track
  stays current.
- **Elapsed** for `nowplaying` is `playbackDuration` on the bot audio
  player (milliseconds), formatted with the slice 1 duration helper
  (`m:ss`, or `h:mm:ss` at one hour and over). If smoke shows elapsed
  stuck at `0:00`, flag it — do not add a decoder.
- **Leave helper** (one function): cancel any idle-leave timer, destroy
  the voice connection, stop the player, delete the guild entry from the
  session map. Idempotent if already gone. Next `play` creates a fresh
  session.
- **Idle leave:** export `IDLE_LEAVE_AFTER_MS = 300_000` (5 minutes) from
  `guild-music-session.ts`. When the bot is still in voice, nothing is
  current, and upcoming is empty, schedule the leave helper after that
  delay. No extra message when it fires. Cancel the timer on `playNow`
  and on `dropSession`. Do not schedule when not in voice (voice drop).
  Paused is not idle, so pause does not start the timer. Tests inject
  `scheduleIdleLeave` on `createSession`; do not sleep 5 minutes in CI.
- **Stop vs skip vs empty:** `skip` stops the player and leaves the
  queue in place so idle advances. `stop` while a track is current:
  clear the queue, then `dropSession` (delete the map entry first so
  idle cannot schedule a wait or play a leftover), then reply
  `Stopped.` Natural end and last-track skip take the idle empty path
  (schedule idle leave, no extra message). `stop` during the idle-leave
  wait (still in voice, nothing current, upcoming empty) leaves now and
  replies `Stopped.`

### Advance loop (replaces slice 1 empty-queue stay)

On player Idle:

1. If the session is already gone, return.
2. Dequeue next. If a track is returned, cancel any idle-leave timer,
  open audio and play; announce `Now playing: {title} ({duration})` in
  the announce channel (slice 1 string; not the `nowplaying` command
  body). Mid-queue open failure still announces
  `Skipping {title}: couldn't play it` and continues.
3. If none: if still in voice, schedule idle leave (`IDLE_LEAVE_AFTER_MS`).
  If not in voice, do not schedule (voice-drop leftover path). No extra
  message.

Skip of the last track still replies `Skipped: {title}` first; the
idle-leave wait has no second message.

### Voice drop (slice 1 stands; pause addendum)

Connection destroyed → playback stops, current track is dropped
(including a paused current), the in-memory queue survives, the session
is kept. This is not a leave. Next `play` rejoins, plays the new track
first, then the surviving queue. A drop never clears the queue and
never resumes the paused track.

After a drop the bot is idle (nothing current) with possible leftover
upcoming tracks. Do not start the idle-leave timer (the bot is not in
voice). `/pause`, `/resume`, `/nowplaying` reply `Nothing is playing.`
and do not join, leave, or wipe. `/stop` with leftover upcoming is the
same (`Nothing is playing.`). `/clear`, `/remove`, `/shuffle`, and
`/queue` still operate on that leftover upcoming list. `/clear` that empties the leftover list drops the
session (empty queue, nothing current) with no extra leave message.

### `/queue` when idle with leftover upcoming

Slice 1 empty message stays when nothing is current **and** the queue
is empty: `Nothing is playing and the queue is empty.`

When nothing is current and the queue is not empty (voice drop, or any
idle leftover), reply `Nothing is playing.` then the same numbered
upcoming list and cap as slice 1. No `Now:` line — nothing is current.
Those numbers are what `/remove` uses.

When a track is current, the `Now:` line is unchanged from slice 1
(title + duration, no pause marker, no elapsed). Pause state is on
`nowplaying` only.

### play while paused

Same join and resolve rules as slice 1. If a track is current and
paused: enqueue, reply `Queued (#{queue.size + 1}): {title} ({duration})`,
do not unpause, do not replace the current track. Empty args still
reply `Usage: /play <YouTube URL or search words>`.

### pause

- No current track → `Nothing is playing.`
- Already paused → `Already paused.`
- Else pause the player, reply `Paused: {title}`. Stay in voice.

### resume

- No current track → `Nothing is playing.`
- Current and not paused → `Nothing is paused.`
- Else unpause, reply `Resumed: {title}`.

### nowplaying

One reply, mentions suppressed. Angle brackets around the URL suppress
Discord unfurl.

- No current track → `Nothing is playing.`
- Paused:

  ```text
  Paused: {title} ({elapsed} / {duration})
  <{uri}>
  ```

- Else (current, not paused):

  ```text
  Now playing: {title} ({elapsed} / {duration})
  <{uri}>
  ```

### remove

Slash: required integer option `position` (min 1). Prefix: remainder
parsed as a base-10 integer.

- Missing or not an integer → `Usage: /remove <position>`. Queue
  unchanged.
- Integer `n` < 1 or `n` > upcoming size (including `0` and a too-large
  `n`) → `No track at position {n}.` Queue unchanged. Current is never
  position `n` here; use `skip`.
- Else `removeAt(n - 1)`, reply `Removed: {title}`.

### shuffle

Reorders upcoming only. Current (playing or paused) does not move.

- Upcoming size 0 → `The queue is empty.`
- Else shuffle in place, reply `Shuffled {n} tracks.` (`n` is upcoming
  size; size 1 is a no-op order and still that reply).

### clear

Wipes upcoming only. Current keeps playing or stays paused. Stay in
voice when something is current.

- Upcoming size 0 → `The queue is empty.`
- Else clear, reply `Cleared {n} tracks.`

If nothing is current and clear empties leftover upcoming, drop the
session after the reply (same leave helper; not in voice, so this is
only a map delete). No extra message.

### stop (prefix `leave` as well)

- No session → `Nothing is playing.` No join, no leave.
- Current track: clear upcoming, `dropSession`, reply `Stopped.` No
  second message. Idle must not play a leftover and must not start the
  5-minute wait (`dropSession` deletes the map entry first).
- No current track, still in voice, upcoming empty (idle-leave wait):
  `dropSession`, reply `Stopped.`
- No current track and leftover upcoming (voice drop): `Nothing is
  playing.` No join, no leave, queue unchanged (`/clear` wipes leftovers).

### Package layout (adds to slice 1)

```text
packages/audio-engine/src/
  track-queue.ts       removeAt, shuffle, clear added
packages/bot/src/
  main.ts                 dispatch aliases np → nowplaying, leave → stop;
                          guild bulk PUT includes the new names
  commands/pause.ts
  commands/resume.ts
  commands/nowplaying.ts
  commands/remove.ts
  commands/shuffle.ts
  commands/clear.ts
  commands/stop.ts
  guild-music-session.ts  pause / resume / stop / leave helper;
                          idle empty path schedules 5-minute leave
```

No new packages. No new production dependencies.

## Scene

Happy path: a user is in voice with a track playing and two more queued.
`/pause` replies `Paused: {title}` and audio stops. `/nowplaying` shows
`Paused: {title} ({elapsed} / {duration})` plus the wrapped URL.
`/resume` continues the same track (`Resumed: {title}`). `/remove 1`
drops the next upcoming track (`Removed: {title}`). `/shuffle` reorders
the rest. `/clear` wipes upcoming; current keeps playing. A later
`/play` queues again. Last track ends (or `/skip` of the last track) →
bot stays in voice with no extra message. A later `/play` in that window
starts the new track (timer cancelled). If nothing is queued for 5
minutes, the bot leaves with no extra message. `/stop` mid-song replies
`Stopped.`, queue is gone, bot leaves now. Next `/play` joins fresh.

Prefix aliases: `!np` → nowplaying, `!leave` → stop. Slash names stay
the canonical set.

Failure modes:

1. Nothing playing (no session, or after a leave): `/pause`, `/resume`,
   `/nowplaying` → `Nothing is playing.` No join, no leave. `/stop` with
   leftover upcoming after a drop is the same. `/stop` during the
   idle-leave wait (still in voice, empty queue) leaves now (`Stopped.`).
2. `/remove 0`, `/remove 99`, or `/remove` with no number → error reply
   (`No track at position {n}.` or `Usage: /remove <position>`); queue
   unchanged. Current is not removable this way (use skip).
3. `/pause` while already paused → `Already paused.` `/resume` while
   playing → `Nothing is paused.` Audio does not change.

If Discord voice drops (including mid-pause): playback stops, current is
dropped, the in-memory queue survives, session is kept (not a leave).
Next `/play` rejoins, plays the new track first, then the surviving
queue. A drop never clears the queue and never resumes the paused track.

## Client / platform contract

- **ACK timing:** slash door defers at receipt (3 s window; resolve is
  fast for these commands, but one door keeps one rule). Prefix replies
  are plain channel messages. All replies are public; no ephemeral
  replies.
- **Registration:** guild-scoped bulk PUT on `ready` and `guildCreate`,
  now including `pause`, `resume`, `nowplaying`, `remove` (integer
  option `position`), `shuffle`, `clear`, `stop`. Same-name PUT stays
  idempotent. No `/np` or `/leave` slash commands.
- **Naming and sanitize:** Discord slash names lowercase. Every reply
  suppresses all mentions (titles remain untrusted). `nowplaying` wraps
  the URL in `<>` so Discord does not unfurl. Queue listing cap of 10
  + `…and {k} more.` unchanged.
- **Permissions:** same invite as slice 1 (`bot` +
  `applications.commands`; View Channel, Send Messages, Connect,
  Speak). Stop/leave needs no extra permission.
- **Rate limits:** no custom handling; `discord.js` queues REST. Reply
  volume stays small.
- **Ledger-vs-reply-vs-mirror order:** N/A — no ledger and no mirror;
  in-memory state plus the reply is the only user surface.
- **Symmetric ops:** pause↔resume as Behavior. join↔leave: `play` joins
  (or moves when idle); `stop` leaves now; empty-queue idle leave waits
  5 minutes then leaves; voice drop is not a leave. enqueue↔remove/clear:
  `play` enqueues; `remove` drops one upcoming; `clear` drops all
  upcoming; current is not in that list. slash↔prefix: same modules,
  same reply strings; aliases prefix-only.

## Transition plan

No persisted users, queues, or config. Nothing to map; nothing to keep
across process restart (in-memory as slice 1).

Behavior vs a running slice 1 bot: when the last track ends, the bot
stays 5 minutes then leaves, and the next `play` after that leave starts
a new session. Pause/resume/now playing/remove/shuffle/clear/stop did
not exist.

Rollback: run the slice 1 build. No data migration to undo.

## Acceptance criteria

- [ ] `TrackQueue` has `removeAt`, `shuffle`, and `clear`; existing FIFO
      behavior still holds. No Discord import in `packages/audio-engine`
      (R1 scan still passes). No engine Player class.
- [ ] `bun run typecheck` passes workspace-wide.
- [ ] `bun test packages/audio-engine` passes and covers: `removeAt`
      returns the track and shifts the rest; out-of-range returns null
      and leaves the list unchanged; `shuffle` keeps size and membership;
      `clear` empties the list; FIFO enqueue/dequeue still works —
      no network.
- [ ] `bun test packages/bot` passes and covers, against a fake
      session/engine (no network, no Discord login):
      - each new command's success replies and the three scene failure
        modes (and `resume` while playing → `Nothing is paused.`)
      - prefix aliases `np` and `leave` dispatch the same modules
      - pause does not fire the idle/advance path
      - `play` while paused enqueues and stays paused
      - skip while paused starts the next track (playing)
      - skip/natural-end/dead-open of the last track schedules idle leave
        (session still present; no extra message). Firing the injected
        schedule drops the session. `playNow` cancels the wait.
      - `stop` while a track is current clears upcoming, replies
        `Stopped.`, and leaves now (no 5-minute wait)
      - `stop` during the idle-leave wait (in voice, nothing current,
        empty queue) replies `Stopped.` and leaves now
      - `clear` / `pause` do not leave while a track is current
      - idle leave does not run on voice drop (leftover upcoming kept)
      - `nowplaying` playing vs paused vs idle bodies (elapsed formatted,
        URL wrapped)
      - `/queue` idle-with-upcoming has no `Now:` line and numbers the
        leftover list
- [ ] Guild-scoped registration PUT includes the seven new slash names;
      `remove` has required integer option `position`.
- [ ] No new workspace packages; no new production dependencies; R3
      still holds (judge review).
- [ ] The named human smoke script below passes in the test guild.
- [ ] Slice 1 first-example paths remain the copy target; this slice
      does not mint a second command-module shape.

## Open questions

Settled at the grill (2026-08-17 — details in the run file):

- [x] Command inventory — **Answer:** named everyday set above; volume,
      seek, lyrics, picker, reconnect-with-position, repeat/playnext/
      move/skipto, live now-playing out. Empty `play` is not resume
      (grill decision 1).
- [x] Leave policy — **Answer:** leave now on `stop`; empty queue while
      in voice waits 5 minutes then leaves; stay on `clear` (while
      current), `pause`, and alone; voice drop is not a leave; leave
      drops the session (grill decision 2, idle-leave addendum
      2026-08-19).
- [x] Pause vs idle vs skip — **Answer:** paused is not idle; skip
      starts the next track playing; `play` while paused enqueues and
      stays paused (grill decision 3).
- [x] Now playing shape — **Answer:** one-shot plain text, elapsed +
      duration + wrapped URL; pause label on this command only (grill
      decision 4).
- [x] Scene and failure modes — **Answer:** walked and confirmed (grill
      decision 5).

Settled while writing this spec (design details; none in ask-first
territory):

- [x] Engine vs bot for pause — **Answer:** `AudioPlayer.pause()` on
      the bot session; `TrackQueue` stays pure upcoming state.
- [x] `removeAt` indexing — **Answer:** command is 1-based upcoming
      (matches `/queue`); engine method is 0-based.
- [x] Prefix aliases — **Answer:** dispatch table in `main.ts`; no
      extra command files; no slash aliases.
- [x] `CommandContext` — **Answer:** unchanged; `remove` parses `args`
      / the slash option in the command file.
- [x] Stop vs idle ordering — **Answer:** `stop` while current clears
      upcoming then `dropSession` so idle cannot play leftovers or start
      the idle-leave wait; `Stopped.` is the only new message. Empty-queue
      idle schedules leave; it does not drop immediately.
- [x] Idle handler vs Paused — **Answer:** advance runs on Idle only.
- [x] Success replies for remove/shuffle/clear — **Answer:**
      `Removed: {title}`, `Shuffled {n} tracks.`, `Cleared {n} tracks.`;
      empty upcoming for shuffle/clear → `The queue is empty.`
- [x] Remove error replies — **Answer:** missing/non-integer →
      `Usage: /remove <position>`; out of range →
      `No track at position {n}.`
- [x] Invoker voice — **Answer:** not required (same as slice 1 skip /
      queue).
- [x] `/queue` after a drop — **Answer:** `Nothing is playing.` plus
      numbered leftover upcoming; no `Now:` line.
- [x] `/stop` after a drop with leftover upcoming — **Answer:**
      `Nothing is playing.`; queue unchanged; `/clear` wipes leftovers.
- [x] `/stop` during idle-leave wait — **Answer:** still in voice,
      nothing current, upcoming empty → `Stopped.` and leave now.
- [x] Advance announcement vs `nowplaying` — **Answer:** idle still
      announces slice 1 `Now playing: {title} ({duration})`; elapsed
      and URL are command-only.
- [x] Alone-in-channel — **Answer:** no membership listener, no
      `alonetimeuntilstop`; stay while people leave the channel. Idle
      leave is a nothing-playing timeout, not an alone-timer.
- [x] Idle leave duration — **Answer:** 5 minutes (`IDLE_LEAVE_AFTER_MS
      = 300_000`). Fixed this slice. Slice 5 may expose it as config
      next to `stayinchannel` / `alonetimeuntilstop`.
- [x] New dependencies / packages — **Answer:** none.

## Proof plan

Per the constitution §5 ladder:

- Engine queue methods → `bun run typecheck` +
  `bun test packages/audio-engine`.
- Bot command/session wiring → typecheck + `bun test packages/bot`.
- Structure and docs → `bun run checks:structure`.
- Seam rules → existing R1/R2 dependency scan inside `bun run checks`.
- Voice-visible pause/resume/leave/elapsed → mandatory human smoke
  (below).
- Every commit through `/check-and-commit`.

Unverifiable (CI cannot prove): audible pause and resume of the same
track in a real voice channel; `playbackDuration` advancing (and
freezing while paused) against real `@discordjs/voice`; the bot actually
leaving the voice channel on `stop` and when the 5-minute idle-leave
wait fires; drop-while-paused keeping the leftover queue and not
resuming the paused track; slash commands appearing in the client;
prefix aliases in a real guild. Do not wait 5 minutes in the smoke
script; CI proves the timer seam with an injected schedule.

At ship time this slice stays a draft PR until the smoke below passes —
the judge checks this gate. Spec status stays `ready-for-plan` until
execute; do not invent a third spec-status value.

Human smoke script (test guild; slice 1 smoke already green):

0. Start the bot from README / existing slice 1 setup. Confirm the new
   slash names appear (`pause`, `resume`, `nowplaying`, `remove`,
   `shuffle`, `clear`, `stop`). Confirm `/np` and `/leave` do **not**
   appear.
1. Join voice. `/play <url>` then `/play <url>` then `/play <url>` so
   one is current and two are queued.
2. `/pause` → `Paused: {title}`; audio goes silent. `/pause` again →
   `Already paused.` Audio stays silent.
3. `/nowplaying` → `Paused: {title} ({elapsed} / {duration})` and a
   wrapped URL on the next line. Elapsed is not stuck at `0:00` if the
   track had already played for a couple of seconds before pause (if it
   is stuck, flag — do not add a decoder).
4. `/queue` → `Now:` line still has title + duration only (no Paused
   marker).
5. `/resume` → `Resumed: {title}`; the same track continues (not a
   restart from zero if elapsed was non-zero). `/resume` again →
   `Nothing is paused.`
6. `/nowplaying` → `Now playing: …` with elapsed moving.
7. `/remove 1` → `Removed: {title}` of the next upcoming. `/remove 0`
   and `/remove 99` → error; queue listing unchanged besides the earlier
   remove. `/remove` with no number (prefix `!remove`) → usage.
8. `/shuffle` → `Shuffled {n} tracks.` `/queue` upcoming order may
   change; `Now:` is the same track.
9. `/clear` → `Cleared {n} tracks.`; current keeps playing; bot stays
   in voice. `/play <url>` queues again.
10. `/stop` mid-song → `Stopped.`; bot leaves; `/nowplaying` →
    `Nothing is playing.` Next `/play` joins fresh (no leftover queue).
11. Play two tracks. Let the first end (or `/skip` the last remaining
    after queueing one). Bot stays in voice with no extra message after
    the skip/`Now playing` line. `/play <url>` in that window plays
    without a fresh join fight. `/stop` then leaves now (`Stopped.`).
    Do not wait 5 minutes.
12. `!np` and `!leave` match `/nowplaying` and `/stop`.
13. With nothing playing (no session): `/pause`, `/resume`,
    `/nowplaying`, `/stop` → `Nothing is playing.`; bot does not join.
14. Play a track, `/pause`, then Disconnect the bot from voice.
    Playback stops. `/nowplaying` → `Nothing is playing.` `/queue`
    shows leftover upcoming if any were queued. Next `/play` rejoins,
    plays the new track first, then the leftover queue — not the paused
    track.

## Changelog

- 2026-08-19: idle leave — after nothing is playing in voice, wait 5
  minutes then leave. Distinct from slice 5 alone-timer. Plan and
  architecture updated in the same turn.
- 2026-08-17: created from the slice 2 grill (decisions 1–5 carried in
  as settled). Writing-time details listed in Open questions. Status:
  ready-for-plan. Raptor check (seam + session policy) then `/plan`
  after slice 1 has shipped enough to copy.
