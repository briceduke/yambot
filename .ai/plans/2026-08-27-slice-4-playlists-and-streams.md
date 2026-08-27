# Slice 4 playlists and streams — implementation plan

**Spec:** `.ai/specs/2026-08-27-slice-4-playlists-and-streams.md`
**Research:** `.ai/research/playlists-and-streams.md`
**Raptor:** `.ai/runs/2026-08-27-raptor-slice-4-playlists-and-streams.md`
**Branch:** `cursor/slice-4-playlists-and-streams-957a`
**Status:** approved
**Ordering:** shared foundation required — `ResolveResult` must exist before HTTP routing and bot Added-N UX. After Task 1, HTTP engine and play UX are disjoint.
**Lessons:** `engine-seam`, `product`, `process`, `platform`

Worker digest (do not read `.ai/lessons.md`):
- R1: `packages/audio-engine` never imports Discord. R2: bot → engine only. R3: no Java/JVM/Lavalink/lavaplayer. R4: UX parity, do not copy JMusicBot internals.
- Copy `packages/audio-engine/src/sources/youtube.ts`, `soundcloud.ts`, and `packages/bot/src/commands/play.ts`. Do not mint a new First examples row.
- No engine ffmpeg, no `ffmpeg-static`, no `util.streamTrack` / `downloadTrack`. PATH ffmpeg stays in the bot.
- No new production dependency. No new workspace package. No persistence.
- Proof trichotomy: live playlist/radio/voice is unverifiable in CI. Workers never edit `.ai/plans/`. Commit only through parent `/check-and-commit`.

## Progress

- [x] Task 1: Widen resolve and expand YouTube / SoundCloud playlists
- [x] Task 2: Add the HTTP stream source module
- [x] Task 3: Add Added-N play UX
- [ ] Task 4: Map `http/mpeg` to PATH ffmpeg
- [ ] Task 5: Grow the structure check and README
- [ ] Task 6: Final scoped proof

## Parallel groups

### Group A
**Depends on:** none
**Tasks:** 1
**Files disjoint:** n/a (single task)
**Workers:** parent agent (card: `.ai/plans/2026-08-27-slice-4-playlists-and-streams/task-1.md`)

### Group B
**Depends on:** Group A
**Tasks:** 2, 3
**Files disjoint:** yes
**Workers:** fan out one subagent per task (cards: `task-2.md`, `task-3.md`)

### Group C
**Depends on:** Group B
**Tasks:** 4, 5
**Files disjoint:** yes
**Workers:** fan out one subagent per task (cards: `task-4.md`, `task-5.md`)

### Group D
**Depends on:** Tasks 2, 3, 4, 5
**Tasks:** 6
**Files disjoint:** n/a (single task)
**Workers:** parent agent

## Dependencies

Task 1 adds `ResolveResult` and playlist expand on the two existing source modules. Task 2 needs that return type and adds `"http/mpeg"` plus `http.ts`. Task 3 needs `ResolveResult` on the bot port and does not touch engine files. Task 4 needs the new format member. Task 5 needs `http.ts` on disk and play copy. Task 6 is final proof.

## Global out of scope

- Bandcamp, Vimeo, Twitch, local files, Spotify, local `Playlists/` folder
- `/playlist` command, HLS radio, M3U/PLS-of-URLs, `isLive`, `LIVE` label
- `TrackQueue.enqueueAll`, shared `executePlay`, second public resolve function
- ffmpeg / `ffmpeg-static` in the engine; new production dependencies; new packages
- Java, JVM, Lavalink, lavaplayer, dashboard, SaaS, remote player protocol

## Global escape hatches

- If `youtube.ts`, `soundcloud.ts`, or `play.ts` is missing, STOP.
- If a task would add a Discord import inside `packages/audio-engine`, spawn ffmpeg from the engine, add `ffmpeg-static`, or add a workspace package, STOP.
- If `bun add` would pull a Java/JVM package, STOP.
- If two in-flight tasks would edit the same file, STOP.
- If `youtubei.js` has no `getPlaylist` or `soundcloud.ts` has no `playlists.get`, STOP.

## Proof (automated vs unverifiable)

