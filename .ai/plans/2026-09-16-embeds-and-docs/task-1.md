# Task 1: Add embed helper and widen command replies

**Depends on:** none
**Spec:** N/A — plan Design rules § Reply seam and § One helper
**Branch:** `cursor/embeds-and-docs`
**Lessons:** R1 helper stays in `packages/bot`. No new package. No `/check-and-commit`. Do not edit `.ai/plans/`.

**Files:**
- Create: `packages/bot/src/reply-embed.ts`
- Create: `packages/bot/src/reply-embed.test.ts`
- Modify: `packages/bot/src/command-context.ts` — `CommandReplyOptions`; `reply(text, options?)`
- Modify: `packages/bot/src/main.ts` — pass embeds; deny `error`; announce `ok`
- Modify: `packages/bot/src/doors.test.ts` — FakeContext uses `recordedReplyText`
- Modify: `AGENTS.md` — one First examples row for `reply-embed.ts`
- Copy from: `packages/bot/src/format-duration.ts`; send path `packages/bot/src/main.ts`

**Steps:**
1. `CommandReplyOptions`: `readonly embeds?: readonly APIEmbed[]`. `reply(text: string, options?: CommandReplyOptions)`.
2. Export `EMBED_COLOR` (`ok` `0x2ecc71`, `info` `0x5865f2`, `warn` `0xf1c40f`, `error` `0xe74c3c`), `NoticeEmbedInput`, `buildNoticeEmbed`, `replyEmbed`, `youtubeThumbnailUrl`, `formatProgressBar` (width 12, `▰`/`▱`, `""` if duration ≤ 0), `recordedReplyText`. Use `EmbedBuilder`. No `any`.
3. Slash/prefix/`sendPublic`: send `content` only when `text !== ""`; pass embeds; keep mention suppress.
4. Deny: `ctx.reply("", replyEmbed({ color: EMBED_COLOR.error, description: denyReply }))`. Announce: same with `ok` and the announce string. Do not edit `guild-music-session.ts`.
5. Doors FakeContext records `recordedReplyText`. Keep assertion strings.
6. Tests: colors; YouTube thumb yes/no; half of 100 s → 6 `▰` + 6 `▱`.
7. AGENTS First examples: one new row only.

**Verify:**
```bash
bun test packages/bot/src/reply-embed.test.ts packages/bot/src/doors.test.ts
bun run --cwd packages/bot typecheck
```
Expected: exit 0, 0 fail. Doors strings still pass.

**Out of scope:** command modules, `play-from-query.ts`, session, README, PERF
**Escape hatches:** If `implements CommandContext` fails on `reply(text: string)` stubs, STOP. If `sendPublic` is renamed, extend the send helper that exists.
