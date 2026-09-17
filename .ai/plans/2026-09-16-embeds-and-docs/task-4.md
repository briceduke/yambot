# Task 4: Embed queue

**Depends on:** 1
**Spec:** N/A — plan Design rules § Command embed shape
**Branch:** `cursor/embeds-and-docs`
**Lessons:** Copy `reply-embed.ts`. Keep today’s queue lines. Do not edit `.ai/plans/`.

**Files:**
- Modify: `packages/bot/src/commands/queue.ts`
- Modify: `packages/bot/src/commands/queue.test.ts`
- Copy from: `packages/bot/src/reply-embed.ts`; keep `formatQueueText` in this file

**Steps:**
1. Do not change `formatQueueText` bytes (empty, leftover header, `Now:`, numbered rows, cap 10, `…and {k} more.`).
2. Empty: color `error`, no title, description `Nothing is playing and the queue is empty.`
3. Non-empty: title `Queue`, color `info`, description is `formatQueueText` output.
4. FakeContext uses `recordedReplyText`. Keep assertion strings.

**Verify:**
```bash
bun test packages/bot/src/commands/queue.test.ts packages/bot/src/doors.test.ts
bun run --cwd packages/bot typecheck
```
Expected: exit 0. Existing `toEqual` strings and doors empty-queue strings still pass.

**Out of scope:** pause marker on rows, raising the cap, `nowplaying.ts`
**Escape hatches:** If line rules in `queue.ts` differ, keep that format — do not invent a third layout.
