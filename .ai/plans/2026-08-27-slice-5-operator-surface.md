# Slice 5 operator surface — implementation plan

**Spec:** `.ai/specs/2026-08-27-slice-5-operator-surface.md`
**Research:** `.ai/research/jmusicbot-operator-surface.md`
**Raptor:** `.ai/runs/2026-08-27-raptor-slice-5-operator-surface.md`
**Branch:** `cursor/slice-5-operator-surface-8944`
**Status:** approved
**Ordering:** shared foundation — operator-config, prefix mention parse, and LeavePolicy can land in parallel. Commands need operator-config. Doors need commands + config + session hooks. Docs can land with doors.
**Lessons:** `engine-seam`, `product`, `process`, `bot-discord`

Worker digest (do not read `.ai/lessons.md`):
- R1: `packages/audio-engine` never imports Discord. R2: bot → engine only. R3: no Java/JVM/Lavalink/lavaplayer. R4: UX parity, do not copy JMusicBot internals or settings file.
- Copy `packages/bot/src/commands/play.ts` for new command files. Mint First examples row for `packages/bot/src/operator-config.ts` in Task 6.
- No new production dependency. No new workspace package. No database. No settings file.
- Idle leave and alone-timer are two clocks. Unset DJ role stays open.
- Proof trichotomy: live Discord permission/voice is unverifiable. Workers never edit `.ai/plans/`. Commit only through parent `/check-and-commit`.

## Progress

- [x] Task 1: Add operator-config env, overlay, and DJ check
- [x] Task 2: Parse mention-as-prefix
- [x] Task 3: Add LeavePolicy and alone-timer on the session
- [x] Task 4: Add help, settings, setdj, prefix, settc, setvc commands
- [x] Task 5: Wire door gates, aliases, voice-state, and slash registration
- [x] Task 6: Grow structure check, README, env example, First examples
- [x] Task 7: Final scoped proof

## Parallel groups

### Group A
**Depends on:** none
**Tasks:** 1, 2, 3
**Files disjoint:** yes
**Workers:** fan out one subagent per task (cards: `task-1.md`, `task-2.md`, `task-3.md`)

### Group B
**Depends on:** Group A (Task 1)
**Tasks:** 4
**Files disjoint:** n/a (single task)
**Workers:** one subagent (`task-4.md`)

### Group C
**Depends on:** Group B
**Tasks:** 5, 6
**Files disjoint:** yes
**Workers:** fan out one subagent per task (cards: `task-5.md`, `task-6.md`)

### Group D
**Depends on:** Tasks 1–6
**Tasks:** 7
**Files disjoint:** n/a (single task)
**Workers:** parent agent

## Dependencies

Tasks 1–3 touch three file sets: `operator-config.ts`, `prefix.ts`, `guild-music-session.ts`. Task 4 imports operator-config and adds command files only. Task 5 owns `main.ts` / `register-commands.ts` / `doors.test.ts`. Task 6 owns structure, README, `.env.example`, AGENTS.md. Task 7 is proof.

## Global out of scope

- Vote skip, volume, seek, lyrics, repeat, playnext, move, skipto, owner commands
- Settings file, database, new packages, new production dependencies
- Engine source changes, live channel topic, DMs, deleting user messages
- Java, JVM, Lavalink, lavaplayer, dashboard, SaaS

## Global escape hatches

- If `packages/bot/src/commands/play.ts` or `prefix.ts` or `guild-music-session.ts` is missing, STOP.
- If a task would add a Discord import inside `packages/audio-engine`, a settings JSON file, a database, or a workspace package, STOP.
- If `bun add` would pull a Java/JVM package, STOP.
- If two in-flight tasks would edit the same file, STOP.
- If CommandContext would gain fields with no reader in this slice, STOP — keep gates in the door.

## Proof (automated vs unverifiable)

Automated (Task 7 plus per-task Verify): `bun run checks`, `bun run typecheck`, `bun test packages/audio-engine`, `bun test packages/bot`.

Unverifiable in CI (human smoke in the spec § Proof plan, steps 0–11): live DJ deny, mention prefix, settc/setvc, alone-timer, stay-in-channel, overlay-on-restart. Cloud Agent has no Discord guild. Ship stays a draft PR until that script passes.

---

## Task 1: Add operator-config env, overlay, and DJ check

**Depends on:** none
**Spec:** `.ai/specs/2026-08-27-slice-5-operator-surface.md` § Operator config
**Files:**
- Create: `packages/bot/src/operator-config.ts`
- Create: `packages/bot/src/operator-config.test.ts`
- Copy from (first example): N/A — this file **is** the first example (minted in Task 6)

