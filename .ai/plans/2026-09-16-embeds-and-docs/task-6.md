# Task 6: Embed remove, shuffle, clear, and stop

**Depends on:** 1
**Spec:** N/A — plan Design rules § Command embed shape
**Branch:** `cursor/embeds-and-docs`
**Lessons:** Copy `reply-embed.ts`. Do not change session writes. Do not edit `.ai/plans/`.

**Files:**
- Modify: `packages/bot/src/commands/remove.ts`, `remove.test.ts`
- Modify: `packages/bot/src/commands/shuffle.ts`, `shuffle.test.ts`
- Modify: `packages/bot/src/commands/clear.ts`, `clear.test.ts`
- Modify: `packages/bot/src/commands/stop.ts`, `stop.test.ts`
- Copy from: `packages/bot/src/reply-embed.ts`; `packages/bot/src/commands/play.ts`

**Steps:**
1. Wrap every `ctx.reply` with `replyEmbed`. Description is the exact current string.
2. Color `error`: remove usage, `No track at position {n}.`, `The queue is empty.`, `Nothing is playing.`
3. Color `ok`: `Removed: {title}`, `Shuffled {n} tracks.`, `Cleared {n} tracks.`, `Stopped.`
4. No titles. On remove success, `url` / thumbnail from the removed track.
5. Keep `removeUpcomingAt`, `shuffleUpcoming`, `clearUpcoming`, `dropSession` as they are.
6. FakeContexts use `recordedReplyText`. Keep assertion strings.

**Verify:**
```bash
bun test packages/bot/src/commands/remove.test.ts packages/bot/src/commands/shuffle.test.ts packages/bot/src/commands/clear.test.ts packages/bot/src/commands/stop.test.ts packages/bot/src/doors.test.ts
bun run --cwd packages/bot typecheck
```
Expected: exit 0. Doors `!leave` and remove-position-1 still pass.

**Out of scope:** skip/pause/resume, leave-policy timers
**Escape hatches:** If `dropSession` usage differs, keep the current call order.
