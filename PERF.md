# Playback performance

Two benches, one machine (Cloud Agent VM, 2026-09-13).

- `bun run bench:perf` — Java-free injected delays. CI-safe.
- `bun run bench:load` — headless N-session scale. Default webm/opus.
  `--mode mock` is the unit-test subset. Not in GitHub Actions.
- `bun run bench:vs-lavalink` — opt-in JDK harness. Downloads pinned
  Lavalink **4.2.2**. Never CI.

Live YouTube playable audio and Discord UDP stay unverifiable here.

## Commands

```
bun run bench:perf
bun run bench:perf --n 10
bun run bench:load
bun run bench:load --mode webm --sessions 1,10,50,100
bun run bench:load --mode http --sessions 1,10
bun run bench:load --mode mock --sessions 1,2
bun run bench:vs-lavalink
bun run bench:vs-lavalink --n 10
```

`bench:vs-lavalink` prints JSON, then a markdown winner table. Needs
JDK 17+ and ffmpeg. See `scripts/bench-lavalink/README.md`.

## Winner table (same VM, local HTTP mpeg fixture)

Host: bun 1.4.0, OpenJDK 21.0.10, Lavalink 4.2.2, youtube-plugin 1.18.2
on disk, n = 10. Same localhost sine file for both sides.

Lower p50 wins. Brice asked for end-user-shaped numbers, not Node vs
JVM fairness.

| Metric | yambot p50 | yambot p95 | Lavalink p50 | Lavalink p95 | Δ p50 | winner |
|---|---:|---:|---:|---:|---:|---|
| http_mpeg_load_ms | 0.007 | 382.592 | 2.306 | 85.681 | −2.299 | **yambot** |
| http_mpeg_ttfa_ms | 0.476 | 1.181 | 2.685 | 45.144 | −2.209 | **yambot** |
| http_mpeg_skip_ms | 1.322 | 1.897 | 2.99 | 5.619 | −1.668 | **yambot** |
| http_mpeg_rss_mb | 129.73 | | 305.98 | | −176.25 | **yambot** |
| http_mpeg_cpu_pct | 1.85 | | 3.49 | | −1.64 | **yambot** |
| youtube_url_load_ms | 118.749 | | — | | | **can't tell yet** |
| soundcloud_url_load_ms | 708.639 | | — | | | **can't tell yet** |

HTTP `open_ms` (not a winner row) is remux first playable webm prefix: p50 **20.7 ms**. Decoder work sits there, then TTFA is WebmOpus Playing of that ready stream.

### Call for Brice (30 seconds)

- **yambot wins every measurable row** on this VM: HTTP load, first-frame TTFA, skip, RSS, CPU, and scale TTFA/RSS at N = 1, 10, 50, 100.
- **Can't tell yet:** playable live YouTube/SoundCloud vs Lavalink (Lavalink `loadtracks` hit the 12 s cap; yambot metadata resolve returned). Audible Discord UDP.

### What was unfair vs still end-user relevant

- yambot HTTP URLs with `.mp3` / `.opus` skip HEAD and resolve in
  process. Lavalink `loadtracks` probes the stream. Users of `/play` on
  a file URL still feel that load gap.
- yambot HTTP TTFA is playNow of already-opened (remuxed) audio until
  `@discordjs/voice` Playing. Lavalink TTFA is PATCH of an already-loaded
  track until `TrackStartEvent`. Neither is audible UDP. Remux cost is
  `open_ms` (~21 ms), same stage as LavaPlayer filling a frame buffer.
- Skip no longer waits 5×20 ms silence padding. Next track play replaces
  the resource immediately.
- Lavalink `frameBufferDurationMs` stayed at the example **5000**.
- Scale rows mix yambot **webm/opus passthrough** with Lavalink **HTTP
  mpeg** players. That matches each product’s cheap path: YouTube-like
  vs Lavalink HTTP source. Same-codec HTTP scale for yambot still
  hitchs the event loop on ffmpeg remux spawn (lag max 407 ms at N = 1).
  Do not use HTTP mpeg as the scale story.

## Scale

### yambot webm/opus (headless AudioPlayer, no Discord UDP)

`bun run bench:load --mode webm --sessions 1,10,50,100`. Hold 2 s.
Queue depth 50, then 3 skip-storms per session. Fail rate 0 through
N = 100. No cliff. N = 1 TTFA is a warmed playNow (one discarded
session first).