**Steps:**
1. Implement `readOperatorEnv`, overlay get/set/clear, `getGuildOperatorView`, `canUseDjCommands` exactly as the spec signatures. No Discord imports.
2. `setdj none` stores overlay `djRoleId: null` (overrides env). Clearing prefix overlay restores env prefix.
3. Tests: defaults; each env key; true/false stay; alone ≤0 → 0; idle missing → 300; negative idle → 300; overlay merge; canUseDj unset/open, role match, admin, deny.

**Verify:**
```bash
bun test packages/bot/src/operator-config.test.ts
```
Expected: exit 0, 0 fail.

**Out of scope:**
- `main.ts`, command files, session leave, prefix parser

**Escape hatches:**
- If this module would import `discord.js`, STOP.

---

## Task 2: Parse mention-as-prefix

**Depends on:** none
**Spec:** `.ai/specs/2026-08-27-slice-5-operator-surface.md` § Prefix parse
**Files:**
- Modify: `packages/bot/src/prefix.ts` — optional `botUserId`; mention strip
- Modify: `packages/bot/src/prefix.test.ts`
- Copy from: N/A (parser already exists)

**Steps:**
1. Add optional `botUserId` to `PrefixParseInput`. After string-prefix miss, if `botUserId` is set and content starts with `<@id>` or `<@!id>`, strip mention + whitespace and `splitNameAndArgs`. Empty remainder → null.
2. String prefix still wins when it matches (both can exist on a message; check string prefix first, then mention).
3. Tests: mention forms; mention + args; empty mention; string prefix unchanged; missing botUserId does not treat `<@x>` as prefix.

**Verify:**
```bash
bun test packages/bot/src/prefix.test.ts
```
Expected: exit 0, 0 fail.

**Out of scope:**
- `main.ts` wiring, guild overlay prefix (Task 5 passes the view prefix in)

**Escape hatches:**
- If `parsePrefixMessage` is missing, STOP.

---

## Task 3: Add LeavePolicy and alone-timer on the session

**Depends on:** none
**Spec:** `.ai/specs/2026-08-27-slice-5-operator-surface.md` § Leave policy on the session
**Files:**
- Modify: `packages/bot/src/guild-music-session.ts`
- Modify: `packages/bot/src/guild-music-session.test.ts`
- Copy from: existing idle-leave schedule in the same file

**Steps:**
1. Add `LeavePolicy` and optional `leavePolicy` + `scheduleAloneLeave` on `CreateSessionInput`. Default policy is slice 2 (300_000 / false / 0).
2. `#armIdleLeave` no-ops when `stayInChannel`. Else uses `idleLeaveMs`.
3. Add `noteHumanListenerCount(count)`. Alone ms 0 → no-op. count > 0 cancels. count 0 and in voice schedules `dropSession`. `leaveNow` and voice-drop cancel both timers.
4. Tests with injected schedules: stay skips idle; custom idle ms fires; alone 0 never arms; alone arms and cancel on count>0; leaveNow cancels alone.

**Verify:**
```bash
bun test packages/bot/src/guild-music-session.test.ts
```
Expected: exit 0, 0 fail. Existing idle-leave tests still pass.

**Out of scope:**
- `main.ts` VoiceStateUpdate (Task 5)
- operator-config imports not required; session takes a plain `LeavePolicy`

**Escape hatches:**
- If idle-leave inject (`scheduleIdleLeave`) is missing, STOP — copy that seam, do not sleep.

---

## Task 4: Add help, settings, setdj, prefix, settc, setvc commands

**Depends on:** Task 1
**Spec:** `.ai/specs/2026-08-27-slice-5-operator-surface.md` § Commands
**Files:**
- Create: `packages/bot/src/commands/help.ts`, `help.test.ts`
- Create: `packages/bot/src/commands/settings.ts`, `settings.test.ts`
- Create: `packages/bot/src/commands/setdj.ts`, `setdj.test.ts`
- Create: `packages/bot/src/commands/prefix.ts`, `prefix.test.ts` (command; parser stays `src/prefix.ts`)
- Create: `packages/bot/src/commands/settc.ts`, `settc.test.ts`
- Create: `packages/bot/src/commands/setvc.ts`, `setvc.test.ts`
- Copy from (first example): `packages/bot/src/commands/play.ts` and `packages/bot/src/commands/remove.ts` (args parse)

**Steps:**
1. One file per command with `*SlashData` and `execute*`. No Interaction/Message types except `SlashCommandBuilder`.
2. Replies and usage strings exactly as the spec. `setdj`/`prefix`/`settc`/`setvc` mutate overlay via operator-config. Parse `<@&id>`, `<#id>`, raw snowflake, `none`.
3. Prefix command file must not overwrite `src/prefix.ts`.
4. Tests with FakeContext; no Discord login. Cover success, usage, prefix length 1–8, none-clears.

