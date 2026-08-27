# Slice 4 — Playlists and streams

**Status:** ready-for-plan
**Research:** `.ai/research/playlists-and-streams.md` (playlist expand,
HTTP radio). `.ai/research/discord-and-youtube-platform.md` (same Discord
surface). `.ai/research/soundcloud-platform.md` (HLS bytes stay in the
engine; ffmpeg stays in the bot).
**Grill:** N/A — autonomous mode (no human). Resolutions are marked
**Autonomous** in Open questions.
**Raptor:** `.ai/runs/2026-08-27-raptor-slice-4-playlists-and-streams.md`
**Depends on:** `.ai/specs/2026-08-22-slice-3-source-breadth.md` (copy
`youtube.ts`, `soundcloud.ts`, `play.ts`; SoundCloud sets were deferred
here) and `.ai/specs/2026-08-11-slice-1-core-playback.md` (widen
`resolveTrack`).

## Problem

Slice 3 plays one YouTube or SoundCloud track. A playlist URL still
errors. HTTP radio is treated as a YouTube search. JMusicBot-class UX
needs playlist URLs to fill the queue and radio/streams to play, skip,
and stop without a second product.

## Goals

- A user in voice plays a YouTube playlist URL or a SoundCloud set URL
  through existing `/play` (and `!play`). The first playable track
  starts if idle; the rest enqueue. The bot replies that it added N
  tracks.
- An HTTP radio/stream URL (progressive audio) plays as one live item
  (`durationSeconds: 0`). Skip ends it and advances. Stop leaves. Pause
  stays paused.
- Engine `resolveTrack` returns multiple tracks or one stream track.
  Cap 1000. No new command, package, or production dependency.

## Non-goals

- Bandcamp, Vimeo, Twitch, local files, Spotify (still not a source).
- Local `Playlists/` folder, `/play playlist`, `/playlists` — that is
  the separate playlist product architecture marks Out.
- YouTube Mix autoplay without a playlist URL. Watch URLs with `v=` and
  `list=` stay one video.
- HLS radio (`m3u8`), M3U/PLS-of-URLs, Icecast metadata display, a
  `LIVE` duration label.
- Search picker. DJ roles. Persistence. New workspace packages.
- ffmpeg in `packages/audio-engine`. `ffmpeg-static`. An opus encoder.
- A second public resolve function. A plugin registry.
- Permanent cuts stand: no dashboard, no SaaS, no JVM, no remote player
  protocol, no public engine release.

## Design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| First cut | YouTube playlist URLs, SoundCloud sets, progressive HTTP streams. | Architecture In. SoundCloud sets were parked here. Not every playlist site. Research. |
| Play door | Existing `/play` and `!play`. No `/playlist` command. | JMusicBot loads lists on play. Architecture Out: separate playlist product. |
| Resolve shape | `resolveTrack` returns `ResolveResult { tracks, playlistTitle }`. `openTrackAudio` stays `{ track }`. | Slice 1 promised one signature widen. One public pair. |
| Playlist cap | 1000 tracks. Truncate; reply notes the cap when truncated. | JMusicBot `maxytplaylistpages = 10`. Mix continuations must stop. |
| Watch + list | `v=` wins; play that one video. Expand only when there is a `list` and no video id (including `/playlist`). | Keeps slice 1 watch URLs. Research. |
| HTTP detect | Audio file extension → stream. Else HEAD; audio `Content-Type` → stream. Else YouTube search. | Random web pages must still YouTube-search (slice 1). |
| HTTP format | Grow `audioFormats` with `"http/mpeg"`. Bot maps it to `StreamType.Arbitrary` (PATH ffmpeg). | New member earns keep; not HLS. Same Arbitrary arm as `"hls/aac"`. |
| Stream track | One `Track`, `durationSeconds: 0`, `playlistTitle: null`. Title from `icy-name`, else path segment, else host. | Skip/stop already operate on current. No `isLive` field. |
| HLS radio / M3U | Out. | Extra parsers; progressive Icecast is the hearable cut. |
| Scene | Happy path and three failure modes below. | Client-touching slice. |
| Scoping | Same in-memory `Map<guildId, GuildMusicSession>`. No new store. | Constitution scoping axis. |
| Hard rules | R1: no Discord in the engine; ffmpeg stays bot-side. R2: bot → engine. R3: zero Java. R4: UX parity; do not copy JMusicBot internals. | Same scan as slice 1. |
| Pattern to copy | `youtube.ts`, `soundcloud.ts`, `play.ts`. New `http.ts` copies the injectable-client seam. No new First examples row. | Second/third instance copies. |
| Proof | Typecheck + `bun test` both app packages + named human smoke for voice, playlists, and radio. Structure check grows `http.ts`. | Constitution §5. |
| Frozen surfaces | None. | `BACKWARD_COMPATIBILITY.md` is empty. |
| Ask first | No new production dependency. No new packages. No persistence. `youtubei.js` and `soundcloud.ts` already approved. | AGENTS ask-first not crossed. |
| Out of scope | See Non-goals. | |
| Symmetric ops | Playlist add uses `play` / `scsearch`; `remove` / `clear` / `skip` / `stop` already exist. No unlist for a playlist. | |
| Client / platform | Copy slice 1–3: slash defers; prefix channel message; guild PUT unchanged (no new slash name); mention suppress; public replies. | Same Discord surface. |
| Transition | No persisted state. Playlist URLs that used to error now enqueue. HTTP audio URLs that used to YouTube-search now play as streams. | |
| Unverifiable | Live playlist expand, audible radio, skip/stop on a live stream. Named smoke below. | CI has no Discord voice. Cloud Agent YouTube is blocked. |
| Raptor refuse | No `/playlist` command, no local playlist folder, no M3U/PLS expand, no HLS radio, no `isLive`, no `LIVE` label, no `enqueueAll` on `TrackQueue`, no shared `executePlay`, no second resolve function, no new deps/packages. | Raptor run. |

