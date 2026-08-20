# Grill — slice 2 (core music controls)

Date: 2026-08-17
Target: slice 2 in `.ai/architecture.md`. No spec file exists yet. These
resolutions carry into the slice 2 spec (Design Decisions / pre-checked Open
Questions) when `/spec-writing` runs.

## Already settled (recorded, not asked)

- Copy slice 1: hybrid slash + prefix, one file per command, thin
  `CommandContext`, in-memory one session per guild.
- R1 engine Discord-free. R2 arrow bot → engine. R3 zero Java. R4 UX parity
  with first-principles internals. No new packages (AGENTS ask-first).
- No new sources, playlists, or DJ roles (slices 3–5). Anyone can use these
  commands until slice 5 (same as skip).
- Player stays bot-side (`AudioPlayer`). Engine stays resolver + `TrackQueue`
  + pipe. Pause is `AudioPlayer.pause()`, not a new engine Player.
- Zero-transcode seam stands: `{ stream, format }` with `webm/opus` only. No
  ffmpeg, no opus encoder, no volume transformer.
- Transition-honesty heuristic: N/A — nothing persisted; `packages/bot` and
  `packages/audio-engine` are not in the tree yet. Checks are against the
  slice 1 spec and architecture, not running code.

## Decisions

### 1. Command inventory: named everyday set; keep the slice 1 seam

- **In (both doors):** `pause`, `resume`, `nowplaying` (prefix alias `np`),
  `remove <position>`, `shuffle` (upcoming only; current stays), `clear`
  (wipe upcoming; current keeps playing; stay in voice), `stop` (wipe
  current + queue; leave voice; prefix alias `leave`).
- Empty `play` stays the usage reply from slice 1. Resume is its own
  command, not an overload of `play`.
- **Out (this slice):** `volume` (needs decode; Discord user volume covers
  it), `seek`, lyrics, search picker, reconnect-with-position (slice 1
  drop behavior stands: next `play` rejoins, current track is not resumed),
  `repeat`, `playnext`, `move`, `skipto`, live-updating now-playing message
  / channel topic (slice 5 `settc`), requester-only remove/shuffle (no
  requester field yet).
- Architecture slice 2 In/Out updated in the same turn.

### 2. Leave policy: JMusicBot defaults, fixed until slice 5

- `stop` / `leave`: wipe current + queue, leave now, reply `Stopped.`
- Queue becomes empty (natural end, skip of last track, last dead track):
  leave. No extra message.
- `clear` while something is playing, or `pause`: stay.
- Bot is the only one in the channel: stay. No alone-timer.
- Voice drop (Discord/admin disconnect): slice 1 stands — queue kept,
  current dropped, next `play` rejoins. Not a leave.
- On a real leave (`stop` or empty queue), drop the session. Next `play`
  starts clean.
- Slice 5 may add `stayinchannel` / `alonetimeuntilstop` config. Not this
  slice.
- This supersedes slice 1's "stay in channel when the queue empties"
  placeholder (spec Advance loop + Symmetric ops) when slice 2 ships.
- Architecture slice 2 In updated in the same turn.

### Addendum 2026-08-19 — idle leave (nothing playing)

User asked for auto-leave after a stretch of not playing music. This is
not the slice 5 alone-timer (bot is the only member in the channel).

- After natural end / skip of last track / last dead track: bot stays in
  voice with no extra message. If still nothing current and upcoming is
  empty after **5 minutes** (`IDLE_LEAVE_AFTER_MS = 300_000`), leave and
  drop the session. No extra message.
- `play` in that window cancels the wait and plays.
- `stop` / `leave` during the wait leaves now (`Stopped.`).
- `stop` while a track is current still leaves now (no 5-minute wait).
- `pause` does not start the wait (paused is current).
- Voice drop does not start the wait.
- Duration is a fixed constant this slice. Slice 5 may expose it next to
  `stayinchannel` / `alonetimeuntilstop`.
- No `VoiceStateUpdate` listener. One `setTimeout` behind an injectable
  `scheduleIdleLeave` on `createSession`.

Settled from JMusicBot + slice 1 `/queue` listing, not asked:

- `remove <n>`: `n` is the 1-based index in the upcoming list (the numbers
  `/queue` already shows). Current is not removable this way (use `skip`).
  Out of range → error reply, queue unchanged.

### 3. Pause is still “current track”; skip unpauses