| N | ttfa p50 | ttfa p95 | skip p50 | skip p95 | rss_mb | heap_mb | cpu_pct | lag max | fail_rate |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 0.793 | 0.793 | 1.534 | 1.534 | 130.55 | 26.56 | 3.37 | 2.417 | 0 |
| 10 | 3.214 | 3.281 | 1.97 | 3.864 | 142.57 | 27.18 | 5.94 | 4.366 | 0 |
| 50 | 16.761 | 16.873 | 7.183 | 13.284 | 157.88 | 25.67 | 11.68 | 16.324 | 0 |
| 100 | 20.932 | 21.063 | 17.683 | 28.415 | 177.21 | 32.91 | 13.06 | 27.306 | 0 |

RSS grows slowly (~0.4 MB per extra session from N = 10 to 100). CPU
3.4% → 13%. Skip stays under 30 ms p95 at N = 100 (was ~100–190 ms when
skip waited on 5 silence frames).

### Lavalink N HTTP players (TrackStartEvent, no Discord voice)

| N | ttfa p50 | ttfa p95 | rss_mb | fail_rate | notes |
|---:|---:|---:|---:|---:|---|
| 1 | 4.225 | 4.225 | 306.06 | 0 | |
| 10 | 9.857 | 23.875 | 308.58 | 0 | |
| 50 | 46.682 | 133.754 | 318.3 | 0 | |
| 100 | 20.385 | 81.284 | 321.25 | **0.81** | **cliff:** 81 / 100 PATCH/TrackStart timed out (8 s) |

JVM RSS is almost flat (heap already reserved). TTFA p95 rises N = 1 →
50. N = 100 is the Lavalink cliff on this VM when starting players in
batches of 10 without Discord. Survivor p50 at N = 100 is not a finish;
the winner row gives the N to the side that completed (fail_rate < 5%).

### yambot HTTP mpeg (remux at open, then WebmOpus)

`bun run bench:load --mode http --sessions 1` still **cliffs at N = 1**:
event-loop lag max **407 ms** (threshold 250 ms). TTFA p50 15 ms after
warmup. Skip 2.6 ms. Remux spawn still hitches the loop. Do not use
HTTP mpeg as the scale story.

### Scale winner rows (webm yambot vs Lavalink HTTP players)

| Metric | yambot p50 | Lavalink p50 | winner |
|---|---:|---:|---|
| scale_ttfa_ms_N1 | 0.793 | 4.225 | **yambot** |
| scale_rss_mb_N1 | 130.55 | 306.06 | **yambot** |
| scale_ttfa_ms_N10 | 3.214 | 9.857 | **yambot** |
| scale_rss_mb_N10 | 142.57 | 308.58 | **yambot** |
| scale_ttfa_ms_N50 | 16.761 | 46.682 | **yambot** |
| scale_rss_mb_N50 | 157.88 | 318.3 | **yambot** |
| scale_ttfa_ms_N100 | 20.932 | 20.385 | **yambot** (Lavalink fail_rate 0.81) |
| scale_rss_mb_N100 | 177.21 | 321.25 | **yambot** |

## Injected-delay bench (`bun run bench:perf`)

Not a Lavalink comparison. Fake InnerTube delays. n = 10.

YouTube InnerTube double uses `createYoutubeClientFromInnertube` with
a fake session: `getInfo` 60 ms, `getBasicInfo` 30 ms, `download` 30 ms.
Search adds 30 ms. `ttfa_ms` is `executePlay` until `currentTrack` is
set. Voice is mocked. Injected delays: join 40 ms, resolve 40 ms, open
50 ms. `skip_ms` waits until the next track has been prefetched.

### Baseline (hot path on `main`, before cuts)

| Metric | p50 | p95 | n |
|---|---:|---:|---:|
| resolve_ms youtube_url | 30.167 | 30.591 | 10 |
| resolve_ms youtube_search | 60.366 | 61.573 | 10 |
| resolve_ms soundcloud_url | 0.004 | 0.257 | 10 |
| open_audio_ms youtube | 30.211 | 30.397 | 10 |
| open_audio_ms soundcloud | 5.189 | 5.267 | 10 |
| youtube_resolve_then_open_ms | 60.402 | 62.362 | 10 |
| playlist_enqueue_ms engine | 0.189 | 0.921 | 10 |
| ttfa_ms | 130.574 | 131.910 | 10 |
| skip_ms | 50.200 | 50.815 | 10 |
| playlist_enqueue_ms bot queue | 0.152 | 0.442 | 10 |
| rss_mb | 81.55 | | |
| heap_mb | 13.87 | | |
| cpu_pct | 3.34 | | |

