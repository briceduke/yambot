# Slice 3 — Source breadth (SoundCloud first cut)

**Status:** ready-for-plan
**Research:** `.ai/research/discord-and-youtube-platform.md` (same Discord
surface as slices 1–2). `.ai/research/soundcloud-platform.md` (SoundCloud
extractor, HLS bytes, ffmpeg stay in the bot). Domain research N/A —
JMusicBot UX plus the slice 3 grill settle the domain.
**Grill:** `.ai/runs/2026-08-22-grill-slice-3-source-breadth.md`
(decisions 1–6 carried into this spec).
**Depends on:** `.ai/specs/2026-08-11-slice-1-core-playback.md` (copy the
YouTube source module and play command; do not invent a second layout)
and `.ai/specs/2026-08-17-slice-2-core-music-controls.md` (same session,
pause, leave, now playing).
**Raptor:** `.ai/runs/2026-08-22-raptor-slice-3-source-breadth.md`
(passed; cuts applied below).

## Problem

Slice 1–2 play YouTube only. A SoundCloud URL on `/play` is treated as a
YouTube search. JMusicBot-class source breadth starts with one second
site that you can hear in the test guild — not a plugin registry and
not every remaining site at once.

## Goals

- A user in voice plays a SoundCloud **track URL** through existing
  `/play` (and `!play`) and hears audio.
- `scsearch <words>` on both doors plays or queues the top SoundCloud
  hit. No picker. `/play` bare words stay YouTube search.
- Engine adds `packages/audio-engine/src/sources/soundcloud.ts`, copied
  from `youtube.ts`. Public resolve grows an optional
  `source?: "soundcloud"` hint. Format list grows `"hls/aac"`. The bot
  maps that to PATH ffmpeg. YouTube stays `webm/opus` with no ffmpeg.
- Hear one SoundCloud track in the test guild. Then stop this cut.

## Non-goals

- Bandcamp, Vimeo, Twitch, local files, HTTP streams.
- Spotify as a source. Do not add a Spotify client. Do not guess a
  YouTube match from a Spotify URL. A later slice may reply that
  Spotify cannot be played (error path, not a source module).
- SoundCloud sets/playlists, radio, live streams — slice 4.
- `scsearch:` lavaplayer identifier stuffed into `/play`. Search picker.
- DJ roles, operator config, new packages, persistence.
- ffmpeg in `packages/audio-engine`. `ffmpeg-static`. An opus encoder.
  A sodium package. Switching YouTube to PCM.
- `SOUNDCLOUD_CLIENT_ID` env this slice.
- A public `resolveSoundCloudTrack`. A plugin registry.
- Permanent cuts stand: no dashboard, no SaaS, no JVM, no remote player
  protocol, no public engine release.

