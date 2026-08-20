# Grill — slice 1 (core playback)

Date: 2026-08-11
Target: slice 1 in `.ai/architecture.md`. No spec file exists yet. These
resolutions carry into the slice 1 spec (Design Decisions / pre-checked Open
Questions) when `/spec-writing` runs.

## Platform facts checked during this grill (2026-08-11)

- DAVE E2EE is mandatory since 2026-03-01. Discord rejects voice connections
  from clients without DAVE support. The voice stack must support it
  (`@discordjs/voice` does, via `@snazzah/davey`).
- Bun voice problems are real today: reports of 8–13x higher CPU than Node
  while streaming audio (oven-sh/bun#26415, Jan 2026) and timer drift in the
  voice audio loop (oven-sh/bun#11313).
- Extraction ecosystem: `ytdl-core` unmaintained since 2023.
  `@distube/ytdl-core` declares itself unmaintained and points to
  `youtubei.js`. `youtubei.js` is actively maintained (v17.x, June 2026,
  ~198k weekly downloads).

## Already settled (recorded, not asked)

- Packages: `packages/bot` + `packages/audio-engine` only (AGENTS ask-first,
  constitution R1).
- R1 engine Discord-free. R2 arrow bot → engine. R3 zero Java. R4 UX parity
  with first-principles internals.
- In-memory guild session. One session per guild. No persistence. Env-file
  config (`DISCORD_TOKEN`).
- Sources: YouTube URL + search only. No playlists, no streams, no DJ config
  (later slices).
- Transition-honesty heuristic: N/A — greenfield, no existing state to
  migrate.

## Decisions

### 1. YouTube extraction: `youtubei.js` (new production dependency — approved)

- The engine's YouTube source module uses `youtubei.js` (InnerTube client)
  for URL resolve, search, and audio streams. Pure TypeScript, no external
  binary, no API key.
- We do not write or maintain our own extraction layer. First-principles (R4)
  applies to our engine — queue, player, seam — not to re-implementing
  YouTube's private API. That churn is outsourced upstream.
- Hedge: the engine source-module seam lets a differently-backed source
  module (for example yt-dlp) swap in later without touching the bot, if
  `youtubei.js` proves too flaky.
- Rejected: `yt-dlp` subprocess (external ~30MB binary to ship and update —
  worse self-host and Perry packaging); `ytdl-core` and `@distube/ytdl-core`
  (unmaintained).

### 2. Discord stack: `discord.js` + `@discordjs/voice`; bot process on Node LTS (new production dependencies — approved)

- Bot package uses `discord.js` (full Client) + `@discordjs/voice`.
  `@snazzah/davey` (DAVE E2EE, wraps Discord's C++ libdave) ships bundled
  with `@discordjs/voice` and is the only DAVE library in JS. Voice requires
  Node >= 22.12.
- Minimal audio deps: none beyond the above. Packet encryption uses Node's
  built-in `aes-256-gcm` (no sodium package). WebM/Opus plays with no ffmpeg
  and no opus encoder. Do not add ffmpeg, opus, or sodium packages until a
  slice needs them.
- The bot process runs on Node LTS (24.x — runs TypeScript directly via
  default type stripping; no build step). Bun stays package manager, test
  runner, and script runner for the whole workspace. Engine is runtime-
  agnostic (R1).
- Revisit trigger: when oven-sh/bun#11313 (voice timer drift) and
  oven-sh/bun#26415 (8–13x CPU streaming voice) close, try the bot process
  on Bun again. The swap is one line in the start script.
- Rejected: hand-rolled voice (DAVE/MLS churn killed every unmaintained
  stack in March 2026); Rust/C++ voice sidecar or bespoke voice child
  process (the Lavalink shape — separate player process is a permanent cut
  in `.ai/architecture.md`; the hot paths are already native via davey);
  Oceanic/Eris (delegate voice to `@discordjs/voice` anyway); `@discordjs/core`
  (lean runner-up, but more hand-assembly and far less precedent to copy —
  the shed parts are inert caches, not failure-prone machinery).

### 3. Seam audio contract: stream + closed format enum (no transcoding in slice 1)

- Engine yields `{ stream, format }`. The format enum is closed and has one
  member in slice 1: `webm/opus`. YouTube audio is already opus; the bot's
  voice layer demuxes WebM natively and sends opus frames straight to
  Discord. Zero transcode, zero ffmpeg, zero opus encoder, no quality loss.
- Engine in slice 1 is resolver + queue + pipe. It never decodes audio
  bytes. The WebM demux happens bot-side inside `@discordjs/voice`.
- The bot maps format → playback input type in one lookup on the closed
  enum. No per-source logic in the bot. The enum grows only when a real
  source (slice 3+) yields something that is not opus — that is the moment
  PCM or ffmpeg earns its way in.
- Track metadata across the seam: `title`, `uri`, `duration`. The requester
  (a Discord user) is bot-side wrapping — Discord types never enter the
  engine (R1). Exact TypeScript interfaces get pinned in the spec.
- Mock seam: bot tests feed `{ stream, format }` from a fixture file on
  disk. No YouTube, no network.
- Rejected: always-PCM seam (decoder in engine + encoder in bot + two codec
  passes per track to avoid a one-line lookup — incidentally lavaplayer's
  internal shape, R4).

### 4. Command surface: both doors — slash and prefix (hybrid locked)

- Slice 1 ships the same three commands (`play`, `skip`, `queue`) as slash
  commands and prefix commands. This locks the slice 5 "slash vs prefix vs
  hybrid" parity question early, deliberately: hybrid.
- Prefix: one global `COMMAND_PREFIX` env var, default `!`. No guild-level
  prefix config and no mention-as-prefix until slice 5 (operator surface).
- Consequence (accepted): MessageContent privileged intent is required.
  Every self-hoster flips it in the Discord developer portal; the gateway
  fails loudly at startup (4014) if missing. Goes in setup docs.
- Consequence (accepted): the bot has two dispatch doors — interaction
  handler and message listener with prefix parse. The command-module first
  example is therefore transport-agnostic: commands take a thin context
  (reply, guild, invoker voice state), never a raw interaction or message.
  This abstraction is load-bearing from day one because both transports are
  real on day one.
- Slice 5 shrinks to: operator/DJ config, remaining command parity,
  guild-level prefixes, mention-prefix.
- Architecture updated in the same turn: slice 1 "In" names both doors;
  slice 5 outcome no longer reads as an open question.

### 5. Scene walk (confirmed by user)

Happy path: user in a voice channel runs `/play <search or url>` (or
`!play …`). Bot acks at once (slash defers — resolve can exceed the
3-second window), joins the user's channel, resolves, replies
"Playing: title (duration)". Audio plays. A second `/play` replies
"Queued (#2): …". `/queue` lists current + upcoming. `/skip` advances and
the bot posts "Now playing: …" in the channel playback was requested from.
Queue empties → bot goes quiet and stays in the channel (leave policy is
slice 2's decision, not an accident).

Baked-in behaviors:

- No `join` command. `/play` joins implicitly (JMusicBot behavior).
- Search plays the top result. No picker.
- Anyone can skip. No votes, no DJ gate until slice 5.
- "Now playing" announcement only on auto-advance and skip; the `/play`
  reply covers the first track.
- Prefix replies are plain channel messages; slash uses defer + edit.

Failure modes:

1. Invoker not in a voice channel → "Join a voice channel first." Nothing
   queued, no join.
2. Track unresolvable on `/play` → error reply naming the failure, nothing
   added. Track dies when reached mid-queue → post "Skipping X: couldn't
   play it" and advance; never stall.
3. Bot already playing in another voice channel of the guild → "Already
   playing in #channel — join there." One session per guild; never yanks
   itself mid-song.

Invariant if Discord voice drops: playback stops, the in-memory queue
survives untouched, and the next `/play` reconnects and resumes from the
queue. No reconnect heroics in slice 1 (slice 2). A voice drop never
corrupts or silently clears the queue.

## Grill close (2026-08-11)

- Fixed heuristics: Scene — walked and confirmed (decision 5). Symmetric
  ops — join↔leave settled: slice 1 joins, never leaves on its own; leave
  policy is slice 2. Platform contract — ACK/defer, prefix rules,
  MessageContent intent, permissions failure behavior covered in decisions
  4–5. Transition honesty — N/A (greenfield).
- Nothing undecided remains for slice 1. No forced questions were added.
- Next: `/spec-writing` for slice 1, carrying decisions 1–5 as pre-checked
  Design Decisions / Open Questions. Then raptor check (risky slice) →
  `/plan` → `/execute`. Commit via `/check-and-commit` only.
