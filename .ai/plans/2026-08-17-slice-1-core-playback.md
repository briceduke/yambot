# Slice 1 core playback — implementation plan

**Spec:** `.ai/specs/2026-08-11-slice-1-core-playback.md`
**Research:** `.ai/research/discord-and-youtube-platform.md`
**Branch:** `slice-1-core-playback`
**Status:** approved
**Ordering:** slice-first. Engine package is a real shared foundation (bot session imports its public surface). Play is minted before skip/queue copy it. Doors wait for the three command modules.
**Lessons:** `engine-seam`, `product`, `process`

Worker digest (do not read `.ai/lessons.md`):
- R1: `packages/audio-engine` never imports Discord. R2: bot → engine only. R3: no Java/JVM/Lavalink/lavaplayer. R4: UX parity, do not copy JMusicBot internals.
- Mint first examples in this slice; skip/queue copy `play.ts`; later sources will copy `youtube.ts`.
- Keep the checks baseline empty. No extra workspace packages. No dotenv, ffmpeg, opus, or sodium packages.
- Proof trichotomy: live Discord/YouTube smoke is unverifiable in CI. Workers never edit `.ai/plans/`. Commit only through parent `/check-and-commit`.

## Raptor check (readonly, 2026-08-17)

Read `.ai/rules/raptor-milspec.md` against this slice. Rejected as extra parts: source plugin registry, engine-side player/decoder, ffmpeg/opus/sodium, extra packages, command framework, dotenv, persistence, reconnect/leave policy, playlist/live support. Kept: two packages, `{ stream, format }` seam, `TrackQueue` as pure state, one file per command, two real doors, R1/R2 scan.

## Progress

- [x] Task 1: Build the audio-engine package
- [x] Task 2: Build guild session, command context, and prefix parse
- [x] Task 3: Mint the play command module
- [x] Task 4: Add skip and queue command modules
- [x] Task 5: Wire startup, both doors, and slash registration
- [x] Task 6: Add structure rules and the R1/R2 engine-seam scan
- [x] Task 7: Write operator README, first examples, and CI
- [x] Task 8: Final scoped proof

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
**Tasks:** 3
**Files disjoint:** n/a (single task)
**Workers:** parent agent (mints the command-module first example)

### Group D
**Depends on:** Group C
**Tasks:** 4
**Files disjoint:** n/a (single task)
**Workers:** parent agent (copies `play.ts`; skip and queue stay one task to avoid two cold starts for two small files)

### Group E
**Depends on:** Group D
**Tasks:** 5
**Files disjoint:** n/a (single task)
**Workers:** parent agent

### Group F
**Depends on:** Group E
**Tasks:** 6, 7
**Files disjoint:** yes
**Workers:** fan out one subagent per task

### Group G
**Depends on:** Group F
**Tasks:** 8
**Files disjoint:** n/a (single task)
**Workers:** parent agent

## Dependencies

Task 1 blocks Task 2 (engine types and `TrackQueue`). Task 2 blocks Task 3 (session + `CommandContext`). Task 3 blocks Task 4 (`play.ts` is the first example to copy). Task 4 blocks Task 5 (doors import all three modules). Tasks 6 and 7 run together after Task 5 (full tree exists; file sets do not overlap). Task 8 is final proof.

## Global out of scope

- Pause, resume, now-playing, remove, shuffle, clear, stop, leave, volume (slice 2)
- Reconnect retry/backoff/resume-position (slice 2)
- Sources other than YouTube; playlists; live streams (slices 3–4)
- DJ roles, vote skip, guild prefixes, mention-as-prefix, help (slice 5)
- Persistence, Perry, extra workspace packages
- ffmpeg, `@discordjs/opus`, `opusscript`, `sodium`, `sodium-native`, `libsodium-wrappers`, `tweetnacl`, `dotenv`
- Java, JVM, Lavalink, lavaplayer
- Web dashboard, SaaS, remote player protocol, public engine release

## Global escape hatches

- If `youtubei.js` v18 does not yield a web `ReadableStream<Uint8Array>` for audio-only webm/opus, STOP and report — do not add ffmpeg or a second extractor.
- If `@discordjs/voice` cannot join or play webm/opus without sodium/ffmpeg/opus packages on Node 24, STOP and report — do not add those packages.
- If Node 24 cannot run `packages/bot/src/main.ts` via type stripping (erasable TS only), STOP and report — do not add a compile step.
- If `bun add` pulls a Java/JVM package, STOP and report.
- If a task must edit a file owned by another in-flight task, STOP — do not merge by guess.

