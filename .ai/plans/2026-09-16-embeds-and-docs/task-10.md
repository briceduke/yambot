# Task 10: Strip task language from PERF.md

**Depends on:** none
**Spec:** N/A — plan Design rules § Docs
**Branch:** `cursor/embeds-and-docs`
**Lessons:** Do not invent numbers. Do not edit `.ai/plans/`.

**Files:**
- Modify: `PERF.md` only
- Copy from: N/A — keep tables and command blocks already in `PERF.md`

**Steps:**
1. Keep tables, commands, method notes, scale, injected-delay, LavaPlayer map, Remaining, Human smoke.
2. Remove “Call for Brice”, “this pass”, “After the Raptor 3 cut”, “post-#10”, “Cut after #10”, PR and slice numbers.
3. You may keep “Measured 2026-09-13 on a Cloud Agent VM”.
4. Do not invent numbers. Do not re-run benches unless a cell is blank.

**Verify:**
```bash
bun run checks:structure
```
Expected: exit 0. `http_mpeg_ttfa_ms` p50 `0.425` and Lavalink N=100 `fail_rate` **0.81** still present. No `PR #`, `slice-`, `Task `, `#10`, `this pass`, or `Call for Brice`.

**Out of scope:** README.md, bench TypeScript, re-running `bench:vs-lavalink`
**Escape hatches:** If a table does not match these numbers, keep the numbers on disk.