**Verify:**
```bash
bun test packages/bot/src/commands/help.test.ts packages/bot/src/commands/settings.test.ts packages/bot/src/commands/setdj.test.ts packages/bot/src/commands/prefix.test.ts packages/bot/src/commands/settc.test.ts packages/bot/src/commands/setvc.test.ts
```
Expected: exit 0, 0 fail.

**Out of scope:**
- `main.ts`, `register-commands.ts`, door gates

**Escape hatches:**
- If `operator-config.ts` is missing, STOP.
- If a command file would import Interaction or Message, STOP.

---

## Task 5: Wire door gates, aliases, voice-state, and slash registration

**Depends on:** Tasks 1, 2, 3, 4
**Spec:** `.ai/specs/2026-08-27-slice-5-operator-surface.md` § Door gates, § Prefix parse, § Leave policy (main wiring)
**Files:**
- Modify: `packages/bot/src/main.ts`
- Modify: `packages/bot/src/register-commands.ts`
- Modify: `packages/bot/src/doors.test.ts`
- Copy from: existing dispatch/prefix door in `main.ts`

**Steps:**
1. Register the six new slash bodies. Aliases: `setprefix` → `prefix`, `status` → `settings`.
2. Prefix door uses `getGuildOperatorView(guildId).prefix` and `client.user.id` as `botUserId`.
3. Implement door gate order from the spec. `invokerIsAdmin` = `ManageGuild`. Pass `LeavePolicy` from env into `createSession`. `VoiceStateUpdate` → `noteHumanListenerCount` (non-bot members in the session voice channel).
4. `readSlashArgs` for the new commands. Dispatch help/settings/setdj/prefix/settc/setvc (session optional).
5. Door tests: admin deny, DJ deny, settc, setvc, aliases, mention parse through `readPrefixDoorCommand`.

**Verify:**
```bash
bun test packages/bot/src/doors.test.ts packages/bot/src/commands packages/bot/src/guild-music-session.test.ts packages/bot/src/operator-config.test.ts packages/bot/src/prefix.test.ts
```
Expected: exit 0, 0 fail.

**Out of scope:**
- Engine files, README (Task 6)

**Escape hatches:**
- If Task 4 command exports are missing, STOP.
- If adding a gate requires CommandContext fields, STOP and keep the gate in the door.

---

## Task 6: Grow structure check, README, env example, First examples

**Depends on:** Task 4 (command files on disk)
**Spec:** `.ai/specs/2026-08-27-slice-5-operator-surface.md` § Package layout
**Files:**
- Modify: `packages/checks/configs/structure.ts`
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `AGENTS.md` — First examples row
- Copy from: N/A

**Steps:**
1. `bot-src` requiredFiles add `operator-config.ts`. `bot-command-module` add `help.ts`, `settings.ts`, `setdj.ts`, `prefix.ts`, `settc.ts`, `setvc.ts`. Do not drop names.
2. README: new commands, mention-as-prefix, env knobs, overlay dies on restart, DJ unset stays open.
3. `.env.example`: `COMMAND_PREFIX`, `DJ_ROLE_ID`, `STAY_IN_CHANNEL`, `ALONE_TIME_UNTIL_STOP`, `IDLE_LEAVE_SECONDS`.
4. AGENTS.md First examples: Guild operator config → `packages/bot/src/operator-config.ts`.

**Verify:**
```bash
bun run checks:structure
```
Expected: `[structure] ok` exit 0.

**Out of scope:**
- Command behavior, new scanners, constitution hard-rule edits

**Escape hatches:**
- If a required command file is missing, STOP — do not drop the required name.

---

## Task 7: Final scoped proof

**Depends on:** Tasks 1–6
**Spec:** `.ai/specs/2026-08-27-slice-5-operator-surface.md` § Acceptance criteria, § Proof plan
**Files:**
- None unless a proof failure needs a one-line fix in a file this plan already owns

**Steps:**
1. Run the commands in Verify.
2. Confirm `packages/audio-engine` diff is empty (or only accidental — revert if so).
3. Paste the spec human smoke steps in the execute finish report. Do not mark live Discord proved.

**Verify:**
```bash
bun run checks
bun run typecheck
bun test packages/audio-engine
bun test packages/bot
```
Expected: all exit 0. Structure ok. engine-seam ok. 0 test fail.

**Out of scope:**
- Running the human smoke in a Discord guild (operator)

**Escape hatches:**
- If engine-seam fails because of a Discord import in the engine, STOP and revert.
- If a new production dependency appeared, STOP.
