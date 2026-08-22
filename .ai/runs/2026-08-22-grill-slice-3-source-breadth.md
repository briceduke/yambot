# Grill — slice 3 (source breadth, first cut)

Date: 2026-08-22
Target: slice 3 in `.ai/architecture.md`. No spec file exists yet. These
resolutions carry into the slice 3 spec (Design Decisions / pre-checked Open
Questions) when `/spec-writing` runs.

This grill is the first source cut, not “finish every source.”

## Already settled (recorded, not asked)

- Copy the YouTube source module: one file per site under
  `packages/audio-engine/src/sources/` (`youtube.ts` is the first example).
  No plugin registry (architecture red team).
- `/play` still calls `resolveTrack` / `openTrackAudio`. The engine
  routes URLs by host. The bot does not extract or map formats. A
  SoundCloud search command is a new command module (decision 2), not
  extractor logic in the bot.
- Playlists, radio, and live streams stay slice 4. DJ / operator config
  stay slice 5.
- R1–R4, two app packages, in-memory session, hybrid slash+prefix, zero
  Java. No new packages (AGENTS ask-first).
- `parseYoutubeQuery` today treats a non-YouTube URL as a YouTube search.
  A second source must intercept its hosts before that fallback.
- Closed format list starts as `webm/opus`. Decision 4 grows it for
  SoundCloud. Slice 1 already allowed ffmpeg at that moment.
- Transition-honesty heuristic: N/A — nothing persisted. Sessions stay
  in memory.

## Decisions

### 1. First cut is SoundCloud only; Spotify is not a source

- **In:** SoundCloud track URLs as the second engine source module. Hear
  one SoundCloud track in the test guild. Then stop this cut.
- **Out (this cut):** Bandcamp, Vimeo, Twitch, local files, HTTP.
  SoundCloud sets/playlists wait for slice 4.
- **Spotify:** not a source. Spotify’s terms block third-party streaming.
  JMusicBot refuses it (wiki: will not be added). Do not add a Spotify
  client. Do not guess a YouTube match from a Spotify URL. A later slice
  may reply that Spotify cannot be played; that is an error path, not a
  source module.
- Architecture slice 3 In/Out and product non-goals updated in the same
  turn.

### 2. Add `scsearch` this slice (both doors); `/play` search stays YouTube

- **In (both doors):** `scsearch <words>` — SoundCloud search, play or
  queue the **top hit**. No picker (same as slice 1 YouTube search).
  Slash name is `/scsearch`. Prefix is `!scsearch`. No extra alias.
- Same session rules as `play`: invoker must be in voice; one session
  per guild; occupied-channel reply; join on first play; queue if
  something is current; pause stays paused. Anyone may invoke until
  slice 5.
- Empty args → `Usage: /scsearch <SoundCloud search words>`.
- A SoundCloud **track URL** on `scsearch` still resolves (the module
  already handles that URL). A YouTube URL on `scsearch` → resolve
  error, nothing queued. SoundCloud sets/playlists still slice 4.
- **`/play`:** SoundCloud track URLs work (host dispatch). Bare search
  words stay YouTube. No `scsearch:` prefix stuffed into `/play`.
  Usage/description mention YouTube or SoundCloud URL, or YouTube
  search words.
- **Out:** `scsearch:` lavaplayer identifier on `/play`; search picker;
  playlist-file `scsearch:` lines (slice 4).
- Copy `packages/bot/src/commands/play.ts` into `scsearch.ts`. Structure
  check grows `scsearch.ts` the week it ships. Architecture slice 3 In
  updated in the same turn.

### 3. `resolveTrack` takes an optional `source` hint

- Public call becomes `resolveTrack({ query, source?: "soundcloud" })`.
  Omit `source` on `/play`: URL host dispatch (YouTube or SoundCloud);
  bare words stay YouTube search.