## Design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| First cut | SoundCloud track URLs + `scsearch` only. Spotify is not a source. | Grill 1. Architecture slice 3 In/Out. |
| Search doors | `/scsearch` and `!scsearch` (no alias). `/play` search stays YouTube. SoundCloud track URLs work on `/play` via host dispatch. | Grill 2. Copy `play.ts`. |
| Resolve hint | `resolveTrack({ query, source?: "soundcloud" })`. Omit `source` on `/play`. `/scsearch` passes the hint. `openTrackAudio` stays `{ track }`. | Grill 3. One public pair. |
| Format + ffmpeg | Grow `audioFormats` with `"hls/aac"`. Bot maps it to `StreamType.Arbitrary` (PATH ffmpeg). `"webm/opus"` stays `StreamType.WebmOpus`. | Grill 4. YouTube stays zero-transcode. |
| Extractor | Production dependency `soundcloud.ts` (api-v2, no operator key). Wrap behind an injectable client. Never call `util.streamTrack` / `downloadTrack`. | Grill 5. Those helpers spawn ffmpeg. Platform note. |
| HLS bytes | Yield HLS segment bodies as they arrive (not m3u8 text, not a full-track buffer). Prefer HLS AAC; if none, HLS MPEG; same `"hls/aac"` tag. | Piped playlist cannot drive Arbitrary stdin. MPEG fallback is one if, not a second format. |
| Scene | Happy path and three failure modes walked at the grill (see Scene). | Grill 6. |
| Scoping | Same in-memory `Map<guildId, GuildMusicSession>`. No new store. | Constitution scoping axis. |
| Hard rules | R1: no Discord in the engine; ffmpeg stays bot-side. R2: bot → engine. R3: zero Java. R4: UX parity; do not copy JMusicBot/lavaplayer internals. | Same scan as slice 1. |
| Pattern to copy | `packages/audio-engine/src/sources/youtube.ts` and `packages/bot/src/commands/play.ts`. No new First examples row. | Second instance copies; it does not invent. |
| Proof | Typecheck + `bun test` both app packages + named human smoke for voice and live SoundCloud. Structure check grows `soundcloud.ts` and `scsearch.ts`. | Constitution §5. |
| Frozen surfaces | None. | `BACKWARD_COMPATIBILITY.md` is empty. |
| Ask first | `soundcloud.ts` is the new production dependency — approved at the grill. No new packages. No persistence. | AGENTS ask-first closed in grill 5. |
| Out of scope | See Non-goals. | Grill 1–2. |
| Symmetric ops | `play` and `scsearch` both enqueue on the same session. `remove` / `clear` / `stop` already slice 2. No unlist for a source. | Grill close. |
| Client / platform | Copy slice 1–2: slash defers; prefix sends a channel message; guild bulk PUT adds `scsearch`; mention suppress; public replies; same invite. | Grill 6. Same Discord surface. |
| Transition | No persisted state. Behavior change: a SoundCloud URL on `/play` plays SoundCloud instead of YouTube-searching the URL. YouTube-only operators do not need ffmpeg. | Grill close. |
| Unverifiable | Live SoundCloud audio, PATH ffmpeg in a real guild, YouTube still audible without ffmpeg. Named smoke below. | CI has no Discord voice. |
| Router | New `packages/audio-engine/src/resolve.ts` owns public `resolveTrack` / `openTrackAudio`. `youtube.ts` keeps `*WithClient` + `parseYoutubeQuery`. | Public names cannot stay YouTube-only. Not a plugin registry. |
| Raptor refuse | No registry, no engine Player, no engine ffmpeg, no `ffmpeg-static`, no Spotify module, no extra format members, no `scsearch:` on `/play`, no PATH probe, no `playlist-url` parse kind, no full-track buffer. | `.ai/runs/2026-08-22-raptor-slice-3-source-breadth.md` |

## Behavior

Copy slices 1–2 unless this section replaces them. Session, pause, leave,
now playing, skip, queue listing, voice drop, hybrid doors, mention
suppress, and registration shape stay as shipped, with the additions
below.

### Seam (engine)

```typescript
export const audioFormats = ["webm/opus", "hls/aac"] as const;
export type AudioFormat = (typeof audioFormats)[number];

/** Track, TrackAudio, TrackResolveError, TrackQueue — unchanged. */

export function resolveTrack(input: {
  readonly query: string;
  readonly source?: "soundcloud";
}): Promise<Track>;

export function openTrackAudio(input: {
  readonly track: Track;
}): Promise<TrackAudio>;
```

`index.ts` re-exports `resolveTrack` / `openTrackAudio` from `resolve.ts`,
not from `youtube.ts`.

`EnginePort` in `packages/bot/src/guild-music-session.ts` grows the same
optional `source` field. `openTrackAudio` stays `{ track }`.

### Host dispatch (`resolve.ts`)

Pure helper (name it `pickSource`) used by the public functions:

| Input | Result |
|-------|--------|
| `source === "soundcloud"` and query is a YouTube URL | `TrackResolveError`: `That is not a SoundCloud track.` |
| `source === "soundcloud"` otherwise | SoundCloud module (URL or search words) |
| `source` omitted, query is a SoundCloud URL | SoundCloud module |
| `source` omitted otherwise | YouTube module (URL or search, including non-SoundCloud URLs) |

