# Task 8: Embed prefix, setdj, settc, and setvc

**Depends on:** 1
**Spec:** N/A — plan Design rules § Command embed shape
**Branch:** `cursor/embeds-and-docs`
**Lessons:** Copy `reply-embed.ts`. Do not change overlay writes. Do not edit `.ai/plans/`.

**Files:**
- Modify: `packages/bot/src/commands/prefix.ts`, `prefix.test.ts`
- Modify: `packages/bot/src/commands/setdj.ts`, `setdj.test.ts`
- Modify: `packages/bot/src/commands/settc.ts`, `settc.test.ts`
- Modify: `packages/bot/src/commands/setvc.ts`, `setvc.test.ts`
- Copy from: `packages/bot/src/reply-embed.ts`; `packages/bot/src/commands/play.ts`

**Steps:**
1. Wrap every `ctx.reply` with `replyEmbed`. Description is the exact current string (ticks and `<@&id>` / `<#id>` stay).
2. Color `error`: usage and `Prefix must be 1 to 8 characters.`
3. Color `ok`: set and clear success lines.
4. No titles. Do not change parse or overlay writes.
5. FakeContexts use `recordedReplyText`. Keep assertion strings.

**Verify:**
```bash
bun test packages/bot/src/commands/prefix.test.ts packages/bot/src/commands/setdj.test.ts packages/bot/src/commands/settc.test.ts packages/bot/src/commands/setvc.test.ts
bun run --cwd packages/bot typecheck
```
Expected: exit 0.

**Out of scope:** `operator-config.ts`, `door-gates.ts`, help/settings
**Escape hatches:** If an overlay setter name differs, call the function that exists.
