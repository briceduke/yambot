# Task 3: Embed nowplaying

**Depends on:** 1
**Spec:** N/A — plan Design rules § Command embed shape (nowplaying exception)
**Branch:** `cursor/embeds-and-docs`
**Lessons:** Copy `reply-embed.ts`. Flag live Discord as unverifiable. Do not edit `.ai/plans/`.

**Files:**
- Modify: `packages/bot/src/commands/nowplaying.ts`
- Modify: `packages/bot/src/commands/nowplaying.test.ts`
- Copy from: `packages/bot/src/reply-embed.ts`; module shape `packages/bot/src/commands/play.ts`

**Steps:**
1. Nothing playing: `replyEmbed({ color: EMBED_COLOR.error, description: "Nothing is playing." })`.
2. Current track: title `Paused` or `Now playing`; color `warn` if paused else `info`.
3. Description line 1: `{status}: {title} ({elapsed} / {duration})` from `playbackDurationMs`. Line 2: `formatProgressBar` (omit if `""`). No `<url>` in body. Set `url` to `track.uri` and `thumbnailUrl` to `youtubeThumbnailUrl(track.uri)`.
4. Tests: empty still `"Nothing is playing."`; playing/paused assert line 1 without URL and a 12-char bar when duration is 213 and elapsed is 65 s. FakeContext uses `recordedReplyText`.

**Verify:**
```bash
bun test packages/bot/src/commands/nowplaying.test.ts packages/bot/src/doors.test.ts
bun run --cwd packages/bot typecheck
```
Expected: exit 0. Doors `!np` still equals `Nothing is playing.`

**Out of scope:** live-edit nowplaying, `queue.ts`, engine `Track` fields
**Escape hatches:** If `playbackDurationMs` or `formatProgressBar` is missing, STOP.
