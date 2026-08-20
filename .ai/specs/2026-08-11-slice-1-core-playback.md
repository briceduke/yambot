# Slice 1 — Core playback

**Status:** ready-for-plan
**Research:** `.ai/research/discord-and-youtube-platform.md` (platform note —
Discord and YouTube are new client surfaces). Domain research N/A — JMusicBot
parity settles the domain (`.ai/product.md`).
**Grill:** `.ai/runs/2026-08-11-grill-slice-1-core-playback.md` (decisions 1–5
carried into this spec).

## Problem

The product promise — JMusicBot-class music with zero Java — is unproved.
Today the workspace has only `packages/checks`; no bot, no engine, no audio.
Slice 1 is the smallest vertical cut that proves the promise end to end
(command → guild session → engine resolve → audio in voice) and mints the
three patterns every later slice copies: the playback vertical slice, the bot
command module, and the engine source module.

## Goals

- A user in a voice channel plays YouTube audio (URL or search), queues a
  second track, lists the queue, and skips — on both doors (slash and prefix)
  in a real guild.
- `packages/audio-engine` exists with the pinned Discord-free seam;
  `packages/bot` depends on it. The R1/R2 dependency scan ships in this slice
  and enforces the seam from now on.
- Zero Java end to end (R3).
- The operator can set up and run the bot from README instructions alone
  (portal steps, invite scopes, env, start command).
- First examples minted and recorded in `AGENTS.md` in the same branch.

## Non-goals

- Pause/resume, now-playing, remove, shuffle, clear, stop, leave policy, and
  volume — slice 2. The bot never leaves voice on its own in slice 1.
- Reconnect heroics (retry/backoff/resume position after a voice drop) —
  slice 2.
- Sources beyond YouTube — slice 3. Playlists and live streams — slice 4.
- DJ roles, vote skip, guild-level prefixes, mention-as-prefix, help command,
  operator config — slice 5.
- Persistence of any kind. Packaging and Perry — slice 6.
- Search result picker: search plays the top hit, no menu.
- Permanent cuts stand: no dashboard, no SaaS, no JVM, no remote player
  protocol, no public engine release.

## Design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| YouTube extraction | `youtubei.js` (InnerTube) | Only maintained option; pure TS, no binary, no API key. Source-module seam lets a differently-backed module swap in if it proves flaky. (Grill 1) |
| Discord stack | `discord.js` + `@discordjs/voice` (DAVE via bundled `@snazzah/davey`) | Only maintained DAVE-capable JS voice path; most precedent to copy. (Grill 2) |
| Bot process runtime | Node LTS >= 24; Bun stays package manager, test runner, script runner | Bun voice has 8–13x CPU and timer-drift bugs today; swap back is one line when they close. (Grill 2) |
| TS dialect | Erasable-syntax TS only (no `enum`, no `namespace`, no parameter properties) | Node type stripping runs the bot's TS directly — no build step. |
| Seam audio contract | `{ stream, format }`; closed format list `["webm/opus"]` | YouTube serves opus-in-webm; `@discordjs/voice` demuxes it natively. Zero transcode, no ffmpeg, no opus encoder, no sodium. List grows only when a real source needs it. (Grill 3) |
| Seam stream type | Web `ReadableStream<Uint8Array>` | Runtime-agnostic standard; `youtubei.js` yields one; bot converts with `Readable.fromWeb` in one line. |
| Seam track metadata | `Track { title, uri, durationSeconds }` — no requester field | No slice 1 reply shows a requester. When a slice needs one it wraps bot-side; Discord types never enter the engine (R1). (Grill 3) |
| Resolve shape | `resolveTrack({ query })` returns one `Track` (URL or top search hit) | Multi-track results are slice 4's "added N tracks" UX. Fewest parts now; widening later is one signature in packages we own. |
| Queue ownership | Engine owns `TrackQueue` (pure state); bot owns voice, current track, and the advance pump | Engine in slice 1 is resolver + queue + pipe; it never decodes bytes. (Grill 3) |
| Seam error contract | Engine throws `TrackResolveError` with a user-safe message; bot catches and replies | Keeps the architecture failure split: extraction errors surface through the engine, voice errors stay bot-side. |
| Command surface | Hybrid: slash and prefix, same three commands; `COMMAND_PREFIX` env, default `!` | Locks the slice 5 surface question deliberately. MessageContent privileged intent accepted, fail-loud on 4014. (Grill 4) |
| Command modules | One file per command; transport-agnostic `CommandContext`; modules never see a raw Interaction or Message | Both doors are real on day one, so the thin context is load-bearing, not speculative. (Grill 4) |
| Slash registration | Guild-scoped bulk PUT on `ready` for every guild, and on `guildCreate` | Guild commands apply instantly; global takes up to 1 h. Self-host bots live in a handful of guilds; also keeps commands out of DMs. (Platform note Q2) |
| Session scoping | In-memory `Map<guildId, GuildMusicSession>`; one session per guild | Constitution scoping axis; no persistence until a slice proves the need. |
| Reply hygiene | Suppress all mentions in every bot reply; queue display capped at 10 entries + "…and K more" | Track titles are untrusted text; messages cap at 2000 chars. (Platform note) |
| Packages | Exactly `packages/audio-engine` + `packages/bot`; structure rules and R1/R2 scan added to `packages/checks` in this slice | AGENTS ask-first honored; constitution says the scan lands with slice 1. |

