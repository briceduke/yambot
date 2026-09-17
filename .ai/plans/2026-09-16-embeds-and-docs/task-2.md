# Task 2: Embed play-door replies

**Depends on:** 1
**Spec:** N/A — plan Design rules § Command embed shape
**Branch:** `cursor/embeds-and-docs`
**Lessons:** Copy `reply-embed.ts`. Description equals today’s plain string. Do not edit `.ai/plans/`.

**Files:**
- Modify: `packages/bot/src/play-from-query.ts`
- Modify: `packages/bot/src/commands/play.test.ts`
- Modify: `packages/bot/src/commands/scsearch.test.ts`
- Copy from: `packages/bot/src/reply-embed.ts`, `packages/bot/src/play-from-query.ts`

**Steps:**
1. Import `EMBED_COLOR`, `replyEmbed`, `youtubeThumbnailUrl` from `./reply-embed.ts`.
2. Every `ctx.reply` becomes `ctx.reply("", replyEmbed({ ... }))`.
3. Usage / not in voice / occupied / resolve fail / empty / join fail: color `error`, description is the exact previous string.
4. Success: description is `playingOrAddedReply` / `queuedReply` / `addedReply` output. Title `Playing` / `Queued` / `Added`. Color `ok`. Single known track: `url` + `youtubeThumbnailUrl(track.uri)`.
5. Do not edit `play.ts` or `scsearch.ts`. Do not change words.
6. Both FakeContexts: `this.replies.push(recordedReplyText(text, options))`.

**Verify:**
```bash
bun test packages/bot/src/commands/play.test.ts packages/bot/src/commands/scsearch.test.ts packages/bot/src/doors.test.ts
bun run --cwd packages/bot typecheck
```
Expected: exit 0. `Playing: Never Gonna Give You Up (3:33)` and doors join-voice strings still pass.

**Out of scope:** `play.ts`, `scsearch.ts`, `main.ts`, nowplaying, queue
**Escape hatches:** If `replyEmbed` is missing, STOP. Wrap strings that exist in `play-from-query.ts` — do not invent copy.
