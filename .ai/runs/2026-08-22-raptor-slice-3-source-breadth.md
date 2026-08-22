# Raptor check — slice 3 (SoundCloud first cut)

Date: 2026-08-22
Rule: `.ai/rules/raptor-milspec.md`
Target: `.ai/specs/2026-08-22-slice-3-source-breadth.md`
Readonly lean-parts pass before `/plan`. Cuts written back into the spec
in the same turn.

## Verdict

The cut is thin enough to plan. One new source module, one new command
file, one format member, one bot lookup arm, one optional resolve field.
No registry, no engine ffmpeg, no extra package.

## Rejected (do not build)

- Plugin / source registry
- Engine Player, decoder, PCM path
- ffmpeg or `ffmpeg-static` in `packages/audio-engine`
- `util.streamTrack` / `downloadTrack` / `m3uReadableStream` (library
  helpers that spawn ffmpeg)
- Piped m3u8 playlist as the seam stream (ffmpeg stdin cannot follow
  segments)
- Second public `resolveSoundCloudTrack`
- `scsearch:` stuffed into `/play`
- Parameterized shared `executePlay(source)` helper (one file per
  command; copy `play.ts`)
- `SESSION_CREATE_COMMANDS` list or query-command array (two `||`
  checks)
- Extra format member for MPEG (`"hls/mpeg"`) — same Arbitrary arm
- PATH probe helper (`which` / `execFile` ffmpeg at play)
- `playlist-url` parse kind (YouTube throws from parse; copy that)
- Buffering the whole track before the stream starts
- Spotify module or YouTube-guess
- New workspace package, persistence, `SOUNDCLOUD_CLIENT_ID`
- New First examples row

## Kept (earns keep)

- `sources/soundcloud.ts` copied from `youtube.ts` (injectable client)
- `commands/scsearch.ts` copied from `play.ts`
- `resolve.ts` + `pickSource` — public names cannot stay on the YouTube
  module; `index.ts` stays re-exports only
- `source?: "soundcloud"` on the existing public pair
- `"hls/aac"` + bot `StreamType.Arbitrary` (PATH ffmpeg)
- HLS MPEG fallback under the same tag — one if, not a format; AAC-only
  would miss tracks that only offer MPEG
- Concatenated HLS segment bytes (streamed as they arrive)
- Structure-check growth for the two new files the week they ship

## Cuts applied to the spec

1. `parseSoundCloudQuery` throws on `/sets/` (copy `parseYoutubeQuery`).
   No `playlist-url` kind. `kind !== "track"` after resolve still
   rejects shorts that land on a set.
2. ffmpeg-miss: map the spawn error from `play`. No PATH probe.
3. HLS open: push each segment into the web stream as it arrives. Do
   not buffer the whole track.

## Ready for

`/plan`. Human approves the plan before `/execute`.
