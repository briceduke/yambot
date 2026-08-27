# Raptor check — slice 4 (playlists and streams)

Date: 2026-08-27
Rule: `.ai/rules/raptor-milspec.md`
Target: `.ai/specs/2026-08-27-slice-4-playlists-and-streams.md`
Readonly lean-parts pass before `/plan`. Cuts written back into the spec
in the same turn.

## Verdict

The cut is thin enough to plan. Widen one resolve signature, extend two
existing source modules, add one HTTP module copied from `youtube.ts`,
add one format member, grow `/play` replies. No new command, package, or
dependency.

## Rejected (do not build)

- `/playlist` command or local `Playlists/` folder (architecture Out)
- Bandcamp / Twitch / local file playlists
- HLS radio (`m3u8`) and M3U/PLS-of-URLs
- `isLive` on `Track` and a `LIVE` duration label
- Second public resolve function (`resolveQuery` + `resolveTrack`)
- `TrackQueue.enqueueAll` / `session.playPlaylist`
- Shared `executePlay` helper (copy `play.ts` into `scsearch.ts`)
- Plugin registry; engine Player; engine ffmpeg; `ffmpeg-static`
- New production dependency or workspace package
- YouTube `getInfo` per playlist item at resolve time
- Changing watch+`list=` into a playlist expand

## Kept (earns keep)

- `ResolveResult` on existing `resolveTrack` (slice 1 promised this widen)
- YouTube `playlist-id` + SoundCloud `playlist-url` inside current modules
- Cap 1000 (Mix continuations would not stop)
- `sources/http.ts` injectable client (third source module, copies
  `youtube.ts`)
- `"http/mpeg"` + bot Arbitrary arm (not a lie on `"hls/aac"`)
- HEAD/extension detect so web pages still YouTube-search
- `Added N tracks from {title}.` one line (queue listing already exists)

## Cuts applied to the spec

1. HLS radio and M3U/PLS expand are Non-goals.
2. No `isLive` / `LIVE` — `durationSeconds: 0` is enough.
3. No `enqueueAll` — the command loops `enqueue`.
4. HTTP fallback uses a router-only `NOT_HTTP_STREAM` error, not a user
   string.

## Ready for

`/plan`. Operator already approved autopilot execute for remaining
slices; plan status may be set approved after write.
