# Task 4: Map `http/mpeg` to PATH ffmpeg

**Depends on:** 2
**Spec:** `.ai/specs/2026-08-27-slice-4-playlists-and-streams.md` § Bot format lookup
**Branch:** `cursor/slice-4-playlists-and-streams-957a`
**Lessons:** PATH ffmpeg in the bot only. No PATH probe. No `ffmpeg-static`. No `/check-and-commit`. Do not edit `.ai/plans/`.

**Files:**
- Modify: `packages/bot/src/discord-voice.ts`
- Modify: `packages/bot/src/discord-voice.test.ts`
- Copy from: N/A — extend the existing lookup

**Steps:**
1. Add `"http/mpeg": StreamType.Arbitrary`. Keep `"webm/opus"` and `"hls/aac"`.
2. Export `mapHttpPlayError`. Missing ffmpeg → `Couldn't play that stream: ffmpeg is not installed.` `play` uses `mapHlsPlayError` for `"hls/aac"` and `mapHttpPlayError` for `"http/mpeg"`.
3. Tests: `streamTypeFor("http/mpeg")` is Arbitrary; fake ffmpeg-miss maps to the stream string; hls mapper still uses the SoundCloud string.

**Verify:**
```bash
bun test packages/bot/src/discord-voice.test.ts
bun run --cwd packages/bot typecheck
```
Expected: exit 0, 0 fail.

**Out of scope:** `play.ts`, `http.ts`, README, structure check
**Escape hatches:** If `"http/mpeg"` is missing from `AudioFormat`, STOP.