## Proof (automated vs unverifiable)

Automated (Task 8 plus per-task Verify): `bun run checks`, `bun run typecheck`, `bun test packages/audio-engine`, `bun test packages/bot`.

Unverifiable in CI (human smoke in the spec § Proof plan, steps 0–11): audible audio, DAVE handshake, portal Message Content intent, live YouTube extraction, real join/move, slash commands appearing in the client. Ship stays a draft PR until that script passes. Do not mark the slice green without it.

---

## Task 1: Build the audio-engine package

**Depends on:** none
**Spec:** `.ai/specs/2026-08-11-slice-1-core-playback.md` § Seam contract (pinned), § Package layout, § Acceptance criteria (engine tests)
**Files:**
- Create: `packages/audio-engine/package.json`
- Create: `packages/audio-engine/tsconfig.json`
- Create: `packages/audio-engine/src/track.ts`
- Create: `packages/audio-engine/src/track-queue.ts`
- Create: `packages/audio-engine/src/track-queue.test.ts`
- Create: `packages/audio-engine/src/sources/youtube.ts`
- Create: `packages/audio-engine/src/sources/youtube.test.ts`
- Create: `packages/audio-engine/src/index.ts`
- Copy from (first example): N/A — this task mints the engine source module first example at `packages/audio-engine/src/sources/youtube.ts`

**Steps:**
1. Create `packages/audio-engine/package.json` with name `@yambot/audio-engine`, `"private": true`, `"type": "module"`, `"exports": { ".": "./src/index.ts" }`, scripts `typecheck` = `tsc --noEmit` and `test` = `bun test`, production dependency `youtubei.js` only (grill-approved). Dev dependencies: `typescript` `^5.8.2`, `@types/bun`. Do not add Discord libraries.
2. Copy `packages/checks/tsconfig.json` into `packages/audio-engine/tsconfig.json`. Set `include` to `["src/**/*.ts"]`. If `tsc` cannot see `ReadableStream`, add `"DOM"` to `lib` and re-run — do not add other libs.
3. Put the spec’s `audioFormats`, `AudioFormat`, `Track`, `TrackAudio`, and `TrackResolveError` in `packages/audio-engine/src/track.ts`. Use erasable TS only (no `enum`, no `namespace`, no parameter properties). `TrackResolveError` extends `Error` and is safe to show users.
4. Implement `TrackQueue` in `packages/audio-engine/src/track-queue.ts` exactly as the spec: `enqueue`, `dequeueNext` (empty → `null`), `list` (return a shallow copy), `size`. FIFO. No I/O. No skip/clear/shuffle.
5. In `packages/audio-engine/src/sources/youtube.ts`:
   - Export `parseYoutubeQuery(query: string): { readonly kind: "video-id"; readonly videoId: string } | { readonly kind: "search"; readonly query: string }`. Treat as URL when `URL.canParse(trimmed)` and hostname is `youtu.be` or ends with `youtube.com`. Read id from `v` on watch URLs, from the first pathname segment on `youtu.be`, from `/shorts/{id}` or `/embed/{id}`. Id must match `^[A-Za-z0-9_-]{11}$`. Playlist-only YouTube URLs (no video id) throw `TrackResolveError` with `Playlists are not supported yet. Use a video URL or search words.` Anything else is search.
   - Export a test seam `YoutubeClient` with `getVideo(videoId: string): Promise<{ readonly title: string; readonly durationSeconds: number; readonly videoId: string; readonly hasWebmOpus: boolean }>` and `searchFirstVideoId(query: string): Promise<string | null>` and `openAudioWebm(videoId: string): Promise<ReadableStream<Uint8Array>>`. Do not export `YoutubeClient` from `index.ts`.
   - Export `resolveTrackWithClient` / `openTrackAudioWithClient` used by tests. Public `resolveTrack` / `openTrackAudio` lazy-create one `Innertube` via `Innertube.create()` and wrap it. Use `getInfo` for metadata, `search(query, { type: "video" })` for search (first result’s video id), `chooseFormat({ type: "audio", format: "webm", codec: "opus" })` to set `hasWebmOpus`, and `download(videoId, { type: "audio", format: "webm", codec: "opus" })` for the stream. Canonical `uri` is `https://www.youtube.com/watch?v={id}`. Missing duration → `0`.
   - Map failures to `TrackResolveError` with these messages: no search hit → `No YouTube results for that search.`; no webm/opus → `That video has no playable audio.`; other InnerTube/playability failures → `Couldn't play that YouTube video.`
