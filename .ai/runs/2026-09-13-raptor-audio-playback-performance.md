# Raptor pass — playback performance

Readonly check of `.ai/rules/raptor-milspec.md` against
`.ai/specs/2026-09-13-audio-playback-performance.md`.

## Verdict

Pass with the listed refuses.

## Earn keep

- One root bench command, two package `src/bench` folders: required
  metrics live next to the code they time.
- `peek()` on `TrackQueue`: prefetch needs the head without dequeue.
- One-shot YouTube media cache inside the existing InnerTube wrapper:
  removes a duplicate player fetch without a new package.
- Prefetch of the next open: one extra in-flight stream per guild,
  abandoned on shuffle/remove/clear.

## Refuse

- New workspace package.
- Java / Lavalink in CI or product deps.
- `enqueueAll` (slice 4 already refused).
- A second public resolve API.
- Plugin registry, remote player protocol, dashboard.
- Copying LavaPlayer `AudioPlayerManager` / frame-buffer / thread-per-track.
