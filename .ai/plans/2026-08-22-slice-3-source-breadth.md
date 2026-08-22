# Slice 3 source breadth — implementation plan

**Spec:** `.ai/specs/2026-08-22-slice-3-source-breadth.md`
**Research:** `.ai/research/soundcloud-platform.md` · `.ai/research/discord-and-youtube-platform.md`
**Grill:** `.ai/runs/2026-08-22-grill-slice-3-source-breadth.md`
**Raptor:** `.ai/runs/2026-08-22-raptor-slice-3-source-breadth.md`
**Branch:** `cursor/slice-3-source-breadth-spec-8fe8`
**Status:** draft — waiting for approval
**Ordering:** shared foundation required — `"hls/aac"` must exist on `AudioFormat` before the SoundCloud module can return it. After Task 1, the router and the bot ffmpeg arm are disjoint.
**Lessons:** `engine-seam`, `product`, `process`, `platform`

Worker digest (do not read `.ai/lessons.md`):
- R1: `packages/audio-engine` never imports Discord. R2: bot → engine only. R3: no Java/JVM/Lavalink/lavaplayer. R4: UX parity, do not copy JMusicBot internals.
- Copy `packages/audio-engine/src/sources/youtube.ts` and `packages/bot/src/commands/play.ts`. Do not mint a second source-module or command-module shape.
- No engine ffmpeg, no `ffmpeg-static`, no `util.streamTrack` / `downloadTrack`. PATH ffmpeg stays in the bot.
- `soundcloud.ts` is the approved production dependency. No new workspace package. No `SOUNDCLOUD_CLIENT_ID`.
- Proof trichotomy: live SoundCloud/YouTube/voice/ffmpeg is unverifiable in CI. Workers never edit `.ai/plans/`. Commit only through parent `/check-and-commit`.

## Progress

- [ ] Task 1: Add the SoundCloud source module
- [ ] Task 2: Map `hls/aac` to PATH ffmpeg
- [ ] Task 3: Add the public resolve router
- [ ] Task 4: Add scsearch and wire play / doors
- [ ] Task 5: Grow the structure check and README
- [ ] Task 6: Final scoped proof

## Parallel groups

### Group A
**Depends on:** none
**Tasks:** 1
**Files disjoint:** n/a (single task)
**Workers:** parent agent (card: `.ai/plans/2026-08-22-slice-3-source-breadth/task-1.md`)

### Group B
**Depends on:** Group A
**Tasks:** 2, 3
**Files disjoint:** yes
**Workers:** fan out one subagent per task (cards: `task-2.md`, `task-3.md`)

### Group C
**Depends on:** Task 3
**Tasks:** 4
**Files disjoint:** n/a (single task)
**Workers:** parent agent

### Group D
**Depends on:** Tasks 1, 4
**Tasks:** 5
**Files disjoint:** n/a (single task)
**Workers:** parent agent

### Group E
**Depends on:** Tasks 3, 4, 5
**Tasks:** 6
**Files disjoint:** n/a (single task)
**Workers:** parent agent

## Dependencies

Task 1 grows `audioFormats` and adds the SoundCloud module (`bun.lock` stays here). Tasks 2 and 3 both need that format member and the `*WithClient` exports; they share no files. Task 4 needs public `resolveTrack` to accept `source?: "soundcloud"`. Task 5 requires `soundcloud.ts` and `scsearch.ts` on disk. Task 6 is final proof.

## Global out of scope

- Bandcamp, Vimeo, Twitch, local files, HTTP, Spotify source or YouTube-guess
- SoundCloud sets/playlists as playable queues (reject only), radio, live streams
- `scsearch:` on `/play`, search picker, DJ roles, persistence
- ffmpeg / `ffmpeg-static` / opus encoder / sodium in the engine
- `SOUNDCLOUD_CLIENT_ID`, plugin registry, `resolveSoundCloudTrack`
- New workspace packages, new First examples row
- Java, JVM, Lavalink, lavaplayer, dashboard, SaaS, remote player protocol

## Global escape hatches

- If `packages/audio-engine/src/sources/youtube.ts` or `packages/bot/src/commands/play.ts` is missing, STOP — slice 1 is not far enough to copy.
- If a task would add a Discord import inside `packages/audio-engine`, spawn ffmpeg from the engine, add `ffmpeg-static`, or add a workspace package, STOP and report.
- If `bun add` pulls a Java/JVM package, STOP and report.
- If a task must edit a file owned by another in-flight task, STOP — do not merge by guess.
- If `soundcloud.ts` 0.7.x has no `tracks.get` / `tracks.search` or requires an operator key, STOP and report.

## Proof (automated vs unverifiable)

Automated (Task 6 plus per-task Verify): `bun run checks`, `bun run typecheck`, `bun test packages/audio-engine`, `bun test packages/bot`.

