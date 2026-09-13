# Audio playback performance vs LavaPlayer

Domain research for the playback-performance slice. Not a platform note.
Peers: LavaPlayer (Java library), Lavalink (Java process that wraps it),
yambot (this repo: youtubei.js + @discordjs/voice, zero Java).

## Summary

LavaPlayer loads a track (`loadItem`), then a per-player thread fills a
frame buffer and `provide()` yields 20 ms Opus packets. YouTube Opus can
pass through with no re-encode when volume is 1. yambot already does the
same passthrough idea for YouTube webm/opus (`StreamType.WebmOpus`). The
fair comparison is stage-to-stage (resolve / open / first frame / skip),
not JVM vs Node wall times on different machines.

This repo must not add LavaPlayer, Lavalink, or any Java as a **product
or CI** dependency (constitution R3). Optional
`bun run bench:vs-lavalink` may spawn a throwaway JDK. Default
`bun test` never execs `java`.

## Questions

1. What are LavaPlayer’s load and play stages, and how do they map to
   yambot `resolveTrack`, `openTrackAudio`, and Discord send?
2. What buffering and Opus behavior does LavaPlayer document?
3. Which published numbers exist, and which comparisons are unfair?
4. How would a human run a throwaway Lavalink side-by-side without
   making Java required for CI?

## Answers

### 1. Stage map

| yambot metric | LavaPlayer / Lavalink stage | Notes |
|---|---|---|
| `resolve_ms` | `AudioPlayerManager.loadItem` / REST `loadtracks` | Identifier → `AudioTrack` metadata. Playlist load does not fetch each video page. |
| `open_audio_ms` | Track process start until first encoded frame is readable | LavaPlayer opens the container and starts the playback thread. |
| `ttfa_ms` | `loadItem` + `playTrack` until first non-null `provide()` | Lavalink adds a WebSocket hop to the bot. yambot is in-process. |
| `skip_ms` | Stop current + `playTrack(next)` (or track-end handler) | LavaPlayer can already have the next track loaded. |
| `rss_mb` / `heap_mb` | JVM heap + native off-heap | LavaPlayer claims ~350 KB per playing YouTube track plus a thread stack. |
| `cpu_pct` / event-loop lag | `provide()` returning null; GC pauses | Lavalink uses JDA-NAS `bufferDurationMs` (example 400 ms) against GC. |
| `playlist_enqueue_ms` | `playlistLoaded` then queue | Same idea: list metadata, not N+1 `getInfo`. |

Sources: [lavalink-devs/lavaplayer README](https://github.com/lavalink-devs/lavaplayer/blob/main/README.md), [Lavalink `application.yml.example`](https://github.com/lavalink-devs/Lavalink/blob/master/LavalinkServer/application.yml.example).

### 2. Buffering and Opus

- Discord wants 20 ms Opus frames. LavaPlayer’s `AudioPlayer.provide`
  supplies them. When input is already Opus and volume is unchanged,
  packets pass through (no decode/encode).
- Lavalink example config: `frameBufferDurationMs: 5000` (how much
  audio to keep buffered) and `bufferDurationMs: 400` (NAS buffer vs
  GC pauses). Lower buffer → snappier start, more underrun risk.
- yambot YouTube path: `youtubei.js` download of webm/opus →
  `@discordjs/voice` `StreamType.WebmOpus` demux. No ffmpeg, no opus
  encoder. Same passthrough idea, different runtime.
- yambot SoundCloud HLS and HTTP MPEG still spawn PATH ffmpeg
  (`StreamType.Arbitrary`). LavaPlayer decodes those in-process with
  native codecs and does not spawn ffmpeg.

### 3. Published numbers and unfair rows

Public LavaPlayer docs do **not** publish a standard `resolve_ms` p50.
They publish design claims: low per-track memory, Opus passthrough,
one thread per playing track, playlist load without per-item page
fetches.

Unfair if treated as a bake-off without labels:

- JVM vs Node / bun (GC vs event loop).
- Network and YouTube bot walls (Cloud Agent IPs often get
  `LOGIN_REQUIRED`).
- Discord gateway, DAVE, and UDP send — not in the engine.
- Lavalink’s extra process and WebSocket vs yambot in-process.
- Default 5 s frame buffer vs yambot’s demux-as-it-arrives path.

### 4. Opt-in Lavalink bake-off (not CI)

`bun run bench:vs-lavalink` downloads pinned Lavalink 4.2.2, serves a
local HTTP sine fixture, times REST `loadtracks` and WS
`TrackStartEvent` (no Discord), runs `bun run bench:perf` and
`bench:load` on the same box, and prints a winner table. JDK 17+
required. Numbers live in `PERF.md`.

Live YouTube/SoundCloud: attempt once with a 12 s cap. Bot-wall or
timeout → `can't tell yet`. Audible Discord UDP is still human smoke.

Default `bun run bench:perf` / `bench:load --mode mock` / CI stay
Java-free. Do not add a Lavalink submodule, Docker Java service, or
test that execs `java`.

## Recommendation for this app

Keep the LavaPlayer comparison as a mapping table plus labeled numbers.
Improve yambot by cutting extra InnerTube round trips, overlapping join
with resolve/open, and opening the next track before skip. Do not copy
LavaPlayer’s player-manager / frame-buffer / thread-per-track design
(R4). Measure with `bun run bench:perf`. For a same-machine winner
table, `bun run bench:vs-lavalink` (opt-in Java). For N-session
behavior, `bun run bench:load`.
