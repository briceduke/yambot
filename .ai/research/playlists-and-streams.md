# Playlists and streams research (slice 4)

Platform note plus a short domain pass. Discord ACK/registration is already
settled in `.ai/research/discord-and-youtube-platform.md`. YouTube extraction
and SoundCloud HLS bytes are settled in that note and
`.ai/research/soundcloud-platform.md`. This file covers playlist expand and
HTTP radio/stream facts this cut needs.

## Summary

JMusicBot plays YouTube playlists, SoundCloud sets, and HTTP radio through
`/play` (no separate playlist product). YouTube playlist load is capped at
1000 tracks by default (`maxytplaylistpages = 10`, 100 tracks per page).
`youtubei.js` already in the engine exposes `getPlaylist(id)` with
continuation. `soundcloud.ts` already in the engine exposes
`playlists.get(url)` with a `tracks` array. HTTP radio is a progressive
audio body (Icecast/Shoutcast MP3/AAC/OGG) played through PATH ffmpeg; it
does not need a new package. Skip and stop on a live stream are the same
session operations as a track: skip ends the current item; stop leaves.

## Sources surveyed

- **JMusicBot commands / config** — UX reference for playlist and stream
  play, and the 1000-track YouTube cap
- **youtubei.js v18** — InnerTube `getPlaylist` / continuation already a
  production dependency
- **soundcloud.ts 0.7.x** — `playlists.get` already a production dependency
- **Discord / `@discordjs/voice`** — `StreamType.Arbitrary` + PATH ffmpeg
  already used for `"hls/aac"`
- **Slice 1–3 specs** — `resolveTrack` returns one `Track`; slice 1 said
  widening that signature is slice 4; SoundCloud `/sets/` rejects until now

## Shared patterns

### 1. Playlist URL on the existing play command
- **JMusicBot**: `/play` with a playlist URL loads the list into the queue
- **This app (slice 3)**: YouTube `/playlist` and SoundCloud `/sets/` throw
  `Playlists are not supported yet.`
- **Why it is common**: one door; no second playlist product

### 2. Cap long playlists
- **JMusicBot**: 10 YouTube pages × ~100 = 1000 tracks default
- **youtubei.js**: `has_continuation` / `getContinuation()` can run forever
  on Mix (`RD…`) lists
- **Why it is common**: Mixes and huge lists must not grow without bound

### 3. Live HTTP as one queue item
- **JMusicBot / lavaplayer-class**: HTTP URLs and Icecast play as one item;
  skip ends them; stop leaves
- **This app**: random `https://` URLs today fall through to YouTube search
- **Why it is common**: a stream has no track list; duration is unknown

## Answers to research questions

1. **Which playlist sites belong in the first cut?** — YouTube playlist URLs
   and SoundCloud sets. Both extractors already exist. SoundCloud sets were
   parked in slice 3 for this slice. Bandcamp and local playlist folders
   wait. (JMusicBot supports more sites; architecture says not every site
   at once.)
2. **How does youtubei.js load a playlist?** — `innertube.getPlaylist(id)`
   returns `info.title` and `items` (`PlaylistVideo` has `id`, `title`,
   `duration.seconds`, `is_playable`). `has_continuation` +
   `getContinuation()` pages further. Do not call `getInfo` per item at
   resolve time; open audio when that track plays.
3. **How does soundcloud.ts load a set?** — `soundcloud.playlists.get(url)`
   returns `{ title, tracks: SoundcloudTrack[] }` and fetches unresolved
   track ids. Reuse track fields already mapped in slice 3 (`permalink_url`,
   duration ms, HLS transcodings).
4. **What is a sane cap?** — 1000 tracks, matching JMusicBot’s default.
   Truncate after 1000; say so in the reply.
5. **What is a live stream here?** — An `http(s)` URL that is not YouTube
   or SoundCloud and that serves a progressive audio body (`audio/mpeg`,
   `audio/aac`, `audio/ogg`, `application/ogg`, `audio/opus`, `audio/mp4`).
   One `Track` with `durationSeconds: 0`. PATH ffmpeg via
   `StreamType.Arbitrary`. No new package.
6. **Skip/stop on a stream?** — Same as a track. Skip stops the current
   resource and advances (or empties). Stop wipes and leaves. A live
   stream does not end on its own; skip is how the user leaves it. Idle
   leave only runs when nothing is current.
7. **Watch URL with `list=`?** — Slice 1 already prefers `v=` and plays
   that one video. Keep that. Only `/playlist?list=` (or a YouTube URL
   with `list=` and no video id) expands.
8. **Random web page URLs?** — Must still YouTube-search (slice 1). Detect
   streams with an audio file extension, or a HEAD `Content-Type` that is
   audio. If HEAD fails or is not audio, YouTube search.

## Source-specific notes

### JMusicBot
- `/play` loads YouTube playlists and HTTP streams. Local `Playlists/`
  folder and `/play playlist` are a separate product — architecture Out.
- `maxytplaylistpages = 10` → 1000 tracks.
- Stop clears and leaves. Skip ends the current item (vote-skip is slice 5).

### youtubei.js
- Playlist id is the `list` query param (`PL…`, `UU…`, `OL…`, `RD…`).
- Mix ids (`RD…`) continue without end — the cap is required.
- `watch?v=ID&list=PL…` still has a video id; do not expand.

### soundcloud.ts
- Path `/sets/` is a playlist. `playlists.get` follows short links.
- `util.streamTrack` still banned (ffmpeg in the engine). Open each
  track later with the existing HLS segment walk.

### HTTP / Icecast
- Progressive MP3/AAC/OGG bodies work as ffmpeg stdin (`Arbitrary`).
- HLS radio (`m3u8` master playlists) and M3U/PLS-of-URLs are extra
  parsers. Cut them from this first cut.
- Title: `icy-name` if present, else the URL path’s last segment, else
  the hostname.

## Recommended approach for this app

1. Widen `resolveTrack` to return `{ tracks, playlistTitle }` (slice 1
   promised one signature change). Single track and live stream are
   `tracks.length === 1` with `playlistTitle: null`.
2. Expand YouTube `/playlist?list=` and SoundCloud `/sets/` inside the
   existing source modules. Cap 1000. Copy `youtube.ts` / `soundcloud.ts`.
3. Add a thin `sources/http.ts` for progressive HTTP audio only. New
   format `"http/mpeg"` mapped to the same bot Arbitrary/ffmpeg arm.
   No new production dependency.
4. Bot `/play` (and `scsearch` when a set URL is pasted): play the first
   track if idle, enqueue the rest, reply `Added N tracks from {title}.`
   No new command. No playlist product.

## Sources

- https://jmusicbot.com/commands/
- https://jmusicbot.com/config/
- https://github.com/jagrosh/MusicBot
- https://github.com/LuanRT/YouTube.js (Innertube.getPlaylist)
- https://www.npmjs.com/package/soundcloud.ts
- https://github.com/Tenpi/soundcloud.ts/blob/master/entities/Playlists.ts
- `.ai/research/discord-and-youtube-platform.md`
- `.ai/research/soundcloud-platform.md`
- `.ai/specs/2026-08-11-slice-1-core-playback.md` (resolve widening)
- `.ai/specs/2026-08-22-slice-3-source-breadth.md` (sets deferred)
