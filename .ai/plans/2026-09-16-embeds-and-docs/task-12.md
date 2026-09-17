# Task 12: Scoped proof

**Depends on:** 1–11
**Spec:** N/A — plan Human smoke; `AGENTS.md` Validation
**Branch:** `cursor/embeds-and-docs`
**Lessons:** Proof trichotomy. Discord embeds are human smoke. Parent `/check-and-commit`. Do not edit `.ai/plans/` Progress.

**Files:**
- Modify: none unless a Verify command is red (fix only the failing file)
- Copy from: N/A

**Steps:**
1. Run the verify block.
2. Confirm `packages/bot/package.json` gained no new production dependency and still depends on `discord.js` and `@yambot/audio-engine`.
3. Confirm `packages/audio-engine/package.json` still has no `discord.js`.
4. Paste the plan’s Human smoke list into the finish report. Do not invent a second script.
5. Do not run `bench:perf`, `bench:load`, or `bench:vs-lavalink`.

**Verify:**
```bash
bun run typecheck
bun test packages/bot
bun run checks
```
Expected: all exit 0, 0 fail. `engine-seam` pass. Structure pass.

**Out of scope:** merging; marking embeds proved from CI
**Escape hatches:** If tests are red, fix only the regression. If live Discord is unavailable, leave smoke as can’t tell yet.