- Paused is not idle. A track is current.
- `pause` while paused → `Already paused.`
- `resume` while paused → unpause, reply `Resumed: {title}`.
- `play <query>` while paused → enqueue as usual; stay paused on the
  current track.
- `skip` while paused → skip and **start** the next track (playing, not
  paused). Last track → leave per decision 2.
- `stop` / empty-queue leave unchanged.
- `nowplaying` / `queue` / `remove` / `shuffle` / `clear` work while paused.
- Idle (nothing current): `pause` / `resume` → `Nothing is playing.`
- Playing (not paused): `resume` → `Nothing is paused.`
- Empty `play` stays the usage reply. Resume is only `/resume` / `!resume`.

### 4. Now playing: one-shot plain text with elapsed + URL

- One-shot reply. No embed, no thumbnail, no progress bar, no requester,
  no live edit.
- Playing:
  `Now playing: {title} ({elapsed} / {duration})` then `<{uri}>` on the
  next line.
- Paused: same shape with `Paused:` instead of `Now playing:`.
- Idle: `Nothing is playing.`
- Elapsed and duration use slice 1’s `m:ss` / `h:mm:ss`. Elapsed comes from
  `@discordjs/voice` `playbackDuration` (bot-side). If smoke shows `0:00`
  stuck, flag it — do not add a decoder.
- Angle brackets around the URL suppress Discord unfurl.
- `/queue` `Now:` line stays as slice 1; pause state lives on `nowplaying`.

### 5. Scene walk (confirmed by user)

Happy path: user in voice with a track playing and two more queued.
`/pause` replies `Paused: {title}` and audio stops. `/nowplaying` shows
`Paused: {title} ({elapsed} / {duration})` plus the wrapped URL.
`/resume` continues the same track. `/remove 1` drops the next upcoming
track. `/shuffle` reorders the rest. `/clear` wipes upcoming; current keeps
playing. A later `/play` queues again. Last track ends (or `/skip` of the
last track) → bot stays in voice with no extra message; after 5 minutes
of nothing playing it leaves (2026-08-19 addendum). `/stop` mid-song
replies `Stopped.`, queue is gone, bot leaves now. Next `/play` joins
fresh.

Baked-in behaviors:

- Pause success reply is `Paused: {title}` (distinct from the `nowplaying`
  paused body, which also has elapsed, duration, and URL).
- Prefix aliases: `!np` → nowplaying, `!leave` → stop. Slash names are the
  canonical set only (`/nowplaying`, `/stop`).
- `/queue` `Now:` line unchanged from slice 1; pause state is on
  `nowplaying` only.
- Platform copies slice 1: slash door defers at receipt; prefix sends a
  channel message; guild-scoped bulk PUT on `ready` / `guildCreate` grows
  by the new names; every reply suppresses mentions; all replies public;
  same invite permissions. `remove` takes one integer option / prefix
  argument.

Failure modes:

1. Nothing playing (no session, or after a leave): `/pause`, `/resume`,
   `/nowplaying`, `/stop` → `Nothing is playing.` No join, no leave.
2. `/remove 0`, `/remove 99`, or `/remove` with no number → error reply;
   queue unchanged. Current is not removable this way (use skip).
3. `/pause` while already paused → `Already paused.` `/resume` while
   playing → `Nothing is paused.` Audio does not change.

Invariant if Discord voice drops (including mid-pause): playback stops,
current is dropped, the in-memory queue survives, session is kept (not a
leave). Next `/play` rejoins, plays the new track first, then the surviving
queue. A drop never clears the queue and never resumes the paused track.

## Grill close (2026-08-17)

- Fixed heuristics: Scene — walked and confirmed (decision 5). Symmetric
  ops — pause↔resume (decision 3); join↔leave (decision 2: `play` joins,
  `stop` leaves now; 2026-08-19 addendum: empty-queue idle leave waits
  5 minutes); enqueue↔remove/clear (decision 1).
  Platform contract — ACK/defer, registration, aliases, mention suppress,
  unfurl wrap, permissions copied from slice 1 and pinned in decision 5.
  Transition honesty — N/A (nothing persisted; slice 1 packages not in
  the tree yet).
- 2026-08-19: idle-leave addendum recorded above. Alone-timer still
  slice 5. Nothing else undecided for slice 2.
- Next: `/spec-writing` for slice 2, carrying decisions 1–5 as pre-checked
  Design Decisions / Open Questions. Raptor check (seam + session policy)
  → `/plan` after slice 1 has shipped enough to copy. Commit via
  `/check-and-commit` only.

