# Task 5: Embed skip, pause, and resume

**Depends on:** 1
**Spec:** N/A — plan Design rules § Command embed shape
**Branch:** `cursor/embeds-and-docs`
**Lessons:** Copy `reply-embed.ts`. Keep call order. Do not edit `.ai/plans/`.

**Files:**
- Modify: `packages/bot/src/commands/skip.ts`, `skip.test.ts`
- Modify: `packages/bot/src/commands/pause.ts`, `pause.test.ts`
- Modify: `packages/bot/src/commands/resume.ts`, `resume.test.ts`
- Copy from: `packages/bot/src/reply-embed.ts`; `packages/bot/src/commands/play.ts`

**Steps:**
1. Every `ctx.reply` → `ctx.reply("", replyEmbed({ ... }))`.
2. Description is the exact current string (`Nothing is playing.`, `Already paused.`, `Nothing is paused.`, `Skipped: {title}`, `Paused: {title}`, `Resumed: {title}`).
3. Color `error` on failures; `ok` on success. No title.
4. Success: `url` + `youtubeThumbnailUrl` from `session.currentTrack`.
5. Skip replies then `skipCurrent`. Pause then reply. Unpause then reply.
6. FakeContexts use `recordedReplyText`. Keep assertion strings.

**Verify:**
```bash
bun test packages/bot/src/commands/skip.test.ts packages/bot/src/commands/pause.test.ts packages/bot/src/commands/resume.test.ts packages/bot/src/doors.test.ts
bun run --cwd packages/bot typecheck
```
Expected: exit 0.

**Out of scope:** `stop.ts`, session pause logic, `play-from-query.ts`
**Escape hatches:** If a success reply has no track, send description only.