Automated (Task 6 plus per-task Verify): `bun run checks`, `bun run typecheck`, `bun test packages/audio-engine`, `bun test packages/bot`.

Unverifiable in CI (human smoke in the spec § Proof plan, steps 0–10): live playlist expand, audible radio, skip/stop on a stream, ffmpeg for HTTP, YouTube without ffmpeg. Cloud Agent YouTube InnerTube is blocked — not an engine bug. Ship stays a draft PR until that script passes.

---

## Task 1: Widen resolve and expand YouTube / SoundCloud playlists

**Depends on:** none
**Spec:** `.ai/specs/2026-08-27-slice-4-playlists-and-streams.md` § Seam, § YouTube module, § SoundCloud module, § Host dispatch (playlist routing only)
**Files:**
- Modify: `packages/audio-engine/src/track.ts` — `ResolveResult`, `MAX_PLAYLIST_TRACKS`
- Modify: `packages/audio-engine/src/index.ts` — export `ResolveResult`, `MAX_PLAYLIST_TRACKS`
- Modify: `packages/audio-engine/src/sources/youtube.ts` — `playlist-id`, `getPlaylist`, return `ResolveResult`
- Modify: `packages/audio-engine/src/sources/youtube.test.ts`
- Modify: `packages/audio-engine/src/sources/soundcloud.ts` — `playlist-url`, `getPlaylist`, return `ResolveResult`
- Modify: `packages/audio-engine/src/sources/soundcloud.test.ts`
- Modify: `packages/audio-engine/src/resolve.ts` — public pair returns `ResolveResult`
- Modify: `packages/audio-engine/src/resolve.test.ts`
- Copy from (first example): `packages/audio-engine/src/sources/youtube.ts`

**Steps:**
1. Add `MAX_PLAYLIST_TRACKS = 1000` and `ResolveResult` to `track.ts`. Do not add `"http/mpeg"` (Task 2).
2. Change `resolveTrackWithClient` / `resolveSoundCloudTrackWithClient` / `resolveTrackWithClients` / `resolveTrack` to return `ResolveResult`. Wrap one-track paths as `{ tracks: [track], playlistTitle: null, truncated: false }`.
3. YouTube: `parseYoutubeQuery` adds `playlist-id` when there is a `list` param and no video id. Watch+`list=` stays `video-id`. `/playlist` with no list throws `That playlist has no playable tracks.` Implement `getPlaylist` on the default client via `innertube.getPlaylist` + continuation up to 1000. Skip `isPlayable === false`. Empty → that same error. Other failures → `Couldn't play that playlist.` Empty title → `"playlist"`.
4. SoundCloud: `/sets/` is `playlist-url`. Add `getPlaylist` wrapping `playlists.get`. `getTrack` `kind === "playlist"` calls `getPlaylist`. Drop `hasHlsAudio === false`. Same cap/title/empty errors. Never call `util.streamTrack` / `downloadTrack`.
5. Tests with fakes only: watch+list stays video; playlist expand; empty; cap+truncated; SoundCloud set expand; short-link kind playlist; existing one-track tests wrap `ResolveResult`.

**Verify:**
```bash
bun test packages/audio-engine
bun run --cwd packages/audio-engine typecheck
```
Expected: tests exit 0 with 0 fail. Typecheck exits 0. No `"http/mpeg"` yet.

**Out of scope:**
- `packages/bot/**`, `http.ts`, `"http/mpeg"`, structure check, README

**Escape hatches:**
- If `getPlaylist` is missing on Innertube, STOP.
- If `playlists.get` is missing on `soundcloud.ts`, STOP.

---

## Task 2: Add the HTTP stream source module

**Depends on:** 1
**Spec:** `.ai/specs/2026-08-27-slice-4-playlists-and-streams.md` § HTTP module, § Host dispatch (http + fallback)
**Files:**
- Modify: `packages/audio-engine/src/track.ts` — `audioFormats` gains `"http/mpeg"`
- Create: `packages/audio-engine/src/sources/http.ts`
- Create: `packages/audio-engine/src/sources/http.test.ts`
- Modify: `packages/audio-engine/src/resolve.ts` — `pickSource` `"http"`; fallback to YouTube
- Modify: `packages/audio-engine/src/resolve.test.ts`
- Copy from (first example): `packages/audio-engine/src/sources/youtube.ts`

