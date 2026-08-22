# Task 2: Map `hls/aac` to PATH ffmpeg

**Depends on:** 1
**Spec:** `.ai/specs/2026-08-22-slice-3-source-breadth.md` § Bot format lookup
**Branch:** `cursor/slice-3-source-breadth-spec-8fe8`
**Lessons:** PATH ffmpeg in the bot only. No engine ffmpeg. No PATH probe. No `/check-and-commit`. Do not edit `.ai/plans/`.

**Files:**
- Modify: `packages/bot/src/discord-voice.ts` — lookup arm + spawn-error map
- Create: `packages/bot/src/discord-voice.test.ts` — mapper and lookup tests
- Copy from (first example): N/A — not a command module

**Steps:**
1. Add `"hls/aac": StreamType.Arbitrary`. Keep `"webm/opus": StreamType.WebmOpus`. No `inlineVolume`. No `ffmpeg-static`. Do not edit `track.ts`.
2. Export `streamTypeFor(format: AudioFormat): StreamType`.
3. On `"hls/aac"` play, map a missing-ffmpeg spawn error to `Couldn't play that SoundCloud track: ffmpeg is not installed.` No PATH probe. `"webm/opus"` stays unchanged.
4. Export `mapHlsPlayError(error: unknown): Error`. Tests must not spawn ffmpeg.

**Verify:**
```bash
bun test packages/bot/src/discord-voice.test.ts
bun run --cwd packages/bot typecheck
```
Expected: tests exit 0 with 0 fail. Typecheck exits 0. `streamTypeFor("hls/aac")` is `StreamType.Arbitrary`. Fake `FFmpeg/avconv not found!` maps to the pinned message.

**Out of scope:**
- `soundcloud.ts`, `resolve.ts`, `play.ts`, `scsearch.ts`, README

**Escape hatches:**
- If `playbackInputByFormat` is missing, extend the lookup that exists — do not add a second player.
- If `StreamType.Arbitrary` is missing from `@discordjs/voice`, STOP and report.