Unverifiable in CI (human smoke in the spec § Proof plan, steps 0–9): audible SoundCloud in a real voice channel; PATH ffmpeg transcoding; YouTube still audible without ffmpeg; live extraction; slash `/scsearch` appearing. Cloud Agent IPs already fail YouTube InnerTube — not an engine bug. Ship stays a draft PR until that script passes.

---

## Task 1: Add the SoundCloud source module

**Depends on:** none
**Spec:** `.ai/specs/2026-08-22-slice-3-source-breadth.md` § Seam (engine) (`audioFormats`), § SoundCloud module, § Acceptance criteria (engine SoundCloud tests)
**Files:**
- Modify: `packages/audio-engine/src/track.ts` — `audioFormats` gains `"hls/aac"`
- Create: `packages/audio-engine/src/sources/soundcloud.ts`
- Create: `packages/audio-engine/src/sources/soundcloud.test.ts`
- Modify: `packages/audio-engine/package.json` — add `soundcloud.ts` `^0.7.4`
- Modify: `bun.lock` — only via `bun add` in this package
- Copy from (first example): `packages/audio-engine/src/sources/youtube.ts`

**Steps:**
1. Set `audioFormats` to `["webm/opus", "hls/aac"] as const`. No other `track.ts` changes.
2. From repo root: `bun add soundcloud.ts@^0.7.4 --cwd packages/audio-engine`. Do not add `ffmpeg-static`. Do not add `SOUNDCLOUD_CLIENT_ID`.
3. Copy the YouTube injectable-client seam. Export `SoundCloudClient`, `parseSoundCloudQuery`, `resolveSoundCloudTrackWithClient`, `openSoundCloudAudioWithClient`. Do not export public `resolveTrack` / `openTrackAudio`. Do not edit `index.ts`.
4. Implement parse, resolve, open, error strings, and HLS segment streaming exactly as the spec § SoundCloud module (including raptor: throw on `/sets/`; push segments as they arrive). Default client: `new Soundcloud()` with no args; wrap `tracks.get`, `tracks.search`, and HLS open. Never call `util.streamTrack`, `util.downloadTrack`, or `m3uReadableStream`.
5. Tests against a fake `SoundCloudClient` only (copy `youtube.test.ts` style). No `Innertube`, no network, no `new Soundcloud()` in tests.

**Verify:**
```bash
bun test packages/audio-engine/src/sources/soundcloud.test.ts
bun run --cwd packages/audio-engine typecheck
```
Expected: tests exit 0 with 0 fail. Typecheck exits 0. `packages/audio-engine/package.json` lists `soundcloud.ts` and does not list `ffmpeg-static`. `soundcloud.ts` source has no `streamTrack` / `downloadTrack` / `ffmpeg` spawn.

**Out of scope:**
- `resolve.ts`, `index.ts`, `youtube.ts` public pair, `discord-voice.ts`, `packages/bot/src/commands/**`, structure check

**Escape hatches:**
- If `youtube.ts` is missing `YoutubeClient` / `*WithClient`, STOP — copy those names, do not invent a registry.
- If the `soundcloud.ts` package cannot construct without a key, STOP and report.

---

## Task 2: Map `hls/aac` to PATH ffmpeg

**Depends on:** 1
**Spec:** `.ai/specs/2026-08-22-slice-3-source-breadth.md` § Bot format lookup
**Files:**
- Modify: `packages/bot/src/discord-voice.ts` — lookup arm + spawn-error map
- Create: `packages/bot/src/discord-voice.test.ts` — mapper and lookup tests
- Copy from (first example): N/A — not a command module; extend the existing format lookup

**Steps:**
1. In `discord-voice.ts` add `"hls/aac": StreamType.Arbitrary`. Keep `"webm/opus": StreamType.WebmOpus`. No `inlineVolume`. No `ffmpeg-static`. Do not edit `track.ts` (Task 1 owns it).
2. Export `streamTypeFor(format: AudioFormat): StreamType` that reads the lookup (so tests can see both arms).
3. On `play` for `"hls/aac"`, wrap `createAudioResource` / `player.play`. If the error is a missing ffmpeg binary (message or `ENOENT` mentioning ffmpeg/avconv), throw `new Error("Couldn't play that SoundCloud track: ffmpeg is not installed.")`. Do not probe PATH. Do not probe at startup. `"webm/opus"` play stays unchanged (no ffmpeg requirement).
4. Export `mapHlsPlayError(error: unknown): Error` for the mapping. Tests call that; do not spawn ffmpeg in CI.

**Verify:**
```bash
bun test packages/bot/src/discord-voice.test.ts
bun run --cwd packages/bot typecheck
```
Expected: tests exit 0 with 0 fail. Typecheck exits 0. `streamTypeFor("webm/opus")` is `StreamType.WebmOpus`. `streamTypeFor("hls/aac")` is `StreamType.Arbitrary`. A fake `Error("FFmpeg/avconv not found!")` maps to the pinned ffmpeg-miss message.