**Steps:**
1. Set `audioFormats` to `["webm/opus", "hls/aac", "http/mpeg"] as const`.
2. Copy the injectable-client seam. Export `HttpStreamClient`, `parseHttpQuery`, `resolveHttpStreamWithClient`, `openHttpAudioWithClient`, `getDefaultHttpStreamClient`. Export `NOT_HTTP_STREAM` (constant string) for the router. Do not export public `resolveTrack`.
3. Implement parse, probe/extension, title, open body, and errors as spec § HTTP module. No m3u8 parse. No ffmpeg. 5s HEAD abort on the default client.
4. `pickSource` returns `"http"` for `http(s)` that is not YouTube or SoundCloud. `resolveTrackWithClients`: on `NOT_HTTP_STREAM`, call the YouTube client with the same query. `openTrackAudioWithClients` routes other `http(s)` URIs to HTTP.
5. Tests: audio extension → one track duration 0; probe not audio → `NOT_HTTP_STREAM`; open yields `"http/mpeg"`; resolve router falls back to YouTube for `https://example.com`.

**Verify:**
```bash
bun test packages/audio-engine/src/sources/http.test.ts packages/audio-engine/src/resolve.test.ts
bun run --cwd packages/audio-engine typecheck
```
Expected: tests exit 0 with 0 fail. Typecheck exits 0. `audioFormats` includes `"http/mpeg"`.

**Out of scope:**
- `packages/bot/**`, YouTube/SoundCloud playlist logic, structure check, README

**Escape hatches:**
- If Task 1 did not export `ResolveResult`, STOP.
- If adding HTTP would require a new npm dependency, STOP — use `fetch`.

---

## Task 3: Add Added-N play UX

**Depends on:** 1
**Spec:** `.ai/specs/2026-08-27-slice-4-playlists-and-streams.md` § `play` command, § `scsearch` command, § EnginePort
**Files:**
- Modify: `packages/bot/src/guild-music-session.ts` — `EnginePort.resolveTrack` returns `ResolveResult`
- Modify: `packages/bot/src/guild-music-session.test.ts` — fake return type
- Modify: `packages/bot/src/commands/play.ts` — usage/description; Added-N replies
- Modify: `packages/bot/src/commands/play.test.ts`
- Modify: `packages/bot/src/commands/scsearch.ts` — unwrap `ResolveResult`
- Modify: `packages/bot/src/commands/scsearch.test.ts`
- Modify: `packages/bot/src/commands/stop.test.ts` — fake return type if needed
- Modify: `packages/bot/src/doors.test.ts` — fake return type if needed
- Copy from (first example): `packages/bot/src/commands/play.ts`

**Steps:**
1. `EnginePort.resolveTrack` returns `Promise<ResolveResult>`. Import the type from `@yambot/audio-engine`. Update fakes that implement `EnginePort`.
2. `play.ts`: usage/description as spec. After resolve, idle → `playNow(tracks[0])` then enqueue rest; occupied → enqueue all; stay paused. Replies as spec (`Playing:` + `Added N tracks from {title}.`; truncated suffix; single track without playlistTitle keeps old strings). If `playNow` throws, do not enqueue rest.
3. `scsearch.ts`: same unwrap and Added-N replies. Still passes `source: "soundcloud"`. YouTube URL error path unchanged.
4. Tests: idle playlist Playing+Added and enqueue rest; occupied only Added; truncated; playNow fail nothing enqueued; single video no Added line; paused stays paused; scsearch set expand; scsearch YouTube URL still rejected.

**Verify:**
```bash
bun test packages/bot/src/commands/play.test.ts packages/bot/src/commands/scsearch.test.ts packages/bot/src/guild-music-session.test.ts
bun run --cwd packages/bot typecheck
```
Expected: tests exit 0 with 0 fail. Typecheck exits 0. Root typecheck may still fail until Task 4 if `"http/mpeg"` exists without a bot lookup arm — if Task 2 landed first, Task 4 must land before workspace typecheck. This Verify is package-scoped; do not fail this task on missing `"http/mpeg"` lookup unless this task added that format (it must not).

