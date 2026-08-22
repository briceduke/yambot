# Task 1: Add the SoundCloud source module

**Depends on:** none
**Spec:** `.ai/specs/2026-08-22-slice-3-source-breadth.md` § Seam (`audioFormats`), § SoundCloud module
**Branch:** `cursor/slice-3-source-breadth-spec-8fe8`
**Lessons:** R1 engine Discord-free; R2 bot → engine; R3 no Java; R4 UX only. Copy `youtube.ts`. No engine ffmpeg. No `/check-and-commit`. Do not edit `.ai/plans/`.

**Files:**
- Modify: `packages/audio-engine/src/track.ts` — `audioFormats` gains `"hls/aac"`
- Create: `packages/audio-engine/src/sources/soundcloud.ts`
- Create: `packages/audio-engine/src/sources/soundcloud.test.ts`
- Modify: `packages/audio-engine/package.json` — add `soundcloud.ts` `^0.7.4`
- Modify: `bun.lock` — only via `bun add` in this package
- Copy from (first example): `packages/audio-engine/src/sources/youtube.ts`

**Steps:**
1. Set `audioFormats` to `["webm/opus", "hls/aac"] as const`.
2. `bun add soundcloud.ts@^0.7.4 --cwd packages/audio-engine`. No `ffmpeg-static`. No `SOUNDCLOUD_CLIENT_ID`.
3. Copy the YouTube injectable-client seam. Export `SoundCloudClient`, `parseSoundCloudQuery`, `resolveSoundCloudTrackWithClient`, `openSoundCloudAudioWithClient`. Do not export public `resolveTrack` / `openTrackAudio`. Do not edit `index.ts`.
4. Implement parse, resolve, open, and HLS segment streaming as spec § SoundCloud module (throw on `/sets/`; push segments as they arrive). Default client: `new Soundcloud()` with no args. Never call `util.streamTrack` / `downloadTrack` / `m3uReadableStream`.
5. Tests against a fake `SoundCloudClient` only. No network.

**Verify:**
```bash
bun test packages/audio-engine/src/sources/soundcloud.test.ts
bun run --cwd packages/audio-engine typecheck
```
Expected: tests exit 0 with 0 fail. Typecheck exits 0. `package.json` lists `soundcloud.ts` and not `ffmpeg-static`.

**Out of scope:**
- `resolve.ts`, `index.ts`, `youtube.ts` public pair, `discord-voice.ts`, structure check

**Escape hatches:**
- If `youtube.ts` is missing `YoutubeClient` / `*WithClient`, STOP.
- If `soundcloud.ts` cannot construct without a key, STOP and report.