## Behavior

Copy slices 1–3 unless this section replaces them.

### Seam (engine)

```typescript
export const audioFormats = ["webm/opus", "hls/aac", "http/mpeg"] as const;

export interface Track {
  readonly title: string;
  readonly uri: string;
  readonly durationSeconds: number;
}

export interface ResolveResult {
  readonly tracks: readonly Track[];
  readonly playlistTitle: string | null;
  readonly truncated: boolean;
}

export function resolveTrack(input: {
  readonly query: string;
  readonly source?: "soundcloud";
}): Promise<ResolveResult>;

export function openTrackAudio(input: {
  readonly track: Track;
}): Promise<TrackAudio>;
```

`truncated` is `true` only when a playlist had more than 1000 playable
tracks and the engine kept the first 1000.

Single video, search hit, or HTTP stream: `tracks` length 1,
`playlistTitle` null, `truncated` false.

Empty playable list → `TrackResolveError`:
`That playlist has no playable tracks.`

### Cap

```typescript
export const MAX_PLAYLIST_TRACKS = 1000;
```

Lives in `packages/audio-engine/src/track.ts`. Both source modules use it.

### Host dispatch (`resolve.ts`)

`pickSource` grows `"http"`:

| Input | Result |
|-------|--------|
| `source === "soundcloud"` and query is a YouTube URL | `That is not a SoundCloud track.` |
| `source === "soundcloud"` otherwise | SoundCloud module |
| `source` omitted, SoundCloud URL | SoundCloud module |
| `source` omitted, YouTube URL | YouTube module |
| `source` omitted, `http(s)` URL that is not YouTube or SoundCloud | HTTP module (may fall back to YouTube) |
| else | YouTube module (search) |

HTTP module: if the URL is a stream, return one track. If it is not
(HEAD not audio, HEAD failed, and no audio extension), call the YouTube
module with the same query (slice 1 search-the-URL behavior).

`openTrackAudio` routes on `track.uri`: SoundCloud host → SoundCloud;
YouTube host → YouTube; other `http(s)` → HTTP. Unknown →
`Couldn't play that track.`

### YouTube module

`parseYoutubeQuery` gains `playlist-id`:

- Video id present → `video-id` (watch + `list=` stays one video).
- YouTube host, no video id, `list` param non-empty → `playlist-id`.
- Path `/playlist` with empty or missing `list` →
  `That playlist has no playable tracks.`
- Else search.

`YoutubeClient` grows:

```typescript
getPlaylist(playlistId: string): Promise<{
  readonly title: string;
  readonly videos: readonly {
    readonly videoId: string;
    readonly title: string;
    readonly durationSeconds: number;
    readonly isPlayable: boolean;
  }[];
}>;
```

Default client: `innertube.getPlaylist(id)`, keep `PlaylistVideo` items
with a video id, follow `getContinuation()` until `MAX_PLAYLIST_TRACKS`
or no continuation. Do not call `getInfo` / `getVideo` per item.

