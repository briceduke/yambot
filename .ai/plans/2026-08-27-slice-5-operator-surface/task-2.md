# Task 2: Parse mention-as-prefix

**Depends on:** none
**Spec:** `.ai/specs/2026-08-27-slice-5-operator-surface.md` § Prefix parse
**Branch:** `cursor/slice-5-operator-surface-8944`
**Lessons:** Copy existing `parsePrefixMessage`. No `/check-and-commit`. Do not edit `.ai/plans/`.

**Files:**
- Modify: `packages/bot/src/prefix.ts`
- Modify: `packages/bot/src/prefix.test.ts`

**Steps:**
1. Add optional `botUserId` to `PrefixParseInput`.
2. If content starts with the string `prefix`, keep current behavior.
3. Else if `botUserId` is set and content starts with `<@botUserId>` or `<@!botUserId>`, strip that mention and following whitespace, then split name/args. Empty remainder → null.
4. Tests: both mention forms; args; empty; string prefix still works; no botUserId → `<@x>play` is not a command.

**Verify:**
```bash
bun test packages/bot/src/prefix.test.ts
```
Expected: exit 0, 0 fail.

**Out of scope:** main.ts wiring, guild overlay prefix
**Escape hatches:** If `parsePrefixMessage` is missing, STOP.