**Out of scope:**
- `soundcloud.ts`, `resolve.ts`, `play.ts`, `scsearch.ts`, README ffmpeg install prose

**Escape hatches:**
- If `playbackInputByFormat` is missing or not keyed on `AudioFormat`, extend the lookup that exists — do not add a second player.
- If `StreamType.Arbitrary` is missing from the installed `@discordjs/voice` types, STOP and report.

---

## Task 3: Add the public resolve router

**Depends on:** 1
**Spec:** `.ai/specs/2026-08-22-slice-3-source-breadth.md` § Seam (engine), § Host dispatch, § YouTube module
**Files:**
- Create: `packages/audio-engine/src/resolve.ts`
- Create: `packages/audio-engine/src/resolve.test.ts`
- Modify: `packages/audio-engine/src/sources/youtube.ts` — remove public `resolveTrack` / `openTrackAudio`; keep `*WithClient` and `parseYoutubeQuery`
- Modify: `packages/audio-engine/src/index.ts` — re-export the public pair from `resolve.ts`
- Copy from (first example): N/A — not UI; `index.ts` stays re-exports only

**Steps:**
1. Implement `pickSource` and public `resolveTrack` / `openTrackAudio` as spec § Host dispatch. `resolveTrack` input is `{ query, source?: "soundcloud" }`. `openTrackAudio` stays `{ track }` and routes on `track.uri`.
2. YouTube path calls `resolveTrackWithClient` / `openTrackAudioWithClient` via the existing default client. SoundCloud path calls the Task 1 `*WithClient` functions via the SoundCloud default client.
3. Delete the public `resolveTrack` / `openTrackAudio` wrappers from `youtube.ts`. Keep `getDefaultClientAsync` usable from `resolve.ts` (export a `getYoutubeClient` / keep the wrappers’ client getter exported, or pass `resolveTrackWithClient` after getting the client inside `resolve.ts` by importing a new `getDefaultYoutubeClientAsync` you export from `youtube.ts`). Do not duplicate InnerTube setup.
4. `index.ts` exports `resolveTrack` and `openTrackAudio` from `./resolve.ts` only. Do not export `pickSource` unless tests import it from `resolve.ts` directly.
5. Tests (no network): `pickSource` / resolve cases in spec § Acceptance criteria (SoundCloud URL, YouTube URL, bare words, `source: "soundcloud"` + YouTube URL → `That is not a SoundCloud track.`). Use fakes by exporting `resolveTrackWithClients` / `openTrackAudioWithClients` that take both clients — same idea as `*WithClient`. Existing `youtube.test.ts` must still pass.

**Verify:**
```bash
bun test packages/audio-engine/src/resolve.test.ts packages/audio-engine/src/sources/youtube.test.ts packages/audio-engine/src/sources/soundcloud.test.ts
bun run --cwd packages/audio-engine typecheck
```
Expected: tests exit 0 with 0 fail. Typecheck exits 0. `index.ts` does not import `resolveTrack` from `youtube.ts`.

**Out of scope:**
- `packages/bot/**`, structure check, Spotify error path, plugin registry

**Escape hatches:**
- If Task 1 did not export `*WithClient` names, STOP — do not reimplement SoundCloud inside `resolve.ts`.
- If removing youtube public wrappers breaks an in-repo import other than `index.ts`, STOP and report.

---

## Task 4: Add scsearch and wire play / doors

**Depends on:** 3
**Spec:** `.ai/specs/2026-08-22-slice-3-source-breadth.md` § `play` command, § `scsearch` command, § Dispatch and registration, § Scene
**Files:**
- Create: `packages/bot/src/commands/scsearch.ts`
- Create: `packages/bot/src/commands/scsearch.test.ts`
- Modify: `packages/bot/src/commands/play.ts` — usage and slash copy
- Modify: `packages/bot/src/commands/play.test.ts` — new usage string
- Modify: `packages/bot/src/guild-music-session.ts` — `EnginePort.resolveTrack` optional `source`
- Modify: `packages/bot/src/main.ts` — dispatch, session create, slash `query` for `scsearch`
- Modify: `packages/bot/src/register-commands.ts` — add `scsearch`
- Modify: `packages/bot/src/doors.test.ts` — prefix name + registration list
- Copy from (first example): `packages/bot/src/commands/play.ts`

