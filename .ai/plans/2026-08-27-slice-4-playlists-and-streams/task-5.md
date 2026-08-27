# Task 5: Grow the structure check and README

**Depends on:** 2, 3
**Spec:** `.ai/specs/2026-08-27-slice-4-playlists-and-streams.md` § Package layout, § README
**Branch:** `cursor/slice-4-playlists-and-streams-957a`
**Lessons:** No grandfathering baseline. No `/check-and-commit`. Do not edit `.ai/plans/`.

**Files:**
- Modify: `packages/checks/configs/structure.ts` — require `http.ts`
- Modify: `README.md`
- Copy from: N/A

**Steps:**
1. `engine-source-module` requiredFiles: `youtube.ts`, `soundcloud.ts`, `http.ts`. Do not drop names.
2. README: `/play` accepts YouTube playlist URLs, SoundCloud set URLs, and HTTP stream URLs. ffmpeg is needed for SoundCloud or HTTP streams. Bot starts without ffmpeg. YouTube video play does not need ffmpeg.

**Verify:**
```bash
bun run checks:structure
```
Expected: `[structure] ok` exit 0. README contains `playlist` and `stream`.

**Out of scope:** new scanners, command behavior, First examples table
**Escape hatches:** If `engine-source-module` is missing, STOP. If `http.ts` is missing, STOP — do not drop the required name.