`resolveTrackWithClient` returns `ResolveResult`:

- `video-id` / search → wrap the existing one-track path:
  `{ tracks: [track], playlistTitle: null, truncated: false }`.
- `playlist-id` → `getPlaylist`; drop items with `isPlayable === false`
  or empty `videoId`; map the rest to
  `{ title, uri: canonicalWatchUri(videoId), durationSeconds }`;
  slice to 1000; `playlistTitle` is the playlist title (empty string
  becomes `"playlist"`); `truncated` if more than 1000 playable items
  were seen. Zero playable → `That playlist has no playable tracks.`
- Other playlist failures → `Couldn't play that playlist.`

`openTrackAudioWithClient` unchanged (still one watch URL).

### SoundCloud module

`parseSoundCloudQuery` gains `playlist-url` instead of throwing on
`/sets/`.

`SoundCloudClient` grows:

```typescript
getPlaylist(url: string): Promise<{
  readonly title: string;
  readonly tracks: readonly {
    readonly title: string;
    readonly permalinkUrl: string;
    readonly durationSeconds: number;
    readonly hasHlsAudio: boolean;
  }[];
}>;
```

Default client: `soundcloud.playlists.get(url)`. Map `tracks` with
`kind === "track"` (or missing kind treated as track). Keep HLS audio
only. Same duration ms → seconds as slice 3. Never call
`util.streamTrack` / `downloadTrack`.

`resolveSoundCloudTrackWithClient` returns `ResolveResult`:

- `track-url` / search → wrap one track as YouTube does. `kind ===
  "playlist"` on `getTrack` (short link that landed on a set) → call
  `getPlaylist` on that permalink instead of throwing.
- `playlist-url` → `getPlaylist`; drop `hasHlsAudio === false`; cap
  1000; same `playlistTitle` / `truncated` / empty error as YouTube.
- Other set failures → `Couldn't play that playlist.`

`openSoundCloudAudioWithClient` unchanged.

### HTTP module (`sources/http.ts`)

Copy the injectable-client seam from `youtube.ts`.

```typescript
export interface HttpStreamClient {
  probe(url: string): Promise<{
    readonly isAudio: boolean;
    readonly contentType: string | null;
    readonly icyName: string | null;
  }>;
  openBody(url: string): Promise<ReadableStream<Uint8Array>>;
}

export function parseHttpQuery(
  query: string,
): { readonly kind: "http-url"; readonly url: string } | null;

export function resolveHttpStreamWithClient(
  input: { readonly query: string },
  client: HttpStreamClient,
): Promise<ResolveResult>;

export function openHttpAudioWithClient(
  input: { readonly track: Track },
  client: HttpStreamClient,
): Promise<TrackAudio>;
```

`parseHttpQuery`: trimmed `http:` or `https:` URL that is not a
YouTube or SoundCloud host → `{ kind: "http-url", url }`. Else `null`.

Audio extension (pathname, lowercase, ignore query): `.mp3`, `.aac`,
`.ogg`, `.opus`, `.m4a`. Those skip probe and resolve as a stream.

Otherwise `probe` (HEAD). `isAudio` when `Content-Type` starts with
`audio/mpeg`, `audio/mp3`, `audio/aac`, `audio/ogg`, `audio/opus`,
`audio/mp4`, or equals `application/ogg` (ignore parameters after `;`).
If not audio, `resolveHttpStreamWithClient` throws a dedicated
`TrackResolveError` with message `NOT_HTTP_STREAM` that **only**
`resolve.ts` catches to fall back to YouTube. Do not show that string
to users.

Default `probe`: HEAD, 5s abort. Network/timeout → not audio (fall
back). Default `openBody`: GET the URL, yield the body stream. Do not
buffer the whole resource.

Title: `icyName` if non-empty, else last path segment without
extension, else hostname. URI is the request URL. `durationSeconds: 0`.

`openHttpAudioWithClient` returns `{ stream, format: "http/mpeg" }`.
Open failure → `Couldn't play that stream.`

Do not parse m3u8. Do not spawn ffmpeg.

### Bot format lookup

```typescript
const playbackInputByFormat: { readonly [K in AudioFormat]: StreamType } = {
  "webm/opus": StreamType.WebmOpus,
  "hls/aac": StreamType.Arbitrary,
  "http/mpeg": StreamType.Arbitrary,
};
```

