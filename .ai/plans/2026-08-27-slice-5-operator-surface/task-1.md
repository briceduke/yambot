# Task 1: Add operator-config env, overlay, and DJ check

**Depends on:** none
**Spec:** `.ai/specs/2026-08-27-slice-5-operator-surface.md` § Operator config
**Branch:** `cursor/slice-5-operator-surface-8944`
**Lessons:** R1 no Discord in engine. This module is bot-side and must not import `discord.js`. No settings file. No `/check-and-commit`. Do not edit `.ai/plans/`.

**Files:**
- Create: `packages/bot/src/operator-config.ts`
- Create: `packages/bot/src/operator-config.test.ts`

**Steps:**
1. Implement `readOperatorEnv`, in-memory overlay Map, `getGuildOperatorView`, `canUseDjCommands` from the spec. No Discord types.
2. Env keys: `COMMAND_PREFIX` default `!`; `DJ_ROLE_ID` null; `STAY_IN_CHANNEL` true/1/yes; `ALONE_TIME_UNTIL_STOP` ≤0 → 0; `IDLE_LEAVE_SECONDS` default 300, negative → 300, `0` allowed.
3. Overlay `djRoleId: null` overrides env role. Missing overlay field falls through to env.
4. Tests cover defaults, each key, merge, canUseDj open/match/admin/deny.

**Verify:**
```bash
bun test packages/bot/src/operator-config.test.ts
```
Expected: exit 0, 0 fail.

**Out of scope:** main.ts, commands, session, prefix parser
**Escape hatches:** If this file would import `discord.js`, STOP.