## Behavior

### Seam contract (pinned)

`packages/audio-engine` public surface. No Discord imports (R1); erasable TS;
web streams only.

```typescript
/** Closed set of audio formats the engine can yield. Grows only when a real source needs a new member. */
export const audioFormats = ["webm/opus"] as const;
export type AudioFormat = (typeof audioFormats)[number];

/** One playable item resolved from a source. */
export interface Track {
  readonly title: string;
  /** Canonical watch URL; also the handle a source module uses to open audio. */
  readonly uri: string;
  readonly durationSeconds: number;
}

/** Open audio for one track. */
export interface TrackAudio {
  readonly stream: ReadableStream<Uint8Array>;
  readonly format: AudioFormat;
}

/** A query cannot become a playable track. Message is safe to show users. */
export class TrackResolveError extends Error {}

/** YouTube source module — the engine source module first example. */
export function resolveTrack(input: { readonly query: string }): Promise<Track>;
export function openTrackAudio(input: { readonly track: Track }): Promise<TrackAudio>;

/** Per-guild FIFO of tracks waiting to play. Pure state; no I/O. */
export class TrackQueue {
  enqueue(track: Track): void;
  dequeueNext(): Track | null;
  list(): readonly Track[];
  get size(): number;
}
```

Bot-side thin context (built by each door; the bot command module first
example consumes it):

```typescript
/** Transport-agnostic command input. */
export interface CommandContext {
  readonly guildId: string;
  readonly channelId: string;
  readonly invokerVoiceChannelId: string | null;
  /** Raw argument text: slash option value or prefix remainder. Empty when none. */
  readonly args: string;
  /** Edits the deferred reply under slash; sends a channel message under prefix. Mentions suppressed. */
  reply(text: string): Promise<void>;
}
```

The bot maps `AudioFormat` to a playback input type in one lookup
(`"webm/opus"` → WebM/Opus demux). No per-source logic in the bot.

### Bot structure

- `GuildMusicSession` (in memory, one per guild): engine `TrackQueue`, current
  track, voice connection, audio player, announce channel id. Created on the
  first successful `play`; survives an empty queue and voice drops.
- Two dispatch doors feed the same command modules: the interaction handler
  (defers at receipt — resolve can exceed the 3 s window) and the message
  listener (ignores bots; parses `COMMAND_PREFIX`; unknown prefix commands are
  ignored silently; messages outside guilds are ignored).
- Announce channel = text channel of the most recent `play` command.
- Duration display: `m:ss`, or `h:mm:ss` at one hour and over.

### play (query = URL or search words)

1. Empty args → reply `Usage: /play <YouTube URL or search words>`.
2. Invoker not in a voice channel → reply `Join a voice channel first.` — no
   join, nothing queued (scene failure 1).
