# Task 1: Widen resolve and expand YouTube / SoundCloud playlists

**Depends on:** none
**Spec:** `.ai/specs/2026-08-27-slice-4-playlists-and-streams.md` § Seam, § YouTube module, § SoundCloud module
**Branch:** `cursor/slice-4-playlists-and-streams-957a`
**Lessons:** R1 engine Discord-free; R2 bot → engine; R3 no Java; R4 UX only. Copy `youtube.ts`. No engine ffmpeg. No `/check-and-commit`. Do not edit `.ai/plans/`.

**Files:**
- Modify: `packages/audio-engine/src/track.ts` — `ResolveResult`, `MAX_PLAYLIST_TRACKS`
- Modify: `packages/audio-engine/src/index.ts` — export those
- Modify: `packages/audio-engine/src/sources/youtube.ts` and `youtube.test.ts`
- Modify: `packages/audio-engine/src/sources/soundcloud.ts` and `soundcloud.test.ts`
- Modify: `packages/audio-engine/src/resolve.ts` and `resolve.test.ts`
- Copy from: `packages/audio-engine/src/sources/youtube.ts`

**Steps:**
1. Add `MAX_PLAYLIST_TRACKS = 1000` and `ResolveResult { tracks, playlistTitle, truncated }` to `track.ts`. Do not add `"http/mpeg"`.
2. `resolveTrackWithClient`, `resolveSoundCloudTrackWithClient`, `resolveTrackWithClients`, and `resolveTrack` return `ResolveResult`. Wrap one-track paths as `{ tracks: [track], playlistTitle: null, truncated: false }`.
3. YouTube: `playlist-id` when `list` is set and no video id. Watch+`list=` stays `video-id`. Empty `/playlist` → `That playlist has no playable tracks.` Default client: `innertube.getPlaylist` + continuation to 1000. Skip `isPlayable === false`. Failures → `Couldn't play that playlist.` Empty title → `"playlist"`.
4. SoundCloud: `/sets/` is `playlist-url`. `getPlaylist` wraps `playlists.get`. `getTrack` kind playlist calls `getPlaylist`. Drop no-HLS. Never `util.streamTrack` / `downloadTrack`.
5. Fake-client tests only. No network. Update existing one-track asserts to `ResolveResult`.

**Verify:**
```bash
bun test packages/audio-engine
bun run --cwd packages/audio-engine typecheck
```
Expected: exit 0, 0 fail. No `"http/mpeg"` yet.

**Out of scope:** `packages/bot/**`, `http.ts`, structure check, README
**Escape hatches:** If `getPlaylist` or `playlists.get` is missing, STOP.
