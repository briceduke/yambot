# Task 9: Rewrite README for operators

**Depends on:** none
**Spec:** N/A — plan Design rules § Docs
**Branch:** `cursor/embeds-and-docs`
**Lessons:** Plain English. Product voice: no Java to run the bot. Do not edit `.ai/plans/`.

**Files:**
- Modify: `README.md` only
- Copy from: N/A — keep Need / Discord app / Run / Commands / Env / Missing token from today’s README

**Steps:**
1. First sentence: yambot means “yet another music bot”.
2. Discord music bot you run yourself. Does not use Java: no JVM, no Lavalink, no lavaplayer to run. `bun run bench:vs-lavalink` may use a JDK; not required to run the bot.
3. Keep Need, Discord app, Run, Commands, Env, Missing token, current names, env keys, invite URL.
4. Remove the winner-number table and “this pass” / injected-hot-path paragraph. One short paragraph plus a pointer to `PERF.md`.
5. No branch, slice, task, PR, or “this pass”. No metaphor.

**Verify:**
```bash
bun run checks:structure
```
Expected: exit 0. README contains “yet another music bot”; says Java is not needed to run; no `cursor/`, `slice-`, `Task `, `PR #`, or `this pass`.

**Out of scope:** PERF.md, AGENTS.md, `.ai/`, bot TypeScript
**Escape hatches:** If a command or env key in today’s README is missing from the tree, drop that name.