3. Bot playing in a different voice channel of this guild → reply
   `Already playing in #{channel} — join there.` — never yanks itself
   mid-song (scene failure 3).
4. Join the invoker's channel (move allowed only when idle).
5. Resolve through the engine. `TrackResolveError` → reply its message;
   nothing queued (scene failure 2).
6. Idle → set current, open audio, play, reply
   `Playing: {title} ({duration})`. An open failure here is treated like a
   resolve failure (error reply, no state change).
   Playing → enqueue, reply `Queued (#{queue.size + 1}): {title} ({duration})`
   (current track occupies #1).

### skip

- Nothing playing → reply `Nothing is playing.`
- Otherwise reply `Skipped: {title}` and stop the player; the advance loop
  announces what plays next. Anyone can skip (no DJ gate until slice 5).

### queue

- Nothing playing and queue empty → reply
  `Nothing is playing and the queue is empty.`
- Otherwise reply `Now: {title} ({duration})` plus up to 10 numbered upcoming
  entries, then `…and {k} more.` when the queue is longer.

### Advance loop (bot session, on player idle)

- Dequeue next. None → clear current track, stay in the voice channel, go
  quiet (leave policy is slice 2's decision).
- Open audio and play; announce `Now playing: {title} ({duration})` in the
  announce channel. If the track fails to open mid-queue, announce
  `Skipping {title}: couldn't play it` and continue to the next — the queue
  never stalls on a dead track (scene failure 2).

### Voice drop invariant

Connection destroyed → playback stops, current track is dropped, the
in-memory queue survives untouched, the session is kept. The next `play`
joins per the normal flow: the new track plays first (bot is idle), then the
surviving queue continues. No custom reconnect logic beyond `@discordjs/voice`
defaults.

### Startup and config

- Env: `DISCORD_TOKEN` (required — exit non-zero with a plain-English message
  when missing), `COMMAND_PREFIX` (default `!`).
- Intents: `Guilds`, `GuildVoiceStates`, `GuildMessages`, `MessageContent`
  (privileged). Gateway close 4014 → log
  `Enable the Message Content intent in the Discord developer portal, then restart.`
  and exit non-zero.
- On `ready`: bulk PUT the three guild commands to every joined guild; on
  `guildCreate`: PUT to the new guild (same-name registration overwrites, so
  this is idempotent).

### Package layout (target for the plan)

```text
packages/audio-engine/src/
  track.ts             Track, TrackAudio, audioFormats, TrackResolveError
  track-queue.ts       TrackQueue
  sources/youtube.ts   resolveTrack, openTrackAudio   ← engine source module first example
  index.ts             public exports
packages/bot/src/
  main.ts                 startup, login, registration, doors
  command-context.ts      thin context built from both doors
  commands/play.ts        ← bot command module first example
  commands/skip.ts
  commands/queue.ts
  guild-music-session.ts  session + per-guild registry
```

Engine dependencies: `youtubei.js` only. Bot dependencies: `discord.js`,
`@discordjs/voice`, and the engine workspace package. All three external
dependencies were approved at the grill.

## Scene

Happy path: a user sits in a voice channel and runs
`/play never gonna give you up` (or `!play …`). The bot acks at once (slash
defers), joins the user's channel, resolves the search, and replies
`Playing: Never Gonna Give You Up (3:33)`. Audio plays. A second `/play`
replies `Queued (#2): …`. `/queue` shows the current track and the upcoming
list. `/skip` replies `Skipped: …` and the bot announces
`Now playing: …` in the channel playback was requested from. When the queue
empties the bot goes quiet and stays in the channel.

Failure modes:

1. The invoker is not in a voice channel → `Join a voice channel first.`
   Nothing queued, no join.
2. The track cannot resolve on `play` → an error reply naming the failure;
   nothing added. A track dies when reached mid-queue → the bot announces
   `Skipping {title}: couldn't play it` and advances; the queue never stalls.
3. The bot is already playing in another voice channel of the guild →
   `Already playing in #{channel} — join there.` One session per guild; it
   never yanks itself mid-song.

If Discord voice drops, playback stops, the in-memory queue survives
untouched, and the next `play` rejoins and continues from the queue. A voice
drop never corrupts or silently clears the queue.

## Client / platform contract

- **ACK timing:** slash door defers at receipt (3 s window; the interaction
  token allows edits for 15 minutes — far beyond any resolve). Prefix replies
  are plain channel messages. All replies are public; no ephemeral replies.
- **Registration:** guild-scoped bulk PUT on `ready` and `guildCreate` —
  instant appearance, no DM surface. The 200 command-creates/day/guild limit
  only matters past hundreds of restarts a day; accepted.
- **Naming and sanitize:** command names `play`, `skip`, `queue` (Discord
  requires lowercase). Every reply suppresses all mentions — a track titled
  `@everyone` must never ping. Queue display caps at 10 entries to stay under
  the 2000-char message limit.
- **Permissions:** invite scopes `bot` + `applications.commands`; channel
  permissions View Channel, Send Messages, Connect, Speak. A failed voice
  join replies with the error instead of failing silently. MessageContent is
  privileged: portal flip documented in README; 4014 fails loudly at startup.
- **Rate limits:** no custom handling — `discord.js` queues REST calls and
  three commands' reply volume is trivial.
- **Ledger-vs-reply-vs-mirror order:** N/A — no ledger and no mirror surface
  exist; all state is in memory and the reply is the only user surface.
- **Symmetric ops:** join↔leave — `play` joins (or moves when idle); the bot
  never leaves on its own; leave/stop policy is deliberately slice 2.
  slash↔prefix — same command modules, same reply strings, both doors from
  day one.

## Transition plan

N/A — greenfield. No existing users, state, or config to migrate; the first
install creates everything. Rollback is stopping the process; nothing is
persisted.

## Acceptance criteria

- [ ] Workspace gains exactly `packages/audio-engine` and `packages/bot`;
      their structure rules land in `packages/checks` and
      `bun run checks:structure` passes.
- [ ] R1/R2 dependency scan exists in `packages/checks`, runs inside
      `bun run checks`, fails on a Discord import in the engine or an
      engine→bot import, and passes on the shipped tree.
- [ ] No Java anywhere: no JVM, Lavalink, or lavaplayer dependency or spawned
      process in the tree (R3 — judge review).
- [ ] `bun run typecheck` passes workspace-wide.
- [ ] `bun test packages/audio-engine` passes and covers: TrackQueue FIFO
      (enqueue, dequeueNext, list, size), URL-vs-search query classification,
      format selection yielding `webm/opus`, and resolve-error mapping —
      against faked InnerTube responses, no network.
- [ ] `bun test packages/bot` passes and covers: prefix parse + dispatch,
      each command's replies including all three scene failure modes against
      a fake session/engine, advance-on-idle including the dead-track skip,
      and the audio pipe fed `{ stream, format }` from a fixture file on
      disk — no network, no Discord login.
- [ ] Both doors dispatch the same three command modules; guild-scoped
      registration runs on `ready` and `guildCreate`.
- [ ] Missing `DISCORD_TOKEN` and gateway close 4014 each exit non-zero with
      the pinned plain-English messages.
- [ ] README run instructions exist; smoke step 0 succeeds using them alone.
- [ ] The named human smoke script below passes in the test guild.
- [ ] `AGENTS.md` First examples rows for the three minted patterns point at
      real paths, updated in the same branch.

## Open questions

Settled at the grill (2026-08-11 — details in the run file):

- [x] YouTube extraction library — **Answer:** `youtubei.js`; own extraction
      layer rejected; yt-dlp subprocess rejected (grill decision 1).
- [x] Discord/voice stack and runtime — **Answer:** `discord.js` +
      `@discordjs/voice` on Node LTS; Bun revisit trigger recorded (grill
      decision 2).
- [x] Seam audio contract — **Answer:** `{ stream, format }`, closed list,
      `webm/opus` only, zero transcode (grill decision 3).
- [x] Command surface — **Answer:** hybrid slash + prefix, `COMMAND_PREFIX`
      env default `!`, MessageContent intent accepted (grill decision 4).
- [x] Scene and failure modes — **Answer:** walked and confirmed (grill
      decision 5).

Settled while writing this spec (design details; none in ask-first
territory):

- [x] Seam stream type — **Answer:** web `ReadableStream<Uint8Array>`;
      runtime-agnostic, `youtubei.js` yields one, bot converts in one line.
- [x] Resolve return shape — **Answer:** one `Track`; multi-track is
      slice 4's UX; widening later is one signature change.
- [x] Slash registration scope — **Answer:** guild-scoped on `ready` +
      `guildCreate`; global takes up to 1 h and adds a DM surface (platform
      note Q2).
- [x] Requester metadata — **Answer:** none in slice 1; no reply shows it;
      bot-side wrapping when a later slice needs it.
- [x] Reply hygiene — **Answer:** suppress all mentions everywhere; cap queue
      display at 10 + `…and {k} more.`
- [x] Announce channel — **Answer:** channel of the most recent `play`
      (grill scene: "the channel playback was requested from").
- [x] Skip acknowledgment — **Answer:** skip replies `Skipped: {title}`; the
      advance loop separately announces `Now playing: …` when a next track
      exists.
- [x] Post-drop `play` semantics — **Answer:** bot is idle after a drop, so
      the new track plays first, then the surviving queue continues.
- [x] Unknown prefix commands — **Answer:** ignored silently; a help surface
      is a later slice.
- [x] First-track open failure — **Answer:** treated like a resolve failure
      (error reply, no state change); mid-queue open failure announces and
      advances (grill scene failure 2).
- [x] TS dialect — **Answer:** erasable-syntax TS only, so Node type
      stripping runs the bot with no build step.

## Proof plan

Per the constitution §5 ladder:

- Engine logic → `bun run typecheck` + `bun test packages/audio-engine`.
- Bot command/session wiring → typecheck + `bun test packages/bot`.
- Structure and docs → `bun run checks:structure`.
- Seam rules → the new R1/R2 dependency scan inside `bun run checks`.
- Voice and extraction → mandatory human smoke (below).
- Every commit through `/check-and-commit`.

Unverifiable (CI cannot prove): audible audio in a real voice channel; the
DAVE handshake against real Discord; portal intent state; live YouTube
extraction; real join/move gateway behavior; slash commands appearing in the
client. At ship time this slice stays a draft PR until the smoke below
passes — the judge checks this gate.

Human smoke script (test guild):

0. **Setup by README alone:** create the Discord app, flip MessageContent,
   invite with scopes `bot applications.commands` and permissions View/Send/
   Connect/Speak, set `DISCORD_TOKEN`, `bun install`, start the bot. It shows
   online.
1. Join a voice channel; `/play <known YouTube URL>` → bot joins your
   channel, replies `Playing: {title} ({duration})`, audio is audible.
2. `/play <search words>` → `Queued (#2): …`.
3. `/queue` → shows the current track and one upcoming.
4. `/skip` → `Skipped: …`, then `Now playing: …` announced in the same text
   channel; audio switches.
5. `!play <url or search>` → same behavior through the prefix door.
6. From outside voice: `/play <url>` → `Join a voice channel first.`; the
   bot does not join and `/queue` is unchanged.
7. `/play` with a removed/bogus video URL → error reply naming the failure;
   nothing queued.
8. While the bot plays in channel A, run `/play <url>` from channel B →
   `Already playing in #A — join there.`
9. Let the queue run out → the bot goes quiet and stays in the channel.
10. With one track queued, right-click → Disconnect the bot → playback
    stops; `/play <url>` → it rejoins, plays the new track, then continues
    the surviving queue.
11. Stop the process, unset `DISCORD_TOKEN`, start → exits non-zero with the
    plain-English message.

## Changelog

- 2026-08-11: created from the slice 1 grill (decisions 1–5 carried in as
  settled). Wrote the platform note
  `.ai/research/discord-and-youtube-platform.md` (guild vs global
  registration checked against current Discord docs). Settled the
  writing-time details listed in Open questions. Status: ready-for-plan.