SoundCloud URL: `URL.canParse(trimmed)` and hostname is `soundcloud.com`,
ends with `.soundcloud.com`, or is `snd.sc`.

YouTube URL: same hosts as `parseYoutubeQuery` today (`youtu.be` or
hostname ends with `youtube.com`).

`openTrackAudio` routes on `track.uri` with the same host rules. Unknown
host → `TrackResolveError` with `Couldn't play that track.`

Do not treat a Spotify URL as a source this slice. It still falls through
to YouTube search (slice 1 behavior).

### YouTube module

Keep `parseYoutubeQuery`, `resolveTrackWithClient`,
`openTrackAudioWithClient`, and the injectable `YoutubeClient`. Public
`resolveTrack` / `openTrackAudio` **move out** of this file so a second
source can sit beside it. Tests still call the `*WithClient` functions.
No ffmpeg. Format stays `"webm/opus"`.

A SoundCloud URL must not reach `parseYoutubeQuery` as a search. The
router intercepts those hosts first.

### SoundCloud module (`sources/soundcloud.ts`)

Copy the YouTube client seam. Tests never hit the network.

```typescript
export interface SoundCloudClient {
  getTrack(url: string): Promise<{
    readonly title: string;
    readonly durationSeconds: number;
    readonly permalinkUrl: string;
    readonly kind: "track" | "playlist" | "other";
    readonly hasHlsAudio: boolean;
  }>;
  searchFirstTrackUrl(query: string): Promise<string | null>;
  openHlsAudio(permalinkUrl: string): Promise<ReadableStream<Uint8Array>>;
}

export function parseSoundCloudQuery(
  query: string,
):
  | { readonly kind: "track-url"; readonly url: string }
  | { readonly kind: "search"; readonly query: string };

export function resolveSoundCloudTrackWithClient(
  input: { readonly query: string },
  client: SoundCloudClient,
): Promise<Track>;

export function openSoundCloudAudioWithClient(
  input: { readonly track: Track },
  client: SoundCloudClient,
): Promise<TrackAudio>;
```

Default client: `new Soundcloud()` with no constructor args (library
finds a client id). Wrap `tracks.get`, `tracks.search`, and HLS open.
Do not call `util.streamTrack`, `util.downloadTrack`, or
`m3uReadableStream`. Those spawn ffmpeg and may load `ffmpeg-static`.

`parseSoundCloudQuery` (copy `parseYoutubeQuery`):

- Path contains `/sets/` → throw `TrackResolveError`:
  `Playlists are not supported yet. Use a track URL or search words.`
- SoundCloud host otherwise → `track-url` (include `on.soundcloud.com`
  and `snd.sc`; the API resolve follows shorts).
- Else → `search`.

`resolveSoundCloudTrackWithClient`:

1. `search` → `searchFirstTrackUrl`; `null` →
   `No SoundCloud results for that search.` Then `getTrack` on that URL.
2. `track-url` → `getTrack`.
3. `kind !== "track"` → same playlist error as parse (`/sets/`).
4. `hasHlsAudio === false` → `That track has no playable audio.`
5. Return `{ title, uri: permalinkUrl, durationSeconds }`.
   `durationSeconds` is `Math.floor(apiDurationMs / 1000)` (API duration
   is milliseconds). Missing duration → `0`.

Map other library failures to
`Couldn't play that SoundCloud track.`

`openSoundCloudAudioWithClient`:

1. Prefer an HLS AAC transcoding (`protocol === "hls"`, mime starts with
   `audio/mp4`). If none, HLS MPEG (`audio/mpeg`). If none, throw
   `That track has no playable audio.`
2. Resolve the transcoding URL to a playlist URL (same HTTP as
   `util.streamLink`: GET transcoding URL + `client_id`, read `url`).
3. Fetch the m3u8. Fetch each segment URL. Push each segment body into
   the `ReadableStream<Uint8Array>` as it arrives. Do not buffer the
   whole track first.