On `"http/mpeg"` play, missing ffmpeg →
`Couldn't play that stream: ffmpeg is not installed.`
`"hls/aac"` keeps the slice 3 SoundCloud ffmpeg-miss string.
No PATH probe. No `ffmpeg-static`. YouTube still needs no ffmpeg.

Export `mapHttpPlayError` next to `mapHlsPlayError` (copy). `play`
uses the mapper that matches `audio.format`.

### `EnginePort` and session

```typescript
resolveTrack(input: {
  readonly query: string;
  readonly source?: "soundcloud";
}): Promise<ResolveResult>;
```

`playNow` / `enqueue` stay one track. The play command loops `enqueue`
for extra tracks. Do not add `enqueueAll` on `TrackQueue`.

### `play` command

`resolveTrack({ query: ctx.args })` (no source hint). Usage /
description also mention playlist URLs and stream URLs:

- Usage: `Usage: /play <YouTube, SoundCloud, playlist, or stream URL, or YouTube search words>`
- Slash description: `Play a URL (video, playlist, set, or stream) or YouTube search words.`

After resolve:

1. Zero tracks cannot happen (engine throws).
2. If idle: `playNow(tracks[0])`; enqueue `tracks.slice(1)`. If
   `playNow` throws, reply the error and do not enqueue the rest.
3. If current: enqueue every track (stay paused if paused).
4. Reply:
   - `playlistTitle === null` and one track: existing `Playing:` /
     `Queued (#n):` strings.
   - `playlistTitle !== null`: if idle, first line is `Playing:` for
     `tracks[0]`; then `Added {n} tracks from {playlistTitle}.` If
     `truncated`, append ` (capped at 1000).` If occupied, only the
     Added line (no Playing). `{n}` is `tracks.length`.

### `scsearch` command

Same `ResolveResult` unwrap. A set URL on `scsearch` expands. A YouTube
playlist URL still fails `That is not a SoundCloud track.` Search words
still return one track. Copy the Added-line reply from `play.ts`. Do
not share `executePlay`.

Fallback non-`TrackResolveError` strings unchanged.

### Dispatch and registration

No new slash name. Guild PUT unchanged. Session create still `play` or
`scsearch`.

### README

`/play` line: playlist URLs (YouTube playlist, SoundCloud set) and
HTTP stream URLs. ffmpeg Need: SoundCloud **or** HTTP streams. Bot
still starts without ffmpeg. YouTube video play still needs no ffmpeg.

### Package layout (adds)

```text
packages/audio-engine/src/
  track.ts                 audioFormats + ResolveResult + MAX_PLAYLIST_TRACKS
  resolve.ts               pickSource + http + ResolveResult
  sources/youtube.ts       playlist-id parse + getPlaylist
  sources/soundcloud.ts    playlist-url parse + getPlaylist
  sources/http.ts          HTTP stream module
packages/bot/src/
  discord-voice.ts         "http/mpeg" → Arbitrary; ffmpeg-miss
  guild-music-session.ts   EnginePort.resolveTrack → ResolveResult
  commands/play.ts         Added N tracks reply
  commands/scsearch.ts     same unwrap
packages/checks/configs/structure.ts
  engine-source-module requiredFiles += http.ts
```

No new workspace packages. First examples table unchanged.

## Scene

Happy path: a user is in voice. `/play <YouTube playlist URL>` defers
then `Playing: {first} ({duration})\nAdded {n} tracks from {title}.`
Audio is the first track. `/queue` lists upcoming. `/skip` plays the
next playlist item. `/play <SoundCloud set URL>` adds that set.
`/play <Icecast or mp3 URL>` → `Playing: {name} (0:00)`; audio is
audible (ffmpeg on PATH). `/skip` ends the stream and starts the next
queued item (or empties). `/stop` leaves. Prefix `!play` matches.
`/play never gonna give you up` still searches YouTube. A watch URL
with `&list=` still plays that one video.

Baked-in:

- No new slash command. `/play` description mentions playlist and
  stream URLs.
- Slash defers; prefix channel message; mention suppress; public
  replies; same invite.
- ffmpeg not required to start or to play YouTube.
- Missing ffmpeg on HTTP stream:
  `Couldn't play that stream: ffmpeg is not installed.`
- Empty or private playlist → error; nothing queued.
- Web page URL without audio type → YouTube search (slice 1).

