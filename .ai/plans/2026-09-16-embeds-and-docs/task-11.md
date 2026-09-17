# Task 11: Strip task language from remaining non-`.ai/` docs

**Depends on:** none
**Spec:** N/A — plan Design rules § Docs
**Branch:** `cursor/embeds-and-docs`
**Lessons:** Docs describe the tree as it exists. Do not edit `.ai/plans/`.

**Files:**
- Modify: `packages/checks/README.md` — scanners as they exist; remove stamp language
- Modify: `scripts/bench-lavalink/README.md` — only if it names a branch, slice, task, or PR
- Modify: `BACKWARD_COMPATIBILITY.md` — “when self-host packaging ships”; keep empty freeze tables
- Copy from: N/A

**Steps:**
1. Checks README: `structure` and `engine-seam` as they run today. Root commands `bun run checks` / `bun run checks:structure`. Remove “greenfield stamp” and “after stamp”.
2. Read the Lavalink README. Leave it if it has no branch/slice/task/PR words.
3. One sentence in `BACKWARD_COMPATIBILITY.md`. Do not freeze a surface.
4. Do not edit `AGENTS.md` (Task 1 owns the First examples row).

**Verify:**
```bash
bun run checks:structure
```
Expected: exit 0. No `slice 6` / `slice-` / `Task ` / `PR #` / factory “stamp”. Nothing frozen.

**Out of scope:** README.md, PERF.md, AGENTS.md, `.ai/`, `structure.ts`
**Escape hatches:** If a frozen surface already exists, STOP.
