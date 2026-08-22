# SoundCloud platform note (slice 3 first cut)

Platform note, not domain research. Domain (JMusicBot UX; SoundCloud as
the second source) is settled by `.ai/product.md` and the slice 3 grill:
`.ai/runs/2026-08-22-grill-slice-3-source-breadth.md`. This note records
the extractor contract and failure modes so the spec can pin bytes
without putting ffmpeg in the engine.

Facts marked **(grill)** were locked 2026-08-22. Facts marked **(lib)**
were checked against `soundcloud.ts` 0.7.4 source
(`entities/Util.ts`, `entities/Tracks.ts`, `types/TrackTypes.ts`) on
2026-08-22.

## Summary

`soundcloud.ts` (api-v2 wrapper, MIT) can find a client id itself. No
operator `SOUNDCLOUD_CLIENT_ID` this slice **(grill)**. Tracks expose
`media.transcodings` with `format.protocol` `hls` or `progressive` and
mime types `audio/mp4` (AAC) or `audio/mpeg` **(lib)**.

`util.streamTrack` / `downloadTrack` / `m3uReadableStream` spawn ffmpeg
(and will `require("ffmpeg-static")`). That path is rejected: the engine
must not decode, and `ffmpeg-static` is banned **(grill, lib)**. Use
`tracks.get`, `tracks.search`, and the transcoding URL → playlist URL
resolve (`util.streamLink` or the same HTTP call). Yield media bytes.
PATH ffmpeg lives only in the bot, on the `"hls/aac"` arm.

SoundCloud sets/playlists are slice 4. Spotify is not a source
**(grill)**.

## Answers

1. **Need an API key?** — No. `new Soundcloud()` (no args) finds a
   client id. Do not add `SOUNDCLOUD_CLIENT_ID` this slice. **(grill)**
2. **What resolves a URL or search?** — `tracks.get(url)` (also accepts
   `artist/track` shorthand). `tracks.search({ q })` returns a
   collection; play the first track. Duration on the track object is
   milliseconds. Canonical page URL is `permalink_url`. **(lib)**
3. **What audio does SoundCloud serve?** — HLS AAC (`protocol: "hls"`,
   mime starts with `audio/mp4`), HLS MPEG, and sometimes progressive
   MP3. This slice opens HLS audio only (AAC first, MPEG if no AAC) so
   the closed format list grows by one member: `"hls/aac"`. **(grill,
   lib)**
4. **What must the engine yield?** — Concatenated HLS segment bodies
   (not m3u8 playlist text). `@discordjs/voice` `StreamType.Arbitrary`
   pipes stdin to ffmpeg; ffmpeg cannot fetch playlist segments from a
   piped m3u8. The engine does not spawn ffmpeg and does not emit PCM.
   **(lib + seam)**
5. **Where does ffmpeg run?** — PATH binary in the bot, only when
   playing `"hls/aac"`. Missing ffmpeg must not block startup or
   YouTube. User-safe reply:
   `Couldn't play that SoundCloud track: ffmpeg is not installed.`
   **(grill)**
6. **Hosts?** — `soundcloud.com`, `*.soundcloud.com` (includes
   `m.` / `on.`), and `snd.sc`. Sets use `/sets/` in the path or resolve
   to a non-track kind.

## Failure modes the spec must cover

- Private, geo-blocked, or unstreamable track → resolve error, nothing
  queued.
- Empty search → resolve error, nothing queued.
- Set/playlist URL → resolve error this slice (slice 4).
- YouTube URL on `/scsearch` → resolve error, nothing queued.
- `util.streamTrack` in the engine → ffmpeg in the engine (forbidden).
- Piped m3u8 playlist to `StreamType.Arbitrary` → ffmpeg cannot follow
  segments. Yield concatenated segment bytes.
- Missing PATH ffmpeg on first SoundCloud play → pinned error; YouTube
  still plays; process stays up.
- Dead SoundCloud track mid-queue → slice 1 skip-and-advance stands.

## What CI can prove vs human smoke

CI can prove: host dispatch, source hint, URL vs search, set/playlist
reject, YouTube-URL-on-scsearch reject, format `"hls/aac"`, ffmpeg-miss
mapping, command replies — against a fake client, no network.

Only human smoke can prove: live SoundCloud resolve, audible ffmpeg
transcode in a real voice channel, YouTube still zero-transcode, slash
`/scsearch` appearing.

## Sources

- `soundcloud.ts` 0.7.4: https://github.com/Moestash/soundcloud.ts
- npm: https://www.npmjs.com/package/soundcloud.ts
- Grill: `.ai/runs/2026-08-22-grill-slice-3-source-breadth.md`