Failure modes:

1. Invoker not in voice → `Join a voice channel first.` Occupied
   other channel → `Already playing in #channel — join there.`
2. Empty/private playlist, or a playlist with no playable items →
   error reply, nothing added. Dead item mid-queue →
   `Skipping {title}: couldn't play it` and advance (slice 1).
3. HTTP stream with ffmpeg missing → stream ffmpeg-miss string; YouTube
   still plays; process stays up. HEAD says not audio → YouTube search
   (may then fail as a search).

If Discord voice drops: slice 2 stands. Current dropped; queue
survives (including remaining playlist tracks). Next `/play` rejoins.

## Client / platform contract

- **ACK timing:** slash defers at receipt (playlist resolve can exceed
  3s). Prefix: channel message. All replies public.
- **Registration:** no new names. Existing guild bulk PUT.
- **Naming and sanitize:** mention suppress; playlist titles are
  untrusted text. `/queue` still caps 10 lines.
- **Permissions:** same invite as slice 1. ffmpeg is an operator
  install.
- **Rate limits:** none extra. Cap 1000 avoids huge replies (Added line
  is one sentence).
- **Ledger-vs-reply-vs-mirror:** N/A.
- **Symmetric ops:** add via play; remove/clear/skip/stop already
  exist. slash↔prefix: same play module.

## Transition plan

No persisted users, queues, or config.

Behavior vs slice 3: YouTube `/playlist` and SoundCloud `/sets/` enqueue
instead of error. Direct audio HTTP URLs play as streams instead of
YouTube search. Watch+list and YouTube search are unchanged.

Rollback: run the slice 3 build. No data migration.

## Acceptance criteria

- [ ] `audioFormats` is `["webm/opus", "hls/aac", "http/mpeg"]`. Engine
      never imports Discord. Engine never spawns ffmpeg or depends on
      `ffmpeg-static`.
- [ ] `resolveTrack` returns `ResolveResult`. `openTrackAudio` stays
      `{ track }`. `MAX_PLAYLIST_TRACKS` is 1000.
- [ ] `bun run typecheck` passes workspace-wide.
- [ ] `bun test packages/audio-engine` passes and covers, no network:
      - YouTube `playlist-id` vs `video-id` (watch+list stays video)
      - YouTube playlist expand, empty playlist, cap+truncated
      - SoundCloud `/sets/` expand, empty set, `getTrack` kind
        playlist follows `getPlaylist`
      - HTTP audio extension → stream `durationSeconds: 0`
      - HTTP probe not audio → `NOT_HTTP_STREAM` (router falls back)
      - `openHttpAudioWithClient` yields `format: "http/mpeg"`
      - existing one-track YouTube / SoundCloud tests still pass
        (wrapped `ResolveResult`)
- [ ] `bun test packages/bot` passes and covers, no network, no Discord
      login:
      - idle playlist: `Playing:` + `Added N tracks from {title}.`;
        first `playNow`, rest enqueued
      - occupied playlist: only Added line; all enqueued
      - truncated: `(capped at 1000).`
      - playNow failure on first playlist track: error reply; nothing
        enqueued
      - single video still `Playing:` / `Queued (#n):` (no Added line)
      - HTTP stream ffmpeg-miss message
      - `"http/mpeg"` lookup is `StreamType.Arbitrary`
      - `scsearch` unwraps `ResolveResult`; YouTube URL still rejected
      - paused playlist enqueue stays paused
- [ ] Structure check requires `sources/http.ts`.
      `bun run checks:structure` passes.
- [ ] README mentions playlist URLs, HTTP streams, and ffmpeg for
      SoundCloud or streams. Bot starts without ffmpeg.
- [ ] No new workspace packages. No new production dependencies.
- [ ] First examples table still points at `youtube.ts` and `play.ts`.
- [ ] The named human smoke script below passes in the test guild.

## Open questions

Autonomous (no human; codebase + research + recommended take):

- [x] First cut inventory — **Autonomous:** YouTube playlists,
      SoundCloud sets, progressive HTTP streams. SoundCloud sets were
      parked here. HTTP streams earn skip/stop without a new dep.
      Bandcamp/Twitch/local wait. HLS radio and M3U/PLS cut (extra
      parsers).
- [x] Resolve return — **Autonomous:** widen `resolveTrack` to
      `ResolveResult { tracks, playlistTitle, truncated }`. Slice 1
      promised one signature change. No second public function.