6. `packages/audio-engine/src/index.ts` re-exports only the spec public surface: `audioFormats`, `AudioFormat`, `Track`, `TrackAudio`, `TrackResolveError`, `resolveTrack`, `openTrackAudio`, `TrackQueue`.
7. Tests (no network): FIFO on `TrackQueue`; `parseYoutubeQuery` for a watch URL, a `youtu.be` URL, and search words; `resolveTrackWithClient` success, search-to-top-hit, missing webm/opus, and mapped errors; `openTrackAudioWithClient` yields `format: "webm/opus"` and the fake stream. Never call `Innertube.create` in tests.
8. From repo root run `bun install`.

**Verify:**
```bash
bun run --cwd packages/audio-engine typecheck
bun test packages/audio-engine
```
Expected: typecheck exits 0 with no output. Tests exit 0 with 0 fail. No test opens the network.

**Out of scope:**
- `packages/bot`, `packages/checks` scanner wiring, Discord, ffmpeg, playlists, live streams

**Escape hatches:**
- If `youtubei.js` search results do not expose a video id on the first video item, STOP and report the actual field names — do not add a second extractor.
- If `download` does not return `ReadableStream<Uint8Array>`, STOP and report.

---

## Task 2: Build guild session, command context, and prefix parse

**Depends on:** 1
**Spec:** `.ai/specs/2026-08-11-slice-1-core-playback.md` § Seam contract (bot `CommandContext`), § Bot structure, § Advance loop, § Voice drop invariant, § Acceptance criteria (bot tests except command reply strings and doors)
**Files:**
- Create: `packages/bot/package.json`
- Create: `packages/bot/tsconfig.json`
- Create: `packages/bot/src/command-context.ts`
- Create: `packages/bot/src/prefix.ts`
- Create: `packages/bot/src/prefix.test.ts`
- Create: `packages/bot/src/format-duration.ts`
- Create: `packages/bot/src/format-duration.test.ts`
- Create: `packages/bot/src/guild-music-session.ts`
- Create: `packages/bot/src/guild-music-session.test.ts`
- Create: `packages/bot/src/discord-voice.ts`
- Create: `packages/bot/test/fixtures/webm-opus.bin`
- Copy from (first example): N/A — not a command module; session is bot-internal. Command module first example is Task 3.

