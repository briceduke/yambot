# Task 7: Wire aliases, slash registration, and README names

**Depends on:** 3, 4, 5
**Spec:** `.ai/specs/2026-08-17-slice-2-core-music-controls.md` § Client / platform contract (registration, ACK), § Prefix aliases, § Package layout
**Branch:** `slice-2-core-music-controls`
**Lessons:** R1 engine Discord-free; R2 bot → engine; R3 no Java; R4 UX only. No extra alias command files. No `/check-and-commit`. Do not edit `.ai/plans/`.

**Files:**
- Modify: `packages/bot/src/main.ts` — prefix aliases; slash args for `remove`; dispatch new names
- Modify: `packages/bot/src/register-commands.ts` — bulk PUT includes the seven new slash JSON bodies
- Modify: `packages/bot/src/doors.test.ts` — aliases, remove args, registration names
- Modify: `README.md` — add the new command names and prefix aliases
- Copy from (first example): N/A — wiring. Commands already exist at `packages/bot/src/commands/play.ts`

**Steps:**
1. Prefix-only alias map in the existing dispatch table (same file `doors.test.ts` already imports): `np` → `nowplaying`, `leave` → `stop`. Slash door uses `commandName` as-is (no `/np`, no `/leave`).
2. Slash args: `play` still reads option `query`. `remove` reads integer option `position` and sets `ctx.args` to `String(n)` or `""` when missing. Other new commands: `args` is `""`.
3. Dispatch `pause` / `resume` / `nowplaying` / `remove` / `shuffle` / `clear` / `stop` to the Task 3–5 `execute*` functions. Same session rule as skip/queue: `getSession` only; do not `createSession` or rebind announce. Defer slash at receipt; prefix sends a channel message; `allowedMentions: { parse: [] }` on every reply.
4. `registerGuildCommands` bulk-PUTs play, skip, queue, plus the seven new names. `remove` includes required integer `position`. Array must not contain `np` or `leave`.
5. `doors.test.ts`: `!np` and `!leave` call the nowplaying and stop modules; slash names `np` / `leave` are unknown; `remove` with args `"1"` hits `executeRemove`; exported registration names are exactly those 10.
6. README: list `/pause` `/resume` `/nowplaying` `/remove` `/shuffle` `/clear` `/stop` and prefix `!np` / `!leave`. Do not claim `/np` or `/leave` exist. One sentence: after the last track the bot stays 5 minutes, then leaves; `/stop` leaves now.

**Verify:**
```bash
bun test packages/bot/src/doors.test.ts
bun run --cwd packages/bot typecheck
```
Expected: tests exit 0 with 0 fail. Typecheck exits 0. `README.md` contains `nowplaying`, `!np`, and `5 minutes`, and does not document a slash `/np`.

**Out of scope:**
- Global (non-guild) registration, ephemeral replies, Message Content portal prose beyond the existing README

**Escape hatches:**
- If `dispatchCommand` / `registerGuildCommands` names differ from slice 1, extend the names that exist — do not add a second dispatch module. If `main.ts` or `README.md` is missing, STOP.