4. Return `{ stream, format: "hls/aac" }`.

Do not yield playlist text. Do not remux with ffmpeg. Do not emit PCM.

### Bot format lookup

`playbackInputByFormat` in `packages/bot/src/discord-voice.ts`:

```typescript
const playbackInputByFormat: { readonly [K in AudioFormat]: StreamType } = {
  "webm/opus": StreamType.WebmOpus,
  "hls/aac": StreamType.Arbitrary,
};
```

On `"hls/aac"` play, if ffmpeg is missing from PATH, `play` throws
`Couldn't play that SoundCloud track: ffmpeg is not installed.` Map
the spawn error from `createAudioResource` / the player. Do not add a
PATH probe. Do not probe at startup. Do not add `ffmpeg-static`. Do
not set `inlineVolume`.

`playNow` still throws on first-track open/play failure (nothing
current, nothing queued). Mid-queue open/play failure still announces
`Skipping {title}: couldn't play it` and advances (slice 1 stands).

YouTube `"webm/opus"` must not require ffmpeg.

### `play` command

Same session rules. Usage and slash copy change to mention SoundCloud
URLs:

- Empty args → `Usage: /play <YouTube or SoundCloud URL or YouTube search words>`
- Slash description: `Play a YouTube or SoundCloud URL, or YouTube search words.`
- Query option description matches that.
- `resolveTrack({ query: ctx.args })` — no `source` hint.
- Fallback non-`TrackResolveError` → `Couldn't play that YouTube video.`
  (unchanged). SoundCloud failures should already be `TrackResolveError`.

### `scsearch` command

Copy `packages/bot/src/commands/play.ts` into `scsearch.ts`.

- Slash name `/scsearch`. Prefix `!scsearch`. No alias. No `/scs`.
- Empty args → `Usage: /scsearch <SoundCloud search words>`
- Slash description: `Search SoundCloud and play the top hit.`
- String option `query`, optional so a bare command hits usage.
- `resolveTrack({ query: ctx.args, source: "soundcloud" })`
- Fallback non-`TrackResolveError` →
  `Couldn't play that SoundCloud track.`
- Same join / occupied / queue / pause-stays-paused rules as `play`.
- Anyone may invoke until slice 5. Invoker must be in voice.

A SoundCloud track URL on `scsearch` still resolves. A YouTube URL
fails with `That is not a SoundCloud track.`

### Dispatch and registration

`scsearch` creates a session and binds the announce channel the same
way `play` does (`getOrCreateGuildSession` in `runDoorCommand`).
`readSlashArgs` reads the `query` option for `play` and `scsearch`
with one extra `||` (no query-command list). Add `scsearch` to
`knownCommandNames` and `dispatchCommand`. Same for session create:
`name === "play" || name === "scsearch"`. Do not add a session-create
command registry.

Guild-scoped bulk PUT on `ready` / `guildCreate` includes `scsearch`
(optional string option `query`). Same-name PUT stays idempotent.

### README

Need: install ffmpeg and keep `ffmpeg` on PATH (SoundCloud only).
Document next to Node / bun. Missing ffmpeg must not be required to
start the bot or to play YouTube. Commands list adds `/scsearch` and
`!scsearch`. `/play` line mentions SoundCloud track URLs.

### Package layout (adds to slices 1–2)

```text
packages/audio-engine/src/
  resolve.ts              public resolveTrack / openTrackAudio; pickSource
  track.ts                audioFormats includes "hls/aac"
  index.ts                re-export resolve from resolve.ts
  sources/youtube.ts      *WithClient + parseYoutubeQuery (no public pair)
  sources/soundcloud.ts   SoundCloud module (copy youtube.ts seam)
packages/bot/src/
  main.ts                 dispatch + session create for scsearch
  register-commands.ts    scsearch in the guild PUT
  discord-voice.ts        "hls/aac" → StreamType.Arbitrary; ffmpeg-miss
  guild-music-session.ts  EnginePort.source optional
  commands/play.ts        usage/description mention SoundCloud URL
  commands/scsearch.ts    copy of play.ts with source hint
packages/checks/configs/structure.ts
  engine-source-module requiredFiles += soundcloud.ts
  bot-command-module requiredFiles += scsearch.ts
packages/audio-engine/package.json
  dependencies += soundcloud.ts
```

