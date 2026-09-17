# Plan — playback performance bench and hot-path cuts

**Spec:** `.ai/specs/2026-09-13-audio-playback-performance.md`
**Status:** approved (cloud `/goal` execute)
**Lessons:** engine-seam, product (R3/R4), platform (youtubei.js download
quality/client), process (proof trichotomy; commit in parent). Digest:
engine stays Discord-free; zero Java; do not copy LavaPlayer; flag live
voice as unverifiable; commit through `/check-and-commit` in-process.

## Out of scope

PR #9 / slice 5. Java in CI. New packages. `enqueueAll`. Merging.
Dashboard / remote player protocol.

## Parallel groups

### Group 1 — harness (serial with Group 2: same files later)

1. Bench stats, engine bench, bot bench, `bun run bench:perf`, research,
   spec, `PERF.md` methodology. Record baseline on current hot path.

### Group 2 — wins (after baseline)

2. YouTube `getBasicInfo` + media cache; SoundCloud track cache; playlist
   continuation stop at `>= MAX_PLAYLIST_TRACKS`; HLS body stream.
3. `TrackQueue.peek`, session prefetch, play door join∥resolve∥open.

## Tasks

### Task 1 — Offline bench

- Paths: `packages/audio-engine/src/bench/*`, `packages/bot/src/bench/*`,
  `scripts/bench-perf.ts`, root `package.json`
- First example: `packages/audio-engine/src/sources/youtube.ts` client
  seam; `packages/bot/src/guild-music-session.test.ts` FakeVoice
- Verify: `bun run bench:perf --n 10` prints JSON with `resolve_ms`,
  `open_audio_ms`, `ttfa_ms`, `skip_ms`, `rss_mb`, `heap_mb`, `cpu_pct`
  or event-loop lag, `playlist_enqueue_ms`. `bun test` stats tests.
- Out: live YouTube in CI.

### Task 2 — Engine hot path

- Paths: `packages/audio-engine/src/sources/youtube.ts`,
  `packages/audio-engine/src/sources/soundcloud.ts`
- Verify: wrapper test: resolve+open calls `getBasicInfo` once when
  cached; playlist continuation does not fetch past the cap; typecheck;
  `bun test packages/audio-engine`
- Out: new InnerTube clients, ffmpeg in the engine.

### Task 3 — Session and play door

- Paths: `packages/audio-engine/src/track-queue.ts`,
  `packages/bot/src/guild-music-session.ts`,
  `packages/bot/src/commands/play.ts`
- First example: `packages/bot/src/commands/play.ts`,
  `packages/bot/src/guild-music-session.ts`
- Verify: play test with delayed join+resolve finishes faster than the
  sum; skip test with delayed open is below open delay after prefetch;
  `bun test packages/bot`
- Out: UX string changes.

### Task 4 — PERF.md and AGENTS

- Paths: `PERF.md`, `AGENTS.md`, `README.md`
- Verify: baseline and post-change tables filled from real
  `bun run bench:perf` output. LavaPlayer map present. Human smoke
  listed.

## Proof

Same as spec. Draft PR. Do not merge.

## Escape

If a change does not improve a metric, revert it. If live YouTube is
blocked, keep offline numbers and label live as can’t tell yet.