**Out of scope:**
- `discord-voice.ts`, `http.ts`, structure check, README, `TrackQueue`

**Escape hatches:**
- If `ResolveResult` is not exported from `@yambot/audio-engine`, STOP.
- If `play.ts` export names differ, copy the names that exist.

---

## Task 4: Map `http/mpeg` to PATH ffmpeg

**Depends on:** 2
**Spec:** `.ai/specs/2026-08-27-slice-4-playlists-and-streams.md` § Bot format lookup
**Files:**
- Modify: `packages/bot/src/discord-voice.ts` — lookup arm + HTTP ffmpeg-miss
- Modify: `packages/bot/src/discord-voice.test.ts`
- Copy from (first example): N/A — extend the existing format lookup

**Steps:**
1. Add `"http/mpeg": StreamType.Arbitrary`. Keep existing arms. No `inlineVolume`. No `ffmpeg-static`.
2. Export `mapHttpPlayError(error: unknown): Error` that maps missing ffmpeg to `Couldn't play that stream: ffmpeg is not installed.` Copy `mapHlsPlayError`. `play` uses `mapHlsPlayError` for `"hls/aac"` and `mapHttpPlayError` for `"http/mpeg"`.
3. Tests: `streamTypeFor("http/mpeg")` is Arbitrary; fake `Error("FFmpeg/avconv not found!")` maps to the stream ffmpeg-miss string; hls mapper still returns the SoundCloud string.

**Verify:**
```bash
bun test packages/bot/src/discord-voice.test.ts
bun run --cwd packages/bot typecheck
```
Expected: tests exit 0 with 0 fail. Typecheck exits 0.

**Out of scope:**
- `play.ts`, `http.ts`, README, structure check

**Escape hatches:**
- If `"http/mpeg"` is missing from `AudioFormat`, STOP — Task 2 must land first.
- If `playbackInputByFormat` is missing, extend the lookup that exists.

---

## Task 5: Grow the structure check and README

**Depends on:** 2, 3
**Spec:** `.ai/specs/2026-08-27-slice-4-playlists-and-streams.md` § Package layout, § README
**Files:**
- Modify: `packages/checks/configs/structure.ts` — require `http.ts`
- Modify: `README.md` — playlists, streams, ffmpeg Need
- Copy from (first example): N/A — config and operator docs

**Steps:**
1. `engine-source-module` requiredFiles: `youtube.ts`, `soundcloud.ts`, `http.ts`. Do not drop names. Do not add a grandfathering baseline entry.
2. README: `/play` accepts YouTube playlist URLs, SoundCloud set URLs, and HTTP stream URLs. ffmpeg Need: SoundCloud or HTTP streams. Bot starts without ffmpeg. YouTube video play does not need ffmpeg.

**Verify:**
```bash
bun run checks:structure
```
Expected: prints `[structure] ok` and exits 0. `README.md` contains `playlist` and `stream`.

**Out of scope:**
- New scanners, command behavior, First examples table

**Escape hatches:**
- If `engine-source-module` is missing, STOP.
- If the check fails because `http.ts` is missing, STOP — do not drop the name.

---

## Task 6: Final scoped proof

**Depends on:** 2, 3, 4, 5
**Spec:** `.ai/specs/2026-08-27-slice-4-playlists-and-streams.md` § Acceptance criteria, § Proof plan
**Files:**
- Modify: none unless a Verify command is red (then fix only the failing package)
- Copy from (first example): N/A — proof only

**Steps:**
1. Run the commands in Verify. Record exit codes and proving lines.
2. Confirm no new workspace package, no new production dependency, no Discord import in the engine, no `ffmpeg-static`. Confirm First examples still point at `youtube.ts` and `play.ts`.
3. Paste the spec § Proof plan human smoke steps 0–10 into the finish report. Do not mark them proved.

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
- Opening a later slice; merging the PR

**Escape hatches:**
- If any Verify command is red, STOP and fix or report.
- If live playlist/radio was not heard, the slice is unverifiable, not green.