No new workspace packages. First examples table stays pointed at
`youtube.ts` and `play.ts`.

## Scene

Happy path: a user is in voice. `/play https://soundcloud.com/artist/track`
defers (slash) then `Playing: {title} ({duration})`. Audio is audible
(ffmpeg on PATH). `/scsearch lofi beats` plays or queues the top
SoundCloud hit (`Playing:` / `Queued (#n):`). `/play never gonna give
you up` still searches YouTube. `/nowplaying` shows title, elapsed,
duration, and wrapped URL. `/skip` advances. Prefix `!scsearch` matches
`/scsearch`.

Baked-in:

- Guild-scoped bulk PUT on `ready` / `guildCreate` adds `scsearch`.
- `play` usage/description: YouTube or SoundCloud URL, or YouTube
  search words.
- Slash door defers at receipt; prefix sends a channel message; every
  reply suppresses mentions; all replies public; same invite
  permissions as slice 1.
- ffmpeg is not required to start the bot or to play YouTube.
- Missing ffmpeg on a SoundCloud open:
  `Couldn't play that SoundCloud track: ffmpeg is not installed.`
- SoundCloud set/playlist URL: resolve error, nothing queued.
- YouTube URL on `/scsearch`: resolve error, nothing queued.

Failure modes:

1. Invoker not in voice → `Join a voice channel first.` Nothing queued,
   no join. Bot already playing in another channel of the guild →
   `Already playing in #channel — join there.`
2. Unresolvable SoundCloud (private, region, no stream, no search hit)
   or a set/playlist URL → error reply, nothing added. YouTube URL on
   `/scsearch` → error, nothing added. Dead track reached mid-queue →
   `Skipping {title}: couldn't play it` and advance (slice 1 stands).
3. SoundCloud play (or `scsearch` that starts audio) with ffmpeg
   missing → the ffmpeg error above. YouTube still plays. Bot stays up.

If Discord voice drops: slice 2 stands. Playback stops, current is
dropped, in-memory queue survives, session is kept. Next `/play` or
`/scsearch` rejoins. A drop never clears the queue.

## Client / platform contract

- **ACK timing:** slash door defers at receipt. Prefix replies are
  plain channel messages. All replies are public; no ephemeral replies.
- **Registration:** guild-scoped bulk PUT on `ready` and `guildCreate`,
  now including `scsearch` (optional string `query`). No slash alias.
- **Naming and sanitize:** Discord slash names lowercase. Every reply
  suppresses all mentions. `nowplaying` still wraps the URL in `<>`.
- **Permissions:** same invite as slice 1 (`bot` +
  `applications.commands`; View Channel, Send Messages, Connect,
  Speak). ffmpeg is an operator install, not a Discord permission.
- **Rate limits:** no custom handling; `discord.js` queues REST.
- **Ledger-vs-reply-vs-mirror order:** N/A — no ledger and no mirror.
- **Symmetric ops:** `play` / `scsearch` both join-or-queue on the same
  session; `remove` / `clear` / `stop` already exist. slash↔prefix:
  same `scsearch` module, same reply strings.

## Transition plan

No persisted users, queues, or config. Nothing to map; nothing to keep
across process restart.

Behavior vs a running slice 2 bot: a SoundCloud track URL on `/play`
plays SoundCloud. Operators who never play SoundCloud do not need
ffmpeg and see no YouTube change.

Rollback: run the slice 2 build. No data migration to undo.

## Acceptance criteria

- [ ] `audioFormats` is `["webm/opus", "hls/aac"]`. Engine never
      imports Discord (R1 scan still passes). Engine never spawns
      ffmpeg or depends on `ffmpeg-static`.
