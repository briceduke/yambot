# Playback performance bench and hot-path cuts

**Status:** implemented (draft PR)
**Research:** `.ai/research/audio-playback-performance.md`
**Grill:** N/A — autonomous (cloud `/goal`). Resolutions marked
**Autonomous** in Open questions.
**Raptor:** `.ai/runs/2026-09-13-raptor-audio-playback-performance.md`
**Depends on:** slice 1 vertical cut (`packages/bot/src/main.ts`,
`packages/audio-engine/src/sources/youtube.ts`), slice 4 playlist cap.

## Problem

Playback latency and skip delay are not measured. YouTube resolve then
open likely pays InnerTube twice. Play joins voice, then resolves, then
opens. Skip waits for idle, then opens the next track. There is no
apples-to-apples map to LavaPlayer stages.

## Goals

- A Java-free `bun run bench:perf` prints JSON and a markdown table
  with the required metrics (p50, p95, n≥10 offline).
- `PERF.md` records baseline vs post-change numbers, methodology, and
  the LavaPlayer map.
- Keep only production changes that improve a metric (or hold the
  metric and cut CPU/memory/latency elsewhere).
- Draft PR. Human smoke remains unverifiable here.

## Non-goals

- Slice 5 / PR #9 operator surface.
- Lavalink, JVM, lavaplayer as a product or CI dependency (R3).
- New workspace packages.
- Copying LavaPlayer internals (R4).
- Breaking slash/prefix UX.
- Merging to main.
- `enqueueAll` on `TrackQueue` (slice 4 raptor refuse).

## Design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Bench home | `packages/audio-engine/src/bench/` and `packages/bot/src/bench/`; root `bun run bench:perf` | Existing packages. No new workspace package. |
| Offline default | Injected clients and delayed engine/voice | CI and Cloud Agent cannot play YouTube. |
| Live YouTube | Out of default command; optional later env | Cloud Agent InnerTube is blocked. |
| LavaPlayer | Research table + optional human note | R3: no Java in product or CI. |
| YouTube info | `getBasicInfo` + one-shot cache into `download` | `getInfo` hits watch+next; `download` already uses `getBasicInfo`. |
| Play door | Start join and resolve together; start open before join finishes when idle | Join, resolve, and open do not depend on each other. |
| Skip | Prefetch next `openTrackAudio` while current plays | Cuts `skip_ms` by the open delay. |
| TrackQueue | Add `peek()` only | Prefetch needs the head. No `enqueueAll`. |
| Docs | `PERF.md` at repo root | User-requested artifact. |
| Scene | No new user-facing command | Faster play/skip on existing doors. |
| Proof | typecheck, scoped tests, `bun run checks`, bench command | Voice still human smoke. |

## Open questions

- [x] Where does the bench live? — **Answer (Autonomous):** engine + bot
  `src/bench`, root script. No fourth package.
- [x] May we add Java for comparison? — **Answer (Autonomous):** No.
  Research + optional human steps only.
- [x] Prefetch vs skip-overlap only? — **Answer (Autonomous):** Prefetch
  the next track after enqueue/play. Abandon on shuffle/remove/clear.

## Behavior

Commands, replies, and error strings stay the same. Users should hear
the first track sooner when join and resolve overlap, and hear the next
track sooner on skip when the next open is already done.

### Scene

- Happy: `/play` URL while in voice → Playing reply → audio. `/skip` with
  a queued track → next title plays.
- Fail join: same join error reply; do not play.
- Fail resolve: same resolve error reply.
- Fail open on skip: existing “Skipping … couldn’t play it” advance.

### Client / platform

Slash still defers in `main.ts`. No new command names. No ACK change.
Unverifiable: live YouTube, audible skip, playlist in the test guild.

## Proof

- `bun run typecheck`
- `bun test packages/audio-engine`
- `bun test packages/bot`
- `bun run checks`
- `bun run bench:perf` (offline; n=10)
- Human smoke (Brice): play YouTube in the test guild, hear audio, skip,
  play a playlist.

## Unverifiable

Live InnerTube, Discord voice send, audible quality, skip in a real
guild.
