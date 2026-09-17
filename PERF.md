# Playback performance

Measured 2026-09-13 on a Cloud Agent VM.

- `bun run bench:perf` — Java-free injected delays. CI-safe.
- `bun run bench:load` — headless N-session scale. Default webm/opus.
  `--mode mock` is the unit-test subset. Not in GitHub Actions.
- `bun run bench:vs-lavalink` — opt-in JDK harness. Downloads pinned
  Lavalink **4.2.2**. Never CI.

Live YouTube playable audio and Discord UDP stay unverifiable here.

## Commands

```
bun run bench:perf
bun run bench:load
bun run bench:load --mode webm --sessions 1,10,50,100
bun run bench:load --mode mock --sessions 1,2
bun run bench:vs-lavalink
```

`bench:vs-lavalink` prints JSON, then a markdown winner table. Needs
JDK 17+ and ffmpeg. See `scripts/bench-lavalink/README.md`.

## Winner table (same VM, local HTTP mpeg fixture)

Host: bun 1.4.0, OpenJDK 21.0.10, Lavalink 4.2.2, youtube-plugin 1.18.2
on disk, n = 10. Same localhost sine file for both sides.

Lower p50 wins. End-user-shaped numbers, not Node vs JVM fairness.

| Metric | yambot p50 | yambot p95 | Lavalink p50 | Lavalink p95 | Δ p50 | winner |
|---|---:|---:|---:|---:|---:|---|
| http_mpeg_load_ms | 0.005 | 431.384 | 2.557 | 96.004 | −2.552 | **yambot** |
| http_mpeg_ttfa_ms | 0.425 | 1.106 | 2.884 | 48.58 | −2.459 | **yambot** |
| http_mpeg_skip_ms | 1.11 | 2.657 | 3.462 | 9.55 | −2.352 | **yambot** |
| http_mpeg_rss_mb | 126.37 | | 301.63 | | −175.26 | **yambot** |
| http_mpeg_cpu_pct | 1.37 | | 2.5 | | −1.13 | **yambot** |
| youtube_url_load_ms | 86.383 | | — | | | **can't tell yet** |
| soundcloud_url_load_ms | 627.73 | | — | | | **can't tell yet** |

HTTP `open_ms` (not a winner row) is remux spawn plus playable webm
prefix: p50 **34.8 ms**. Decoder work sits there. TTFA is WebmOpus
Playing of that ready stream.

### Method notes

- yambot HTTP URLs with `.mp3` / `.opus` skip HEAD and resolve in
  process. Lavalink `loadtracks` probes the stream.
- Skip plays the next resource immediately (no 5×20 ms silence pad).
- Lavalink `frameBufferDurationMs` stayed at the example **5000**.
- Scale rows mix yambot **webm/opus passthrough** with Lavalink **HTTP
  mpeg** players. That matches each product’s cheap path.

## Scale

### yambot webm/opus (headless AudioPlayer, no Discord UDP)

From the same `bench:vs-lavalink` session. Hold 2 s. Queue depth 50,
then 3 skip-storms per session. Fail rate 0 through N = 100. N = 1
TTFA is a warmed playNow.

| N | ttfa p50 | ttfa p95 | skip p50 | skip p95 | rss_mb | heap_mb | cpu_pct | lag max | fail_rate |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 0.775 | 0.775 | 1.302 | 1.302 | 127.23 | 18.52 | 1.58 | 1.985 | 0 |
| 10 | 3.593 | 3.663 | 2.14 | 4.145 | 139.5 | 19.11 | 3.92 | 4.094 | 0 |
| 50 | 16.034 | 16.152 | 11.008 | 19.211 | 155.98 | 20.13 | 11.46 | 18.997 | 0 |
| 100 | 20.689 | 20.814 | 18.152 | 29.673 | 171.77 | 28.39 | 12.21 | 29.981 | 0 |

### Lavalink N HTTP players (TrackStartEvent, no Discord voice)

| N | ttfa p50 | ttfa p95 | rss_mb | fail_rate | notes |
|---:|---:|---:|---:|---:|---|
| 1 | 3.252 | 3.252 | 301.66 | 0 | |
| 10 | 11.987 | 27.753 | 304.03 | 0 | |
| 50 | 49.912 | 110.966 | 312.65 | 0 | |
| 100 | 17.135 | 63.621 | 315.84 | **0.81** | **cliff:** 81 / 100 PATCH/TrackStart timed out (8 s) |

N = 100 survivor p50 is not a finish. The winner row gives N to the
side that completed (fail_rate < 5%).

### Scale winner rows