### After cuts (same injected harness)

| Metric | p50 | p95 | n | vs baseline p50 |
|---|---:|---:|---:|---:|
| resolve_ms youtube_url | 30.239 | 30.678 | 10 | flat (see note) |
| resolve_ms youtube_search | 60.497 | 61.572 | 10 | flat |
| resolve_ms soundcloud_url | 0.004 | 0.281 | 10 | flat |
| open_audio_ms youtube | 30.255 | 30.529 | 10 | flat (cold open) |
| open_audio_ms soundcloud | 5.160 | 5.368 | 10 | flat |
| youtube_resolve_then_open_ms | 30.337 | 32.498 | 10 | **−50%** |
| playlist_enqueue_ms engine | 0.133 | 0.968 | 10 | flat (noise) |
| ttfa_ms | 90.506 | 91.670 | 10 | **−31%** |
| skip_ms | 1.107 | 1.383 | 10 | **−98%** |
| playlist_enqueue_ms bot queue | 0.169 | 0.372 | 10 | flat |
| rss_mb | 80.45 | | | flat |
| heap_mb | 13.90 | | | flat |
| cpu_pct | 3.23 | | | flat |

Same-session `bench:vs-lavalink` re-ran this harness (n = 10): ttfa p50
90.608, skip p50 1.14. Matches the table.

Kept: InnerTube `getBasicInfo` + one-shot media cache; play door starts
join, resolve, and open together; session prefetches the next
`openTrackAudio`; playlist continuation stops at `>= 1000` playable;
HLS segments pull body chunks instead of `arrayBuffer` per segment.

## LavaPlayer map

Full write-up: `.ai/research/audio-playback-performance.md`.

| yambot | LavaPlayer / Lavalink | Fair? |
|--------|------------------------|-------|
| `resolve_ms` | `AudioPlayerManager.loadItem` / REST `loadtracks` | Same stage. Network differs. |
| `open_audio_ms` | Track process until first frame in the buffer | LavaPlayer also fills `frameBufferDurationMs` (Lavalink example 5000 ms). |
| `ttfa_ms` | load + `playTrack` until first non-null `provide()` | Headless: Lavalink `TrackStartEvent`. yambot HTTP is WebmOpus Playing of remuxed audio. |
| `skip_ms` | stop + `playTrack(next)` | LavaPlayer can already have the next track loaded. yambot now prefetches the next open. |
| `playlist_enqueue_ms` | `playlistLoaded` without per-item page fetches | Same idea. |
| `cpu_pct` / event-loop lag | `provide()` returning null; JVM GC vs Node event loop | Unfair as a bake-off. Still end-user RSS/CPU on one box. |
| `rss_mb` / `heap_mb` | JVM heap + native | Unfair without the same workload. Measured anyway on this VM. |

YouTube Opus passthrough is the shared idea: LavaPlayer skips
decode/encode when volume is 1; yambot uses `StreamType.WebmOpus` and
does not spawn ffmpeg for YouTube. HTTP MPEG remuxes to webm/opus at
open through PATH ffmpeg, then plays as WebmOpus. SoundCloud HLS still
uses PATH ffmpeg at play (`StreamType.Arbitrary`).

## Remaining

- Playable InnerTube / YouTube bot checks. This run got a yambot
  metadata resolve (119 ms); Lavalink load timed out. Hear-audio still
  can’t tell yet from a Cloud Agent.
- SoundCloud HLS still spawns ffmpeg at play. HTTP mpeg remux still
  hitchs the event loop if you scale that path.
- Skip immediately after enqueue still waits for an in-flight open.
- Discord UDP / DAVE send and audible TTFA: human smoke only.

## Human smoke (Brice)

1. Play a YouTube URL in the test guild. Hear audio.
2. Queue a second track, wait a moment, skip. Hear the next track with
   no long gap.
3. Play a YouTube playlist URL. First track plays; the rest enqueue.
4. SoundCloud URL still plays (ffmpeg on PATH).
5. Prefix `!play` still matches slash `/play`.