- [ ] Public `resolveTrack` accepts optional `source?: "soundcloud"`.
      `openTrackAudio` stays `{ track }`. Router lives in `resolve.ts`.
- [ ] `bun run typecheck` passes workspace-wide.
- [ ] `bun test packages/audio-engine` passes and covers, no network:
      - `pickSource` / host dispatch (SoundCloud URL, YouTube URL,
        bare words, `source: "soundcloud"` + YouTube URL error)
      - SoundCloud URL vs search vs `/sets/` playlist reject
      - top search hit; no search hit
      - `kind !== "track"` reject
      - no HLS audio reject
      - `openSoundCloudAudioWithClient` yields `format: "hls/aac"` and
        the fake HLS segment stream
      - existing YouTube `*WithClient` tests still pass
- [ ] `bun test packages/bot` passes and covers, no network, no Discord
      login:
      - `scsearch` success `Playing:` / `Queued (#n):` and the three
        scene failure modes (not-in-voice, occupied, resolve error)
      - YouTube URL on `scsearch` replies
        `That is not a SoundCloud track.` and does not queue
      - empty `scsearch` usage string
      - `play` usage/description strings include SoundCloud URL
      - `play` still omits `source`; `scsearch` passes
        `source: "soundcloud"`
      - prefix `!scsearch` dispatches the same module
      - `scsearch` while paused enqueues and stays paused
      - first-track SoundCloud play with ffmpeg-miss throws/replies
        `Couldn't play that SoundCloud track: ffmpeg is not installed.`
      - `"webm/opus"` lookup stays `StreamType.WebmOpus`
      - guild registration names include `scsearch`
- [ ] Structure check requires `sources/soundcloud.ts` and
      `commands/scsearch.ts`. `bun run checks:structure` passes.
- [ ] README documents PATH ffmpeg next to the other install steps.
      Bot starts without ffmpeg.
- [ ] No new workspace packages. One new production dependency:
      `soundcloud.ts`. R3 still holds (judge review).
- [ ] First examples table still points at `youtube.ts` and `play.ts`.
- [ ] The named human smoke script below passes in the test guild.

## Open questions

Settled at the grill (2026-08-22 — details in the run file):

- [x] First source cut — **Answer:** SoundCloud tracks only; Spotify
      is not a source (grill decision 1).
- [x] Search command — **Answer:** `scsearch` both doors; `/play`
      search stays YouTube (grill decision 2).
- [x] Resolve shape — **Answer:** optional `source?: "soundcloud"`;
      no second public function (grill decision 3).
- [x] ffmpeg — **Answer:** PATH binary in the bot for `"hls/aac"`;
      YouTube stays zero-transcode (grill decision 4).
- [x] Extractor — **Answer:** `soundcloud.ts`, no operator key
      (grill decision 5).
- [x] Scene and failure modes — **Answer:** walked and confirmed
      (grill decision 6).

Settled while writing this spec (design details; none in ask-first
territory):

- [x] Public router — **Answer:** `resolve.ts` owns the public pair;
      YouTube file keeps `*WithClient`.
- [x] HLS bytes — **Answer:** segment bodies as they arrive, not m3u8
      text, not a full-track buffer. Prefer AAC, then MPEG; one format
      tag `"hls/aac"`.
- [x] Banned library helpers — **Answer:** do not call
      `util.streamTrack` / `downloadTrack` / `m3uReadableStream`.
- [x] Duration — **Answer:** SoundCloud API milliseconds →
      `Math.floor(ms / 1000)`.
- [x] Canonical URI — **Answer:** `permalink_url`.
- [x] Playlist detect — **Answer:** `parseSoundCloudQuery` throws on
      `/sets/` (copy YouTube parse). Resolved `kind !== "track"` still
      rejects shorts that land on a set.
- [x] YouTube URL on `scsearch` — **Answer:**
      `That is not a SoundCloud track.`
- [x] Empty search — **Answer:**
      `No SoundCloud results for that search.`
- [x] Generic SoundCloud failure — **Answer:**
      `Couldn't play that SoundCloud track.`
