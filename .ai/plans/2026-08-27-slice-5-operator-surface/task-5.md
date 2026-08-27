# Task 5: Wire door gates, aliases, voice-state, and slash registration

**Depends on:** Tasks 1, 2, 3, 4
**Spec:** `.ai/specs/2026-08-27-slice-5-operator-surface.md` § Door gates
**Branch:** `cursor/slice-5-operator-surface-8944`
**Lessons:** CommandContext stays unchanged; gates in the door. R1 engine Discord-free. No `/check-and-commit`. Do not edit `.ai/plans/`.

**Files:**
- Modify: `packages/bot/src/main.ts`
- Modify: `packages/bot/src/register-commands.ts`
- Modify: `packages/bot/src/doors.test.ts`

**Steps:**
1. Register six new slash bodies. Aliases `setprefix`→`prefix`, `status`→`settings`.
2. Prefix door: guild view prefix + `botUserId`. Gate order: admin, DJ, settc, setvc, then dispatch.
3. `invokerIsAdmin` = ManageGuild. `createSession` gets LeavePolicy from env. VoiceStateUpdate counts non-bot members in the session voice channel → `noteHumanListenerCount`.
4. Door tests for deny/allow, aliases, mention through `readPrefixDoorCommand`.

**Verify:**
```bash
bun test packages/bot/src/doors.test.ts packages/bot/src/commands packages/bot/src/guild-music-session.test.ts packages/bot/src/operator-config.test.ts packages/bot/src/prefix.test.ts
```
Expected: exit 0, 0 fail.

**Out of scope:** engine files, README
**Escape hatches:** If Task 4 exports are missing, STOP. Do not add CommandContext fields.