| Metric | yambot p50 | Lavalink p50 | winner |
|---|---:|---:|---|
| scale_ttfa_ms_N1 | 0.775 | 3.252 | **yambot** |
| scale_rss_mb_N1 | 127.23 | 301.66 | **yambot** |
| scale_ttfa_ms_N10 | 3.593 | 11.987 | **yambot** |
| scale_rss_mb_N10 | 139.5 | 304.03 | **yambot** |
| scale_ttfa_ms_N50 | 16.034 | 49.912 | **yambot** |
| scale_rss_mb_N50 | 155.98 | 312.65 | **yambot** |
| scale_ttfa_ms_N100 | 20.689 | 17.135 | **yambot** (Lavalink fail_rate 0.81) |
| scale_rss_mb_N100 | 171.77 | 315.84 | **yambot** |

## Injected-delay bench (`bun run bench:perf`)

Not a Lavalink comparison. Fake InnerTube delays. n = 10.

YouTube InnerTube double uses `createYoutubeClientFromInnertube` with
a fake session: `getInfo` 60 ms, `getBasicInfo` 30 ms, `download` 30 ms.
Search adds 30 ms. `ttfa_ms` is `executePlay` until `currentTrack` is
set. Voice is mocked. Injected delays: join 40 ms, resolve 40 ms, open
50 ms. `skip_ms` waits until the next track has been prefetched.

| Metric | p50 | p95 | n |
|---|---:|---:|---:|
| resolve_ms youtube_url | 30.102 | 30.554 | 10 |
| resolve_ms youtube_search | 60.175 | 61.373 | 10 |
| resolve_ms soundcloud_url | 0.005 | 0.289 | 10 |
| open_audio_ms youtube | 30.149 | 30.397 | 10 |
| open_audio_ms soundcloud | 5.068 | 5.176 | 10 |
| youtube_resolve_then_open_ms | 30.132 | 32.697 | 10 |
| playlist_enqueue_ms engine | 0.206 | 0.922 | 10 |
| ttfa_ms | 90.189 | 91.373 | 10 |
| skip_ms | 1.078 | 1.242 | 10 |
| rss_mb | 80.87 | | |
| heap_mb | 13.89 | | |
| cpu_pct | 1.89 | | |

Held vs the earlier injected table (resolve-then-open −50%, play-to-current
−31%, skip −98%). Same-session `bench:vs-lavalink` re-ran this harness:
ttfa p50 90.312, skip p50 1.092.

Kept: InnerTube `getBasicInfo` + one-shot media cache; play door starts
join, resolve, and open together; session prefetches the next
`openTrackAudio`; playlist continuation stops at `>= 1000` playable;
HLS segments pull body chunks instead of `arrayBuffer` per segment.

Not in the tree: idle remux worker pool, 50 ms warm sleep, bot-start
prewarm, duplicate play/scsearch door, duplicate bench stats, HTTP mpeg
load mode (cliffed at N=1; not a winner row).

## LavaPlayer map

Full write-up: `.ai/research/audio-playback-performance.md`.

| yambot | LavaPlayer / Lavalink | Fair? |
|--------|------------------------|-------|
| `resolve_ms` | REST `loadtracks` | Same stage. Network differs. |
| `open_audio_ms` | Track process until first frame | Lavalink example buffer 5000 ms. |
| `ttfa_ms` | `playTrack` until first frame | Headless: Lavalink `TrackStartEvent`. |
| `skip_ms` | stop + `playTrack(next)` | yambot prefetches the next open. |
| `rss_mb` / `cpu_pct` | JVM heap + native | Unfair as a bake-off. Measured anyway. |

YouTube Opus passthrough is the shared idea. HTTP MPEG remuxes to
webm/opus at open through PATH ffmpeg, then plays as WebmOpus.
SoundCloud HLS still uses PATH ffmpeg at play (`StreamType.Arbitrary`).

## Remaining

- Playable InnerTube / YouTube hear-audio: can't tell yet from a Cloud
  Agent. This run got a yambot metadata resolve (86 ms); Lavalink load
  timed out.
- SoundCloud HLS still spawns ffmpeg at play.
- Skip immediately after enqueue still waits for an in-flight open.
- Discord UDP / audible TTFA: human smoke only.

## Human smoke (Brice)

1. Play a YouTube URL in the test guild. Hear audio.
2. Queue a second track, wait a moment, skip. Hear the next track with
   no long gap.
3. Play a YouTube playlist URL. First track plays; the rest enqueue.
4. SoundCloud URL still plays (ffmpeg on PATH).
5. Prefix `!play` still matches slash `/play`.