**Steps:**
1. Create `packages/bot/package.json` with name `@yambot/bot`, `"private": true`, `"type": "module"`, `"engines": { "node": ">=24" }`, scripts `typecheck` = `tsc --noEmit`, `test` = `bun test`, `start` = `node --env-file-if-exists=.env src/main.ts`. Dependencies: `@yambot/audio-engine` `workspace:*`, `discord.js`, `@discordjs/voice` (grill-approved). Dev: `typescript` `^5.8.2`, `@types/node`, `@types/bun`. Do not add sodium, ffmpeg, opus, or dotenv.
2. Copy `packages/checks/tsconfig.json` into `packages/bot/tsconfig.json`. Set `include` to `["src/**/*.ts"]`. Set `types` to `["node", "bun"]` so `bun:test` and Node APIs both typecheck.
3. Run `bun install` from repo root.
4. `command-context.ts`: export `CommandContext` exactly as the spec (including `reply(text: string): Promise<void>`).
5. `prefix.ts`: export `parsePrefixMessage(input: { readonly content: string; readonly prefix: string; readonly isBot: boolean; readonly inGuild: boolean }): { readonly name: string; readonly args: string } | null`. Ignore bots, non-guild, and content that does not start with `prefix`. Command name is the first whitespace token after the prefix, lowercased. `args` is the remainder trimmed (empty string when none). Unknown names are still returned — doors drop them. Export `readCommandPrefix(env: NodeJS.ProcessEnv): string` defaulting to `!` from `COMMAND_PREFIX`.
6. `format-duration.ts`: export `formatDuration(durationSeconds: number): string`. `m:ss` under one hour (`0:00`, `3:33`, `59:59`); `h:mm:ss` at 3600 and above (`1:00:00`, `1:01:01`).
7. In `guild-music-session.ts` export:
   - `EnginePort` with `resolveTrack` and `openTrackAudio` matching the engine signatures.
   - `VoicePort` with `join(channelId: string): Promise<void>`, `getChannelId(): string | null`, `getChannelName(): string`, `play(audio: TrackAudio): Promise<void>`, `stop(): void`, `onIdle(handler: () => void): void`, `onDisconnected(handler: () => void): void`.
   - `GuildMusicSession` holding a public `readonly engine: EnginePort`, engine `TrackQueue`, `currentTrack`, announce callback, and the voice port. Registry: `getSession(guildId: string)`, `createSession(input: { readonly guildId: string; readonly engine: EnginePort; readonly voice: VoicePort })`, in-memory `Map`.
   - `bindAnnounce(send: (text: string) => Promise<void>): void` — used by the play door (Task 5), not by skip/queue.
   - `playNow(track: Track): Promise<void>` opens audio and plays; sets current. First-track open failure throws `TrackResolveError` (or wraps as one) and must not set current or enqueue.
   - `enqueue(track: Track): number` enqueues then returns the display position (`queue.size + 1` with current occupying #1).
   - `skipCurrent(): Track | null` stops the player; returns the skipped track or `null` if nothing current.
   - `snapshot(): { current: Track | null; upcoming: readonly Track[] }`.
   - Advance on voice `onIdle`: dequeue next; if none, clear current and stay connected; if next, open and play and `send("Now playing: {title} ({duration})")`; if open fails, `send("Skipping {title}: couldn't play it")` and continue (never stall).
   - Voice `onDisconnected`: stop playback, drop current, leave queue untouched, keep the session. Next `playNow` is allowed (idle).
   - `isOccupiedInOtherChannel(invokerVoiceChannelId: string): boolean` true when `currentTrack !== null` and voice channel id is not null and differs from the invoker.
   - Join: `joinInvoker(channelId: string): Promise<void>` — join, or move only when `currentTrack === null`.
8. `discord-voice.ts`: implement `createDiscordVoicePort` using `joinVoiceChannel`, `createAudioPlayer`, `createAudioResource(Readable.fromWeb(stream), { inputType: StreamType.WebmOpus })` via a one-key lookup `playbackInputByFormat` for `"webm/opus"`. Subscribe player to connection. Map player idle and connection destroyed/disconnected to the port handlers. Failed `join` must throw with a message the command can reply. No ffmpeg, no inline volume.
9. Write `packages/bot/test/fixtures/webm-opus.bin` as any small byte file (it is not decoded in unit tests).
10. Tests with fakes only (no Discord login, no network): prefix parse cases; duration cases; queue FIFO through the session; playNow then enqueue; advance-on-idle including dead-track skip; voice-drop keeps queue and clears current; audio pipe — read the fixture file, wrap as `ReadableStream<Uint8Array>`, `format: "webm/opus"`, assert `voice.play` received that stream/format.

**Verify:**
```bash
bun run --cwd packages/bot typecheck
bun test packages/bot/src/prefix.test.ts packages/bot/src/format-duration.test.ts packages/bot/src/guild-music-session.test.ts
```
Expected: typecheck exits 0. Named tests exit 0 with 0 fail.

**Out of scope:**
- `packages/bot/src/commands/*`, `packages/bot/src/main.ts`, README, checks scanners, YouTube network calls

**Escape hatches:**
- If `@discordjs/voice` types require an encryption adapter at compile time, STOP and report — do not install sodium to silence it.
- If `Readable.fromWeb` is missing on `@types/node` for Node 24, STOP and report — do not switch the engine seam to Node `Readable`.

---

## Task 3: Mint the play command module

**Depends on:** 2
**Spec:** `.ai/specs/2026-08-11-slice-1-core-playback.md` § play, § Scene failure modes 1–3, § Client / platform contract (mentions, ACK is door-side)
**Files:**
- Create: `packages/bot/src/commands/play.ts`
- Create: `packages/bot/src/commands/play.test.ts`
- Copy from (first example): N/A — this task mints the bot command module first example at `packages/bot/src/commands/play.ts`

**Steps:**
1. `play.ts` must not import `Interaction` or `Message`. It takes `CommandContext` and `GuildMusicSession` only.
2. Export `playSlashData` built with `SlashCommandBuilder`: name `play`, description `Play a YouTube URL or search words.`, optional string option `query` (required false) so `/play` with no option hits usage.
3. Export `async function executePlay(ctx: CommandContext, session: GuildMusicSession): Promise<void>`:
   - Empty `ctx.args` → `Usage: /play <YouTube URL or search words>`
   - `ctx.invokerVoiceChannelId === null` → `Join a voice channel first.` No join, nothing queued.
   - `session.isOccupiedInOtherChannel(ctx.invokerVoiceChannelId)` → `Already playing in #{channel} — join there.` using `session` voice channel name. Never move mid-song.
   - `await session.joinInvoker(ctx.invokerVoiceChannelId)`. On throw, reply `Couldn't join voice: {message}` and return.
   - `await session.engine.resolveTrack({ query: ctx.args })`. On `TrackResolveError`, reply its `.message` and return (nothing queued). Catch other errors the same way with `Couldn't play that YouTube video.`
   - If `session.currentTrack !== null`: `const position = session.enqueue(track)` then `Queued (#{position}): {title} ({duration})`.
   - If idle: `await session.playNow(track)` then `Playing: {title} ({duration})`. Open/play failure: reply the error message, no current, nothing queued.
4. Use `formatDuration` for `{duration}`. Do not put requester text in replies.
5. Tests with a fake session: usage, not-in-voice, wrong-channel, resolve error, playing reply, queued reply with `#2`. Assert no join on the first two failures.

**Verify:**
```bash
bun test packages/bot/src/commands/play.test.ts
bun run --cwd packages/bot typecheck
```
Expected: tests exit 0 with 0 fail. Typecheck exits 0.

**Out of scope:**
- skip.ts, queue.ts, main.ts, slash defer (door), prefix listener

**Escape hatches:**
- If `GuildMusicSession` from Task 2 is missing `joinInvoker` / `isOccupiedInOtherChannel` / `playNow` / `enqueue`, STOP and report — do not reimplement session logic inside `play.ts`.

---

## Task 4: Add skip and queue command modules

**Depends on:** 3
**Spec:** `.ai/specs/2026-08-11-slice-1-core-playback.md` § skip, § queue, § Advance loop (skip ack vs now-playing)
**Files:**
- Create: `packages/bot/src/commands/skip.ts`
- Create: `packages/bot/src/commands/skip.test.ts`
- Create: `packages/bot/src/commands/queue.ts`
- Create: `packages/bot/src/commands/queue.test.ts`
- Copy from (first example): `packages/bot/src/commands/play.ts`

**Steps:**
1. Copy the shape of `play.ts`: `*SlashData` + `execute*` taking `CommandContext` and `GuildMusicSession | undefined`. No raw Interaction/Message. No extra helpers file.
2. `skip.ts`: slash name `skip`, no options. If session is missing or `currentTrack` is null → `Nothing is playing.` Else reply `Skipped: {title}` then `session.skipCurrent()`. Do not announce the next track here — the advance loop does `Now playing: …`.
3. `queue.ts`: slash name `queue`, no options. If no current and upcoming empty → `Nothing is playing and the queue is empty.` Else first line `Now: {title} ({duration})`, then up to 10 numbered upcoming lines `N. {title} ({duration})` starting at 1, then `…and {k} more.` when upcoming length > 10 (`k = length - 10`).
4. Tests: skip with nothing playing; skip replies `Skipped:` and calls `skipCurrent`; queue empty; queue now+one upcoming; queue with 11 upcoming shows 10 lines plus `…and 1 more.`

**Verify:**
```bash
bun test packages/bot/src/commands/skip.test.ts packages/bot/src/commands/queue.test.ts
bun run --cwd packages/bot typecheck
```
Expected: tests exit 0 with 0 fail. Typecheck exits 0.

**Out of scope:**
- play.ts behavior changes, DJ/vote skip, now-playing command, main.ts doors

**Escape hatches:**
- If `play.ts` export names differ from `playSlashData` / `executePlay`, copy the names that exist — do not invent a third pattern. If `play.ts` is missing, STOP.

---

## Task 5: Wire startup, both doors, and slash registration

**Depends on:** 4
**Spec:** `.ai/specs/2026-08-11-slice-1-core-playback.md` § Startup and config, § Bot structure (doors), § Client / platform contract (ACK, registration, mentions, permissions)
**Files:**
- Create: `packages/bot/src/startup.ts`
- Create: `packages/bot/src/startup.test.ts`
- Create: `packages/bot/src/register-commands.ts`
- Create: `packages/bot/src/main.ts`
- Create: `packages/bot/src/doors.test.ts`
- Modify: `packages/bot/package.json` — only if `start` is not already `node --env-file-if-exists=.env src/main.ts`
- Copy from (first example): N/A — wiring, not a command module. Commands already exist at `packages/bot/src/commands/play.ts`

**Steps:**
1. `startup.ts` export `missingTokenMessage` = `DISCORD_TOKEN is missing. Set it in the environment and start again.` Export `disallowedIntentsMessage` = `Enable the Message Content intent in the Discord developer portal, then restart.` Export `requireDiscordToken(env, write, exit)` — if `DISCORD_TOKEN` is missing or blank, write the missing-token message and `exit(1)`. Export `exitIfDisallowedIntents(code, write, exit)` — if `code === 4014`, write the intents message and `exit(1)`.
2. `register-commands.ts` export the three slash JSON bodies from the command modules and `async function registerGuildCommands(input: { readonly applicationId: string; readonly guildId: string; readonly restPut: (guildId: string, body: readonly unknown[]) => Promise<void> }): Promise<void>` which bulk-PUTs all three. Call it for every guild on `ready` and for the new guild on `guildCreate`. Same-name PUT is idempotent.
3. `main.ts`:
   - Call `requireDiscordToken(process.env, console.error, process.exit)`.
   - `new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] })`.
   - On `Events.ShardDisconnect` (or the current discord.js close event that carries a numeric `code`), call `exitIfDisallowedIntents`.
   - Build one `EnginePort` from `@yambot/audio-engine` `resolveTrack` / `openTrackAudio`.
   - Slash door: ignore non-chat-input. Defer immediately (`deferReply()`, not ephemeral). Build `CommandContext` with `guildId`, `channelId`, `invokerVoiceChannelId` from the guild member’s voice, `args` from option `query` (empty string when absent). `reply` = `editReply({ content, allowedMentions: { parse: [] } })`. Unknown command names: return. `play` / `skip` / `queue` call the same `execute*` functions. For `play` only: `getOrCreate` session with `createDiscordVoicePort` from `interaction.guild`, then `session.bindAnnounce` using `interaction.channel.send` with `allowedMentions: { parse: [] }`. Skip/queue use `getSession` and must not create a session or rebind announce.
   - Prefix door: ignore bots and DMs. `parsePrefixMessage` with `readCommandPrefix(process.env)`. Null → return. Unknown `name` → return (silent). Build the same `CommandContext`; `reply` = `message.channel.send({ content, allowedMentions: { parse: [] } })`. Same session rules as slash. Do not defer (plain message).
   - `client.login(token)`.
4. `doors.test.ts`: fake a slash-like and prefix-like input object (not a live Client) through a small exported `dispatchCommand(name, ctx, session)` used by both doors, asserting the same `executePlay` / `executeSkip` / `executeQueue` run. Prefix tests: bot ignored, unknown command ignored, `!play never gonna` dispatches play with args `never gonna`. Do not log in to Discord.
5. `startup.test.ts`: missing token calls `exit(1)` with the pinned message; code `4014` does the same with the intents message; other close codes do not exit.

**Verify:**
```bash
bun test packages/bot/src/startup.test.ts packages/bot/src/doors.test.ts
bun test packages/bot
bun run --cwd packages/bot typecheck
```
Expected: all listed tests exit 0 with 0 fail. Typecheck exits 0. `packages/bot/src/main.ts` exists and imports all three command modules.

**Out of scope:**
- README portal prose (Task 7), checks scanner, pause/leave, global (non-guild) command registration

**Escape hatches:**
- If discord.js v14/v15 does not emit `ShardDisconnect` with a numeric close code, STOP and report the event you found — do not skip the 4014 exit.
- If `interaction.member.voice` is untyped on `APIInteractionGuildMember`, STOP and report — do not drop the not-in-voice check.

---

## Task 6: Add structure rules and the R1/R2 engine-seam scan

**Depends on:** 5
**Spec:** `.ai/specs/2026-08-11-slice-1-core-playback.md` § Goals (R1/R2 scan), § Package layout, § Acceptance criteria (structure + scan)
**Files:**
- Create: `packages/checks/src/engine-seam/run.ts`
- Create: `packages/checks/src/engine-seam/run.test.ts`
- Create: `packages/checks/src/engine-seam/fixtures/bad-engine/package.json`
- Create: `packages/checks/src/engine-seam/fixtures/bad-engine/src/index.ts`
- Modify: `packages/checks/src/types.ts` — add scanner name `engine-seam`
- Modify: `packages/checks/src/run-all.ts` — register the scanner; `runAllScanners` runs `structure` then `engine-seam`
- Modify: `packages/checks/src/cli.ts` — help line for `engine-seam`; `isScannerName` accepts it
- Modify: `packages/checks/src/index.ts` — export `runEngineSeam`
- Modify: `packages/checks/configs/structure.ts` — add real folder rules listed below
- Modify: `packages/checks/README.md` — document the second scanner
- Copy from (first example): `packages/checks/src/structure/run.ts` (scanner shape: `ScannerResult` + `Violation`)

**Steps:**
1. Add shapes to `structureConfig` (keep existing `package-shape`). Do not add an exception/baseline list.
   - id `engine-src`, match `packages/audio-engine/src`, requiredFiles `track.ts`, `track-queue.ts`, `index.ts`
   - id `engine-source-module`, match `packages/audio-engine/src/sources`, requiredFiles `youtube.ts`
   - id `bot-src`, match `packages/bot/src`, requiredFiles `main.ts`, `command-context.ts`, `guild-music-session.ts`
   - id `bot-command-module`, match `packages/bot/src/commands`, requiredFiles `play.ts`, `skip.ts`, `queue.ts`
2. `runEngineSeam(appRoot = resolveAppRoot())`:
   - Read `packages/audio-engine/package.json`. Fail if any dependency key matches `/discord/i` or equals `@yambot/bot` or `@discordjs/voice` or `discord.js`.
   - Walk `packages/audio-engine` `*.ts` files except `node_modules`. Fail on import specifiers matching `discord.js`, `@discordjs/`, `@yambot/bot`, or a relative path that contains `/bot/`.
   - Read `packages/bot/package.json`. Fail if `@yambot/audio-engine` is missing from `dependencies`.
   - Scanner name on violations: `engine-seam`. Rules: `r1-no-discord`, `r2-arrow`.
3. Fixture test: point `runEngineSeam` at `fixtures/bad-engine` (discord.js in package.json and an `import "discord.js"`) and expect a violation. Second test: `resolveAppRoot()` on the real tree returns 0 violations.
4. `bun run checks` (no args) must run both scanners.

**Verify:**
```bash
bun test packages/checks/src/engine-seam/run.test.ts
bun run --cwd packages/checks typecheck
bun run checks
bun run checks:structure
```
Expected: seam tests exit 0. Typecheck exits 0. `bun run checks` prints `[structure] ok` and `[engine-seam] ok` and exits 0. `checks:structure` prints `[structure] ok` and exits 0.

**Out of scope:**
- R3 Java scanner (judge review, not a new empty scanner), engine or bot behavior changes, grandfathering baseline entries

**Escape hatches:**
- If adding `bot-command-module` reports `no directories matched`, STOP — command files from Tasks 3–4 are missing; do not weaken the rule.
- If the shipped engine fails the scan because of a transitive type import, STOP and report — do not add an allow list.

---

## Task 7: Write operator README, first examples, and CI

**Depends on:** 5
**Spec:** `.ai/specs/2026-08-11-slice-1-core-playback.md` § Startup and config, § Proof plan step 0, § Acceptance criteria (README, AGENTS first examples)
**Files:**
- Create: `README.md`
- Create: `.env.example`
- Modify: `package.json` — add `"start": "bun run --cwd packages/bot start"`
- Modify: `AGENTS.md` — First examples table; constitution Q4 sentence about structure rules; Validation row if the scan command needs naming
- Modify: `.ai/architecture.md` — Package shape: both app packages now exist (today vs target)
- Modify: `.github/workflows/ci.yml` — after Structure, run `bun run checks`, `bun run typecheck`, `bun test packages/audio-engine`, `bun test packages/bot`
- Copy from (first example): N/A — docs/CI, not UI

**Steps:**
1. `.env.example`:
   ```
   DISCORD_TOKEN=
   COMMAND_PREFIX=!
   ```
2. Root `README.md` in plain English, enough to pass smoke step 0 with no other docs:
   - Need Node 24+ (bot process) and bun (install/test).
   - Discord portal: create app and bot; copy token; enable Message Content intent (privileged); invite with scopes `bot` and `applications.commands` and permissions View Channel, Send Messages, Connect, Speak. Invite URL template: `https://discord.com/oauth2/authorize?client_id=CLIENT_ID&scope=bot%20applications.commands&permissions=3148800`.
   - Copy `.env.example` to `.env`, set `DISCORD_TOKEN`.
   - `bun install` then `bun start` from the repo root. Bot shows online.
   - Commands: `/play`, `/skip`, `/queue` and prefix `!play` / `!skip` / `!queue` (override with `COMMAND_PREFIX`).
   - If the process exits mentioning Message Content, flip the portal intent and restart.
   - Smoke step 11: run `node packages/bot/src/main.ts` with `DISCORD_TOKEN` unset and without relying on `.env` (PowerShell: `Remove-Item Env:DISCORD_TOKEN -ErrorAction SilentlyContinue; node packages/bot/src/main.ts`) and expect a non-zero exit plus `DISCORD_TOKEN is missing. Set it in the environment and start again.`
3. `AGENTS.md` First examples (replace `planned — slice 1` rows):
   - Core playback vertical slice → `packages/bot/src/main.ts` — command → guild session → engine resolve → audio in voice
   - Bot command module → `packages/bot/src/commands/play.ts` — one file per command: parse input, call session, reply
   - Engine source module → `packages/audio-engine/src/sources/youtube.ts` — resolve URL or search into a track; no Discord types
4. Constitution Q4 in `AGENTS.md`: structure rules for the two app packages now live in `packages/checks/configs/structure.ts`. Validation: R1/R2 scan is `engine-seam` inside `bun run checks`.
5. `.ai/architecture.md` Package shape: workspace still `packages/*`; packages that exist today are `checks`, `audio-engine`, and `bot`.
6. CI: keep bun setup; `bun install`; `bun run checks`; `bun run typecheck`; `bun test packages/audio-engine`; `bun test packages/bot`. Do not add a Java setup. Do not log in to Discord.

**Verify:**
```bash
bun run checks:structure
```
Expected: `[structure] ok`, exit 0. `README.md` contains `bun start`, `applications.commands`, `Message Content`, and `3148800`. `AGENTS.md` First examples paths exist on disk.

**Out of scope:**
- Perry, Docker, hosted SaaS, changing command behavior, committing `.env`

**Escape hatches:**
- If `permissions=3148800` is wrong for View+Send+Connect+Speak in current Discord docs, STOP and report the correct bitmask — do not omit the invite URL.
- If editing `AGENTS.md` would exceed the ~300 line cap, cut words in that file in the same change rather than moving First examples out.

---

## Task 8: Final scoped proof

**Depends on:** 6, 7
**Spec:** `.ai/specs/2026-08-11-slice-1-core-playback.md` § Acceptance criteria, § Proof plan
**Files:**
- Modify: none unless a Verify command is red (then fix only the failing package; do not start slice 2)
- Copy from (first example): N/A — proof only

**Steps:**
1. Run the commands in Verify. Record exit codes and the lines that prove each check.
2. Confirm `packages/audio-engine/package.json` has no Discord or Java dependencies and `packages/bot/package.json` depends on `@yambot/audio-engine`.
3. Confirm first-example paths in `AGENTS.md` exist.
4. List unverifiable items from the spec § Proof plan. Do not mark them proved. Human smoke steps 0–11 remain the ship gate.

**Verify:**
```bash
bun run checks
bun run typecheck
bun test packages/audio-engine
bun test packages/bot
```
Expected: `bun run checks` prints `[structure] ok` and `[engine-seam] ok` and exits 0. Typecheck exits 0 with no errors. Both test commands exit 0 with 0 fail.

**Out of scope:**
- Running the human smoke script unless the user is at the test guild with a token
- Opening a PR, `/execute`, `/judge`

**Escape hatches:**
- If any Verify command is red, STOP and fix or report — do not treat unrun or failed checks as proved.
- If live audio was not heard, the slice is unverifiable, not green.
