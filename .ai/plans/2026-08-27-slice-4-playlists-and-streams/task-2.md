# Task 2: Add the HTTP stream source module

**Depends on:** 1
**Spec:** `.ai/specs/2026-08-27-slice-4-playlists-and-streams.md` § HTTP module, § Host dispatch
**Branch:** `cursor/slice-4-playlists-and-streams-957a`
**Lessons:** R1 engine Discord-free; R3 no Java. Copy `youtube.ts`. `fetch` only — no new npm dep. No `/check-and-commit`. Do not edit `.ai/plans/`.

**Files:**
- Modify: `packages/audio-engine/src/track.ts` — `audioFormats` += `"http/mpeg"`
- Create: `packages/audio-engine/src/sources/http.ts`
- Create: `packages/audio-engine/src/sources/http.test.ts`
- Modify: `packages/audio-engine/src/resolve.ts` and `resolve.test.ts`
- Copy from: `packages/audio-engine/src/sources/youtube.ts`

**Steps:**
1. `audioFormats = ["webm/opus", "hls/aac", "http/mpeg"] as const`.
2. Export `HttpStreamClient`, `parseHttpQuery`, `resolveHttpStreamWithClient`, `openHttpAudioWithClient`, `getDefaultHttpStreamClient`, and `NOT_HTTP_STREAM`. No public `resolveTrack`.
3. Audio extensions `.mp3 .aac .ogg .opus .m4a` skip probe. Else HEAD; audio Content-Type → stream; else throw `NOT_HTTP_STREAM`. Title: icy-name / path / host. `durationSeconds: 0`. Open GET body, format `"http/mpeg"`. No m3u8. No ffmpeg. Default HEAD 5s abort.
4. `pickSource` `"http"` for non-YT/SC `http(s)`. Router: catch `NOT_HTTP_STREAM` and YouTube-resolve the same query. `openTrackAudioWithClients` routes other `http(s)` URIs to HTTP.
5. Fake-client tests: extension stream; probe not audio; open format; `https://example.com` falls back to YouTube.

**Verify:**
```bash
bun test packages/audio-engine/src/sources/http.test.ts packages/audio-engine/src/resolve.test.ts
bun run --cwd packages/audio-engine typecheck
```
Expected: exit 0, 0 fail.

**Out of scope:** `packages/bot/**`, playlist logic, structure check, README
**Escape hatches:** If `ResolveResult` is missing, STOP. If a new npm dep is required, STOP.
