# Task 3: Add the public resolve router

**Depends on:** 1
**Spec:** `.ai/specs/2026-08-22-slice-3-source-breadth.md` § Seam, § Host dispatch, § YouTube module
**Branch:** `cursor/slice-3-source-breadth-spec-8fe8`
**Lessons:** R1/R2. No plugin registry. No second public `resolveSoundCloudTrack`. No `/check-and-commit`. Do not edit `.ai/plans/`.

**Files:**
- Create: `packages/audio-engine/src/resolve.ts`
- Create: `packages/audio-engine/src/resolve.test.ts`
- Modify: `packages/audio-engine/src/sources/youtube.ts` — remove public `resolveTrack` / `openTrackAudio`; keep `*WithClient` and `parseYoutubeQuery`
- Modify: `packages/audio-engine/src/index.ts` — re-export the public pair from `resolve.ts`
- Copy from (first example): N/A — `index.ts` stays re-exports only

**Steps:**
1. Implement `pickSource` and public `resolveTrack` / `openTrackAudio` as spec § Host dispatch. Input `{ query, source?: "soundcloud" }`. `openTrackAudio` stays `{ track }`.
2. YouTube path uses existing `*WithClient` + default client. SoundCloud path uses Task 1 `*WithClient` + default client.
3. Delete youtube public wrappers. Export a client getter from `youtube.ts` if `resolve.ts` needs it. Do not duplicate InnerTube setup.
4. `index.ts` exports the public pair from `./resolve.ts` only.
5. Tests (no network): host dispatch cases in spec § Acceptance criteria. Export `resolveTrackWithClients` for fakes. `youtube.test.ts` must still pass.

**Verify:**
```bash
bun test packages/audio-engine/src/resolve.test.ts packages/audio-engine/src/sources/youtube.test.ts packages/audio-engine/src/sources/soundcloud.test.ts
bun run --cwd packages/audio-engine typecheck
```
Expected: tests exit 0 with 0 fail. Typecheck exits 0. `index.ts` does not import `resolveTrack` from `youtube.ts`.

**Out of scope:**
- `packages/bot/**`, structure check, Spotify error path, plugin registry

**Escape hatches:**
- If Task 1 did not export `*WithClient` names, STOP — do not reimplement SoundCloud inside `resolve.ts`.
- If removing youtube public wrappers breaks an in-repo import other than `index.ts`, STOP and report.
