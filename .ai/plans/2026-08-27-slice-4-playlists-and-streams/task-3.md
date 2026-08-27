# Task 3: Add Added-N play UX

**Depends on:** 1
**Spec:** `.ai/specs/2026-08-27-slice-4-playlists-and-streams.md` § `play` command, § `scsearch` command, § EnginePort
**Branch:** `cursor/slice-4-playlists-and-streams-957a`
**Lessons:** Copy `play.ts`. Do not share `executePlay`. No `/check-and-commit`. Do not edit `.ai/plans/`.

**Files:**
- Modify: `packages/bot/src/guild-music-session.ts` — `EnginePort.resolveTrack` → `ResolveResult`
- Modify: `packages/bot/src/guild-music-session.test.ts` — fake type
- Modify: `packages/bot/src/commands/play.ts` and `play.test.ts`
- Modify: `packages/bot/src/commands/scsearch.ts` and `scsearch.test.ts`
- Modify: `packages/bot/src/commands/stop.test.ts` and `doors.test.ts` if they implement `EnginePort`
- Copy from: `packages/bot/src/commands/play.ts`

**Steps:**
1. Import `ResolveResult`. Change `EnginePort.resolveTrack` return type. Update fakes.
2. `play.ts` usage: `Usage: /play <YouTube, SoundCloud, playlist, or stream URL, or YouTube search words>`. Description: `Play a URL (video, playlist, set, or stream) or YouTube search words.` Idle: `playNow(tracks[0])` then enqueue rest. Occupied: enqueue all; stay paused. `playNow` throw → error reply, enqueue nothing else.
3. Replies: `playlistTitle === null` and one track → existing Playing/Queued. Else Added line; idle prefixes Playing for first track; truncated appends ` (capped at 1000).`
4. `scsearch.ts`: same unwrap; still `source: "soundcloud"`.
5. Tests listed in the spec § Acceptance criteria (bot bullets).

**Verify:**
```bash
bun test packages/bot/src/commands/play.test.ts packages/bot/src/commands/scsearch.test.ts packages/bot/src/guild-music-session.test.ts
bun run --cwd packages/bot typecheck
```
Expected: exit 0, 0 fail. If Task 2 already added `"http/mpeg"` and Task 4 has not mapped it, bot typecheck may fail on `playbackInputByFormat` — do not edit `discord-voice.ts`; report Verify deferred for typecheck in that case and still run the tests.

**Out of scope:** `discord-voice.ts`, `http.ts`, README, `TrackQueue`
**Escape hatches:** If `ResolveResult` is not exported, STOP.
