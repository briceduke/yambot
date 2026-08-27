# Task 4: Add help, settings, setdj, prefix, settc, setvc commands

**Depends on:** Task 1
**Spec:** `.ai/specs/2026-08-27-slice-5-operator-surface.md` § Commands
**Branch:** `cursor/slice-5-operator-surface-8944`
**Lessons:** Copy `packages/bot/src/commands/play.ts`. One file per command. No Interaction/Message except SlashCommandBuilder. No `/check-and-commit`. Do not edit `.ai/plans/`. Do not overwrite `src/prefix.ts`.

**Files:**
- Create: `packages/bot/src/commands/help.ts` + `help.test.ts`
- Create: `packages/bot/src/commands/settings.ts` + `settings.test.ts`
- Create: `packages/bot/src/commands/setdj.ts` + `setdj.test.ts`
- Create: `packages/bot/src/commands/prefix.ts` + `prefix.test.ts`
- Create: `packages/bot/src/commands/settc.ts` + `settc.test.ts`
- Create: `packages/bot/src/commands/setvc.ts` + `setvc.test.ts`

**Steps:**
1. Export `*SlashData` and `execute*` per spec replies. Mutate overlay through operator-config.
2. Parse `none`, `<@&id>`, `<#id>`, raw snowflake. Prefix length 1–8.
3. Tests with FakeContext; no Discord login.

**Verify:**
```bash
bun test packages/bot/src/commands/help.test.ts packages/bot/src/commands/settings.test.ts packages/bot/src/commands/setdj.test.ts packages/bot/src/commands/prefix.test.ts packages/bot/src/commands/settc.test.ts packages/bot/src/commands/setvc.test.ts
```
Expected: exit 0, 0 fail.

**Out of scope:** main.ts, register-commands.ts, door gates
**Escape hatches:** If `operator-config.ts` is missing, STOP. If a command imports Interaction or Message, STOP.