- [x] ffmpeg-miss — **Answer:** map the spawn error on `"hls/aac"`
      play; no PATH probe; not at startup; pinned message above.
- [x] `scsearch` session — **Answer:** create/bind announce like
      `play`.
- [x] `CommandContext` — **Answer:** unchanged; `scsearch` uses
      `args`.
- [x] Spotify URL on `/play` — **Answer:** still YouTube search this
      slice (later error path).
- [x] First examples — **Answer:** do not mint a second source-module
      or command-module row; copy the slice 1 paths.
- [x] Structure check — **Answer:** require `soundcloud.ts` and
      `scsearch.ts` the week they ship.
- [x] New dependencies / packages — **Answer:** `soundcloud.ts` only;
      grill approved.

## Proof plan

Per the constitution §5 ladder:

- Engine resolve / SoundCloud module → `bun run typecheck` +
  `bun test packages/audio-engine`.
- Bot command/session wiring → typecheck + `bun test packages/bot`.
- Structure and docs → `bun run checks:structure`.
- Seam rules → existing R1/R2 dependency scan inside `bun run checks`.
- Voice + live SoundCloud + ffmpeg → mandatory human smoke (below).
- Every commit through `/check-and-commit`.

Unverifiable (CI cannot prove): audible SoundCloud audio in a real
voice channel; PATH ffmpeg actually transcoding HLS for
`@discordjs/voice`; YouTube still audible with no ffmpeg; live
SoundCloud / YouTube extraction; slash `/scsearch` appearing in the
client. Cloud Agent IPs already fail YouTube InnerTube
(`LOGIN_REQUIRED`); do not treat that as an engine bug. Live
SoundCloud from a Cloud Agent is also unverifiable — the maintainer
runs the smoke.

At ship time this slice stays a draft PR until the smoke below
passes — the judge checks this gate. Spec status stays
`ready-for-plan` until execute; do not invent a third spec-status
value.

Human smoke script (test guild; slice 2 smoke already green):

0. Install ffmpeg on PATH. Start the bot from README. Confirm
   `/scsearch` appears. Confirm `/play` description mentions
   SoundCloud. Confirm the bot started before ffmpeg was a hard
   requirement (restart is fine after install).
1. Join voice. `/play <known SoundCloud track URL>` → bot replies
   `Playing: {title} ({duration})`; audio is audible.
2. `/scsearch <words>` → `Queued (#2):` (or `Playing:` if idle) for a
   SoundCloud title. `/nowplaying` shows that title, elapsed, duration,
   and a wrapped `soundcloud.com` URL.
3. `/play never gonna give you up` → YouTube search still works
   (`Queued` / `Playing` with a YouTube URL on `/nowplaying`).
4. `/skip` advances. Prefix `!scsearch <words>` matches `/scsearch`.
5. From outside voice: `/scsearch <words>` →
   `Join a voice channel first.`; nothing queued.
6. `/scsearch` with a YouTube URL → `That is not a SoundCloud track.`;
   nothing queued.
7. `/play` or `/scsearch` with a SoundCloud set/playlist URL → error;
   nothing queued.
8. `/play <bogus or private SoundCloud URL>` → error; nothing queued.
9. Stop the bot. Hide ffmpeg from PATH. Start the bot (must come
   online). `/play <YouTube URL>` still plays. `/play <SoundCloud
   URL>` →
   `Couldn't play that SoundCloud track: ffmpeg is not installed.`;
   process stays up. Restore ffmpeg.

## Changelog

- 2026-08-22: raptor pass (`.ai/runs/2026-08-22-raptor-slice-3-source-breadth.md`).
  Cut `playlist-url` parse kind, PATH probe, and full-track HLS buffer.
  Status still ready-for-plan. Next: `/plan`.
- 2026-08-22: created from the slice 3 grill (decisions 1–6 carried in
  as settled). Wrote `.ai/research/soundcloud-platform.md`. Settled the
  writing-time details listed in Open questions. Status:
  ready-for-plan.
