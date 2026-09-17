# Task 7: Embed help and settings

**Depends on:** 1
**Spec:** N/A — plan Design rules § Command embed shape
**Branch:** `cursor/embeds-and-docs`
**Lessons:** Copy `reply-embed.ts`. Keep body helpers. Do not edit `.ai/plans/`.

**Files:**
- Modify: `packages/bot/src/commands/help.ts`, `help.test.ts`
- Modify: `packages/bot/src/commands/settings.ts`, `settings.test.ts`
- Copy from: `packages/bot/src/reply-embed.ts`; keep `formatHelpBody` / `formatSettingsBody`

**Steps:**
1. Do not change `formatHelpBody` or `formatSettingsBody` output.
2. Help: title `Help`, color `info`, description is the body string.
3. Settings: title `Settings`, color `info`, description is the body string.
4. No Discord fields. Keep `@mention` and `@bot` as words.
5. FakeContexts use `recordedReplyText`. Keep assertion strings.

**Verify:**
```bash
bun test packages/bot/src/commands/help.test.ts packages/bot/src/commands/settings.test.ts packages/bot/src/doors.test.ts
bun run --cwd packages/bot typecheck
```
Expected: exit 0. Doors help still contains `Music: play` and `Admin (Manage Server)`.

**Out of scope:** prefix/setdj/settc/setvc, `register-commands.ts`
**Escape hatches:** If body helpers are inlined, wrap that same string.
