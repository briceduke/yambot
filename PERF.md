# Playback performance

Offline numbers from `bun run bench:perf` on this branch. No Java. Live
YouTube and Discord voice are unverifiable from a Cloud Agent (InnerTube
bot wall; no test-guild token).

## Command

```
bun run bench:perf
bun run bench:perf --n 10
```

Prints JSON, then a markdown table.

## Methodology

- n = 10. p50 / p95 from linear interpolation on sorted samples.
- YouTube InnerTube double uses `createYoutubeClientFromInnertube` with
  a fake session: `getInfo` 60 ms (watch + next, unused after the cut),
  `getBasicInfo` 30 ms, `download` 30 ms. Search adds 30 ms.
- SoundCloud open injects 5 ms. Playlist enqueue uses 1000 fake tracks.
- `ttfa_ms` is `executePlay` until `currentTrack` is set. Voice is
  mocked. Injected delays: join 40 ms, resolve 40 ms, open 50 ms.
- `skip_ms` waits until the next track has been prefetched, then times
  `skipCurrent()` until that track is current. Immediate skip after
  enqueue is a different case (open still in flight).
- `cpu_pct` / event-loop lag: 2 s sine webm/opus via ffmpeg, played with
  `@discordjs/voice` `NoSubscriberBehavior.Play`. Not Discord UDP send.
- Live InnerTube / audible Discord: can’t tell yet.

## Baseline (hot path on `main`, before cuts)

Captured on this branch with the new harness, before InnerTube cache,
join∥resolve∥open, and prefetch. Same injected delays. n = 10.

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

`youtube_url` resolve used `getInfo` in production. The fake delayed
that call 30 ms (same as `getBasicInfo`). Real InnerTube `getInfo` also
hits watch_next; this harness does not add a second 30 ms on that row.
The measured win for dropping watch_next is therefore **can’t tell yet**
on this fake. `youtube_resolve_then_open_ms` *does* show the extra
`download`/`getBasicInfo` round trip (30 ms).

## After changes

Same machine, same command, n = 10.

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
| event_loop_lag_ms mean | 0.107 | max 1.485 | | |

Kept: InnerTube `getBasicInfo` + one-shot media cache; play door starts
join, resolve, and open together; session prefetches the next
`openTrackAudio`; playlist continuation stops at `>= 1000` playable;
HLS segments pull body chunks instead of `arrayBuffer` per segment.

Discarded: changing isolated cold `open_audio_ms` (must still
`download` when there is no cached player response).

## LavaPlayer map

Full write-up: `.ai/research/audio-playback-performance.md`.

| yambot | LavaPlayer / Lavalink | Fair? |
|--------|------------------------|-------|
| `resolve_ms` | `AudioPlayerManager.loadItem` / REST `loadtracks` | Same stage. Network differs. |
| `open_audio_ms` | Track process until first frame in the buffer | LavaPlayer also fills `frameBufferDurationMs` (Lavalink example 5000 ms). |
| `ttfa_ms` | load + `playTrack` until first non-null `provide()` | Lavalink adds a WebSocket hop. yambot is in-process. |
| `skip_ms` | stop + `playTrack(next)` | LavaPlayer can already have the next track loaded. yambot now prefetches the next open. |
| `playlist_enqueue_ms` | `playlistLoaded` without per-item page fetches | Same idea. Both already avoid N+1 `getInfo`. |
| `cpu_pct` / event-loop lag | `provide()` returning null; JVM GC vs Node event loop | Unfair as a bake-off. |
| `rss_mb` / `heap_mb` | JVM heap + native (~350 KB/track claimed) | Unfair without the same workload and runtime. |

YouTube Opus passthrough is the shared idea: LavaPlayer skips
decode/encode when volume is 1; yambot uses `StreamType.WebmOpus` and
does not spawn ffmpeg for YouTube. SoundCloud HLS and HTTP MPEG still
use PATH ffmpeg here; LavaPlayer decodes those in-process.

No published standard `resolve_ms` p50 for LavaPlayer. Do not treat
this table as a same-machine bake-off.

### Optional human Lavalink side-by-side (not CI)

A person with Java can run a throwaway Lavalink, time REST `loadtracks`
for the same URL, and time play-to-audible in a test guild. Paste as
`live/human` into this file. Never add Java to `bun test` or CI.

## Remaining

- InnerTube RTT and YouTube bot checks (`LOGIN_REQUIRED` on Cloud Agent
  IPs). Live `resolve_ms` / `open_audio_ms` can’t tell yet.
- ffmpeg spawn for SoundCloud HLS and HTTP MPEG.
- Skip immediately after enqueue still waits for an in-flight open.
- Discord UDP / DAVE send and audible TTFA: human smoke only.
- Isolated cold YouTube `open_audio_ms` still pays `download`.

## Human smoke (Brice)

1. Play a YouTube URL in the test guild. Hear audio.
2. Queue a second track, wait a moment, skip. Hear the next track with
   no long gap.
3. Play a YouTube playlist URL. First track plays; the rest enqueue.
4. SoundCloud URL still plays (ffmpeg on PATH).
5. Prefix `!play` still matches slash `/play`.
