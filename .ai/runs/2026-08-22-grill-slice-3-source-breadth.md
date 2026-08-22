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