**Steps:**
1. `EnginePort.resolveTrack` input becomes `{ query: string; source?: "soundcloud" }`. Do not change `openTrackAudio`. Existing fakes stay valid.
2. Copy `play.ts` into `scsearch.ts`. Strings, `source: "soundcloud"`, and slash names as spec § `scsearch` command. No `CommandContext` change. No alias. No shared `executePlay(source)` helper.
3. Update `play.ts` usage/description as spec § `play` command. `resolveTrack({ query: ctx.args })` with no `source`.
4. `runDoorCommand`: `name === "play" || name === "scsearch"` creates the session and binds announce. `readSlashArgs` reads option `query` for both. Add `scsearch` to `knownCommandNames` and `dispatchCommand`. No session-create registry.
5. `registerGuildCommands` includes `scsearchSlashData` (optional string `query`). `registeredSlashNames` becomes the eleven names (prior ten plus `scsearch`).
6. Tests: copy `play.test.ts` for `scsearch` (success Playing/Queued, not-in-voice, occupied, resolve error, empty usage, YouTube URL → `That is not a SoundCloud track.`, paused enqueue stays paused). Assert the fake engine received `source: "soundcloud"` on scsearch and no `source` on play. `doors.test.ts`: `!scsearch words` parses; registration list includes `scsearch` and still has no `np` / `leave`. One play/scsearch test: `playNow` throw of the ffmpeg-miss message is replied as-is.

**Verify:**
```bash
bun test packages/bot/src/commands/scsearch.test.ts packages/bot/src/commands/play.test.ts packages/bot/src/doors.test.ts
bun run --cwd packages/bot typecheck
```
Expected: tests exit 0 with 0 fail. Typecheck exits 0. `registeredSlashNames` has 11 names including `scsearch`.

**Out of scope:**
- Structure check requiredFiles, README, `discord-voice.ts`, engine router logic

**Escape hatches:**
- If `play.ts` export names differ from `playSlashData` / `executePlay`, copy the names that exist. If `play.ts` is missing, STOP.
- If `dispatchCommand` / `registerGuildCommands` live in different files than slice 2, extend those files — do not add a second dispatch module.

---

## Task 5: Grow the structure check and README

**Depends on:** 1, 4
**Spec:** `.ai/specs/2026-08-22-slice-3-source-breadth.md` § Package layout, § README, § Acceptance criteria (structure + README)
**Files:**
- Modify: `packages/checks/configs/structure.ts` — require `soundcloud.ts` and `scsearch.ts`
- Modify: `README.md` — ffmpeg Need + `scsearch` + `/play` SoundCloud URL
- Copy from (first example): N/A — config and operator docs, not UI

**Steps:**
1. Shape `engine-source-module` (`match` `packages/audio-engine/src/sources`): requiredFiles `youtube.ts` and `soundcloud.ts`.
2. Shape `bot-command-module`: add `scsearch.ts` to the existing required list. Do not drop slice 2 names. Do not add a grandfathering baseline entry.
3. README Need: install ffmpeg and keep `ffmpeg` on PATH (SoundCloud only). Commands: add `/scsearch` and `!scsearch`. `/play` mentions SoundCloud track URLs. Do not require ffmpeg to start the bot or to play YouTube.

**Verify:**
```bash
bun run checks:structure
```
Expected: prints `[structure] ok` and exits 0. `README.md` contains `ffmpeg` and `scsearch`.

**Out of scope:**
- New scanners, engine-seam rule changes, command behavior, First examples table

**Escape hatches:**
- If `engine-source-module` or `bot-command-module` is missing, STOP — do not invent a new shape id.
- If the check fails because Task 1 or Task 4 files are missing, STOP — do not drop those names from requiredFiles.

---

## Task 6: Final scoped proof

**Depends on:** 3, 4, 5
**Spec:** `.ai/specs/2026-08-22-slice-3-source-breadth.md` § Acceptance criteria, § Proof plan
**Files:**
- Modify: none unless a Verify command is red (then fix only the failing package; do not start slice 4)
- Copy from (first example): N/A — proof only

**Steps:**
1. Run the commands in Verify. Record exit codes and the lines that prove each check.
2. Confirm `packages/audio-engine/package.json` depends on `soundcloud.ts` and `youtubei.js`, not Discord, not `ffmpeg-static`, not Java. Confirm `packages/bot/package.json` gained no new production dependency. Confirm no new workspace package under `packages/`.
3. Confirm `AGENTS.md` First examples still point at `packages/bot/src/main.ts`, `packages/bot/src/commands/play.ts`, and `packages/audio-engine/src/sources/youtube.ts`. Confirm no `resolveSoundCloudTrack` export from `packages/audio-engine/src/index.ts`.
4. Paste the spec § Proof plan human smoke steps 0–9 into the finish report. Do not mark them proved. Do not wait for ffmpeg-hide in CI.

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
- `/execute`, `/judge`, opening a new slice

**Escape hatches:**
- If any Verify command is red, STOP and fix or report — do not treat unrun or failed checks as proved.
- If live SoundCloud/ffmpeg was not heard, the slice is unverifiable, not green.