- `/scsearch` passes `source: "soundcloud"`: words search SoundCloud;
  a SoundCloud track URL still resolves; a YouTube URL fails; nothing
  queued on error.
- `openTrackAudio` stays `{ track }`. The track `uri` already names the
  site. No `scsearch:` stuffing in `query`. No second public
  `resolveSoundCloudTrack`.
- Bot still does not extract or map formats. The hint is which module
  owns search, not a per-source player in the bot.
- `EnginePort.resolveTrack` in `packages/bot/src/guild-music-session.ts`
  grows the same optional field. Architecture slice 3 In notes the
  seam in the same turn.

### 4. SoundCloud uses PATH ffmpeg in the bot; YouTube stays zero-transcode

- Grow `audioFormats` by one member: `"hls/aac"`. Engine still yields
  `{ stream, format }` and does not decode. Exact bytes (HLS playlist
  vs AAC payload) get pinned in the spec once the extractor is chosen.
- Bot lookup in `packages/bot/src/discord-voice.ts` grows one arm:
  `"hls/aac"` → `@discordjs/voice` ffmpeg path (`StreamType.Arbitrary`).
  `"webm/opus"` stays `StreamType.WebmOpus`. No inline volume.
- ffmpeg is a **PATH binary**. Document it next to the other operator
  install steps. Do not add `ffmpeg-static`, an opus encoder, or a
  sodium package.
- Missing ffmpeg must not block YouTube or bot startup. Opening a
  SoundCloud track without ffmpeg → user-safe error reply, nothing
  queued (or skip if already current), same class as a dead track.
- Do not transcode in `packages/audio-engine`. Do not switch YouTube
  to PCM.
- Architecture slice 3 In updated in the same turn.

### 5. SoundCloud extractor: `soundcloud.ts` (new production dependency — approved)

- `packages/audio-engine` adds `soundcloud.ts` (api-v2 wrapper; v0.7.4
  as of 2026-03; MIT). No operator SoundCloud API key. The library can
  find a client id itself. Do not add `SOUNDCLOUD_CLIENT_ID` env this
  slice.
- Copy the YouTube client seam: wrap behind an injectable client;
  tests never hit the network. Public engine surface stays
  `resolveTrack` / `openTrackAudio`.
- Hedge: if `soundcloud.ts` goes flaky, swap this source module, not
  the bot (same as `youtubei.js`).
- Rejected: `soundcloud-api-ts` (official OAuth — extra keys, and the
  client’s own rules forbid stream capture / alternative streaming).
  Rejected: `yt-dlp`. Rejected: a hand-rolled api-v2 scraper.
  Rejected: any extractor that depends on `ffmpeg-static`.
- Architecture slice 3 In updated in the same turn.

### 6. Scene walk (confirmed by user)

Happy path: user in voice. `/play https://soundcloud.com/artist/track`
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
- SoundCloud set/playlist URL: not this slice (slice 4); resolve error,
  nothing queued.
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

Invariant if Discord voice drops: slice 2 stands. Playback stops,
current is dropped, in-memory queue survives, session is kept. Next
`/play` or `/scsearch` rejoins. A drop never clears the queue.

## Grill close (2026-08-22)

- Fixed heuristics: Scene — walked and confirmed (decision 6).
  Symmetric ops — `play` / `scsearch` both enqueue on the same session;
  `remove` / `clear` / `stop` already slice 2; no new unlist for a
  source. Platform contract — ACK/defer, registration of `scsearch`,
  mention suppress, usage strings, ffmpeg-not-at-startup pinned in
  decision 6. Transition honesty — N/A (nothing persisted; YouTube
  operators who never play SoundCloud do not need ffmpeg).
- Nothing else undecided for this first slice 3 cut.
- Next: `/spec-writing` for slice 3, carrying decisions 1–6 as
  pre-checked Design Decisions / Open Questions. Raptor check (new
  source module + format enum + ffmpeg in the bot) → `/plan`. Commit
  via `/check-and-commit` only.