- [x] Cap — **Autonomous:** 1000, matching JMusicBot default. Mix
      continuations must stop.
- [x] Watch URL with `list=` — **Autonomous:** keep one video (`v=`
      wins). Expand `/playlist` and list-without-video only.
- [x] HTTP detection — **Autonomous:** audio extension or HEAD audio
      type; else YouTube search so random pages stay slice 1.
- [x] HTTP format — **Autonomous:** `"http/mpeg"` + Arbitrary. Not
      reuse `"hls/aac"` (different bytes).
- [x] Stream metadata — **Autonomous:** `durationSeconds: 0`; no
      `isLive`; display stays `0:00`. Title from icy-name / path / host.
- [x] Reply — **Autonomous:** `Added {n} tracks from {title}.` plus
      `Playing:` when idle. Cap note when truncated. No title dump
      (queue already lists 10).
- [x] `scsearch` + set URL — **Autonomous:** expand (same
      `ResolveResult`). YouTube playlist on scsearch still rejected.
- [x] Session API — **Autonomous:** keep one-track `playNow` /
      `enqueue`; command loops. No `TrackQueue.enqueueAll`.
- [x] New deps / packages — **Autonomous:** none. Not ask-first.
- [x] First examples — **Autonomous:** do not mint a row; `http.ts`
      copies `youtube.ts`. Structure check requires `http.ts` the week
      it ships.

## Proof plan

Per constitution §5:

- Engine resolve / playlist / HTTP → `bun run typecheck` +
  `bun test packages/audio-engine`.
- Bot command/session wiring → typecheck + `bun test packages/bot`.
- Structure and docs → `bun run checks:structure`.
- Seam → `bun run checks` (`engine-seam`).
- Voice + live playlist + live radio → mandatory human smoke (below).
- Every commit through `/check-and-commit`.

Unverifiable (CI cannot prove): audible playlist playback in a real
voice channel; live YouTube/SoundCloud playlist expand; audible HTTP
radio; skip/stop on a live stream; PATH ffmpeg for `"http/mpeg"`;
YouTube still audible with no ffmpeg; slash description text in the
client. Cloud Agent IPs fail YouTube InnerTube (`LOGIN_REQUIRED`); do
not treat that as an engine bug. The maintainer runs the smoke.

At ship time this slice stays a draft PR until the smoke below
passes. Spec status stays `ready-for-plan` until execute; do not
invent a third spec-status value.

Human smoke script (test guild; slice 3 smoke already green):

0. Install ffmpeg on PATH. Start the bot from README. Confirm `/play`
   description mentions playlist or stream URLs. Confirm the bot starts
   without ffmpeg being a hard requirement (restart is fine after
   install).
1. Join voice. `/play <known YouTube playlist URL>` (a `/playlist?list=`
   URL, not a watch URL) → `Playing: {first}` and `Added {n} tracks from
   {title}.` Audio is the first track. `/queue` shows upcoming playlist
   items.
2. `/skip` → next playlist item plays (`Now playing:`). Prefix
   `!play <same class of playlist URL>` matches.
3. `/play <known SoundCloud set URL containing /sets/>` → Added line
   (or Playing + Added if idle). A track from the set is audible.
4. `/play https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL...` (any
   real watch URL that also has `list=`) → one `Playing:` / `Queued`
   line for that video, not an Added-N playlist expand.
5. `/play never gonna give you up` → YouTube search still works.
6. `/play <known Icecast or direct mp3 URL>` → `Playing: {name} (0:00)`;
   audio is audible. `/nowplaying` shows elapsed / `0:00` and the
   wrapped URL. `/skip` ends the stream (next queued item or empty).
   `/stop` leaves.
7. From outside voice: `/play <playlist URL>` →
   `Join a voice channel first.`; nothing queued.
8. `/play <empty or private playlist URL>` → error; nothing queued.
9. `/play https://example.com` → YouTube search (not a stream error).
10. Stop the bot. Hide ffmpeg from PATH. Start the bot (must come
    online). `/play <YouTube video URL>` still plays. `/play <http
    stream URL>` →
    `Couldn't play that stream: ffmpeg is not installed.`; process
    stays up. Restore ffmpeg.

## Changelog

- 2026-08-27: created in autonomous spec-writing (no grill). Raptor
  pass in `.ai/runs/2026-08-27-raptor-slice-4-playlists-and-streams.md`.
  Status: ready-for-plan.
