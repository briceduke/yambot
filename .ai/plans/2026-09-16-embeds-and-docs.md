# Embeds and docs — implementation plan

**Spec:** none — small-change / explicit user description. Design rules live in this plan.
**Research:** N/A
**Branch:** `cursor/embeds-and-docs` (create from `main`; do not reuse `cursor/slice-5-operator-surface-8944`)
**Status:** approved
**Ordering:** shared foundation required — `CommandContext` reply options and one embed helper block every command embed task. Docs tasks do not wait on that helper.
**Lessons:** process (proof trichotomy; first examples; parent `/check-and-commit`; workers read Task N only), product (R3 no Java in product voice; R4 UX not internals), engine-seam (R1 helper stays in `packages/bot`). Digest: no Discord in the engine; no new production dependency; copy the helper after Task 1; Discord-visible embeds are human smoke; do not edit `.ai/plans/` Progress.

## Progress

- [x] Task 1: Add embed helper and widen command replies
- [ ] Task 2: Embed play-door replies
- [x] Task 3: Embed nowplaying
- [x] Task 4: Embed queue
- [ ] Task 5: Embed skip, pause, and resume
- [ ] Task 6: Embed remove, shuffle, clear, and stop
- [ ] Task 7: Embed help and settings
- [x] Task 8: Embed prefix, setdj, settc, and setvc
- [x] Task 9: Rewrite README for operators
- [x] Task 10: Strip task language from PERF.md
- [x] Task 11: Strip task language from remaining non-`.ai/` docs
- [ ] Task 12: Scoped proof

## Parallel groups

### Group A
**Depends on:** none
**Tasks:** 1, 9, 10, 11
**Files disjoint:** yes
**Workers:** fan out one subagent per task. Cards: `.ai/plans/2026-09-16-embeds-and-docs/task-{N}.md`

### Group B
**Depends on:** Group A Task 1 only (Tasks 9–11 may still be in flight)
**Tasks:** 2, 3, 4, 5, 6, 7, 8
**Files disjoint:** yes
**Workers:** fan out one subagent per task. Cards: `.ai/plans/2026-09-16-embeds-and-docs/task-{N}.md`

### Group C
**Depends on:** Group A and Group B
**Tasks:** 12
**Files disjoint:** n/a (single task)
**Workers:** parent agent

## Dependencies

Task 1 is the only shared blocker for command embed work. Docs tasks (9–11) share no files with Task 1 or with each other. Tasks 2–8 start after Task 1 is committed. Task 12 runs last.

## Design rules (no spec)

There is no spec file. These rules are the settled design. Do not reopen them.

### Reply seam

- `CommandContext.reply(text: string, options?: CommandReplyOptions): Promise<void>`
- `CommandReplyOptions` has `readonly embeds?: readonly APIEmbed[]` (`APIEmbed` from `discord.js`)
- Embed-only replies use `text === ""` and exactly one embed
- Slash `editReply` and prefix `sendPublic` in `packages/bot/src/main.ts` pass `embeds` through
- Mentions stay suppressed (`parse: []`)
- Existing `reply(text)` callers stay valid

### One helper

- Path: `packages/bot/src/reply-embed.ts`
- Use `EmbedBuilder` from `discord.js`. Do not add a package
- Named exports. Interfaces over `type`. No `any`
- `EMBED_COLOR`: `ok` `0x2ecc71`, `info` `0x5865f2`, `warn` `0xf1c40f`, `error` `0xe74c3c`
- `buildNoticeEmbed(input: NoticeEmbedInput): APIEmbed` and `replyEmbed(input: NoticeEmbedInput): CommandReplyOptions`
- `NoticeEmbedInput`: `readonly description: string`, `readonly color: number`, optional `title`, `url`, `thumbnailUrl`
- `youtubeThumbnailUrl(uri: string): string | null` — YouTube watch, `youtu.be`, or `/shorts/` 11-char id → `https://i.ytimg.com/vi/{id}/hqdefault.jpg`; else `null`
- `formatProgressBar(elapsedSeconds: number, durationSeconds: number): string` — width 12, `▰` filled, `▱` empty; `""` when `durationSeconds <= 0`
- `recordedReplyText(text: string, options?: CommandReplyOptions): string` — `options?.embeds?.[0]?.description ?? text` (test helper)
- Do not add `Track` artwork. Do not import this file from `packages/audio-engine`

### Command embed shape

- Description equals the previous plain-text reply, except `/nowplaying` (Task 3)
- Color: `error` for usage, deny, resolve fail, join fail, empty, nothing playing, already paused, nothing paused, no track; `ok` for success play / queue / skip / pause / resume / remove / shuffle / clear / stop / operator set; `info` for nowplaying (playing), queue, help, settings; `warn` for nowplaying paused
- Title: omit on one-line notices; set on nowplaying (`Now playing` / `Paused`), queue (`Queue`), help (`Help`), settings (`Settings`), play success (`Playing` / `Queued` / `Added`)
- When the reply is about one known track, `setURL(track.uri)`
- Thumbnail only from `youtubeThumbnailUrl`
- One embed. No buttons. No live-edit nowplaying. No requester field
- Do not change the words of existing reply strings except the nowplaying URL/`<>` line and the added bar

### Docs (non-`.ai/`)

- Speak about the tree as it exists. No branch name, slice number, task number, PR number, or “this pass”
- README: yambot means “yet another music bot”; the bot does not use Java
- Do not edit `.ai/` product, architecture, specs, or other plans

## Global out of scope

- `packages/audio-engine` source, resolve, or `Track` fields
- New production dependencies
- New workspace package
- Database or any persistence store
- Buttons, select menus, live-edit nowplaying
- Playback / remux / skip timing
- `.ai/product.md`, `.ai/architecture.md`, `.ai/specs/*`, other `.ai/plans/*`
- `AGENTS.md` process text except the First examples row in Task 1
- `.env.example`

## Global escape hatches

- If `discord.js` in this repo has no `EmbedBuilder`, STOP and report — do not add an embed library
- If `CommandContext.reply` already accepts embeds, extend that shape — do not add a second reply method
- If a task’s first-example path is missing, STOP and report
- If `packages/bot/package.json` would gain a new production dependency, STOP — Ask First

## Human smoke (unverifiable in CI)

Ship stays a draft PR until a human runs this in the test guild:

1. `/play` a YouTube URL — reply is one embed (`ok` color, description still starts with `Playing:`)
2. `/nowplaying` — embed with elapsed / duration and a 12-char bar
3. `/queue` — embed titled `Queue`
4. `/help` and `/settings` — embeds; words match today’s lists
5. Prefix `!play` sends the same embed shape as slash
6. Bare `/play` — `error` embed; usage words unchanged
7. Let a second queued track start — the announce line is an embed

Do not mark Discord-visible embeds proved from `bun test`.

---

## Task 1: Add embed helper and widen command replies

**Depends on:** none
**Spec:** N/A — this plan, Design rules § Reply seam and § One helper
**Files:**
- Create: `packages/bot/src/reply-embed.ts`
- Create: `packages/bot/src/reply-embed.test.ts`
- Modify: `packages/bot/src/command-context.ts` — add `CommandReplyOptions`; optional second arg on `reply`
- Modify: `packages/bot/src/main.ts` — slash and prefix reply pass embeds; `sendPublic` accepts options; door deny and announce wrap with `error` / `ok` embeds
- Modify: `packages/bot/src/doors.test.ts` — FakeContext `reply` records `recordedReplyText` only
- Modify: `AGENTS.md` — add First examples row: Bot reply embed → `packages/bot/src/reply-embed.ts`
- Copy from (first example): `packages/bot/src/format-duration.ts` (pure named helpers + test file next to them). UI send path copies `packages/bot/src/main.ts` `editReply` / `sendPublic`

**Steps:**
1. Add `CommandReplyOptions` and `reply(text: string, options?: CommandReplyOptions): Promise<void>` on `CommandContext`. Keep the JSDoc that slash edits and prefix sends, mentions suppressed.
2. Export `EMBED_COLOR`, `NoticeEmbedInput`, `buildNoticeEmbed`, `replyEmbed`, `youtubeThumbnailUrl`, `formatProgressBar`, `recordedReplyText` from `reply-embed.ts` per Design rules. Use `EmbedBuilder`. Annotate every param and return.
3. In `createSlashContext`, `createPrefixContext`, and `sendPublic`, pass `content` only when `text !== ""`, and pass `embeds` from options. Keep `allowedMentions: suppressedMentions`.
4. Door deny: `await ctx.reply("", replyEmbed({ color: EMBED_COLOR.error, description: denyReply }))`.
5. `bindAnnounceFromChannel`: send `""` plus `replyEmbed({ color: EMBED_COLOR.ok, description: text })` through `sendPublic`. Do not edit `guild-music-session.ts`.
6. `doors.test.ts` FakeContext: `this.replies.push(recordedReplyText(text, options))`. Do not change assertion strings.
7. Tests: color numbers; YouTube thumbnail yes/no; bar of 12 for half of 100 s is 6 `▰` + 6 `▱`; `durationSeconds <= 0` is `""`; `recordedReplyText` prefers description.
8. `AGENTS.md` First examples: one new row only. Do not rewrite other AGENTS sections.

**Verify:**
```bash
bun test packages/bot/src/reply-embed.test.ts packages/bot/src/doors.test.ts
bun run --cwd packages/bot typecheck
```
Expected: tests exit 0, 0 fail. `tsc --noEmit` exit 0. Existing doors assertion strings still pass.

**Out of scope:**
- Command modules under `packages/bot/src/commands/`
- `packages/bot/src/play-from-query.ts`
- `packages/bot/src/guild-music-session.ts`
- README.md, PERF.md

**Escape hatches:**
- If `implements CommandContext` fails on existing `reply(text: string)` stubs, STOP and report — do not edit every test file in this task.
- If `sendPublic` is missing or renamed, extend the send helper that exists — do not add a second channel sender.

---

## Task 2: Embed play-door replies

**Depends on:** 1
**Spec:** N/A — this plan, Design rules § Command embed shape
**Files:**
- Modify: `packages/bot/src/play-from-query.ts` — wrap every `ctx.reply` with `replyEmbed`
- Modify: `packages/bot/src/commands/play.test.ts` — FakeContext uses `recordedReplyText`; keep assertion strings
- Modify: `packages/bot/src/commands/scsearch.test.ts` — same FakeContext change
- Copy from (first example): `packages/bot/src/reply-embed.ts` and `packages/bot/src/play-from-query.ts`

**Steps:**
1. Import `EMBED_COLOR`, `replyEmbed`, `youtubeThumbnailUrl` from `../reply-embed.ts` (path from `play-from-query.ts`: `./reply-embed.ts`).
2. Error / usage / join-fail / empty / occupied: `await ctx.reply("", replyEmbed({ color: EMBED_COLOR.error, description: <exact previous string> }))`.
3. Success: description is the exact string from `playingOrAddedReply` / `queuedReply` / `addedReply`. Title `Playing` / `Queued` / `Added` per those branches. Color `ok`. For a single known track, set `url` to `track.uri` and `thumbnailUrl` to `youtubeThumbnailUrl(track.uri)`.
4. Do not edit `play.ts` or `scsearch.ts`. Do not change reply words.
5. FakeContext `reply` in both test files: `this.replies.push(recordedReplyText(text, options))`.

**Verify:**
```bash
bun test packages/bot/src/commands/play.test.ts packages/bot/src/commands/scsearch.test.ts packages/bot/src/doors.test.ts
bun run --cwd packages/bot typecheck
```
Expected: exit 0, 0 fail. `play.test.ts` still equals `Playing: Never Gonna Give You Up (3:33)` and the other existing strings. `doors.test.ts` join-voice lines still pass.

**Out of scope:**
- `packages/bot/src/commands/play.ts` and `scsearch.ts`
- `packages/bot/src/main.ts`
- nowplaying / queue / other commands

**Escape hatches:**
- If `replyEmbed` is missing after Task 1, STOP.
- If a play-door reply string is not listed in `play-from-query.ts`, wrap the string that exists — do not invent new copy.

---

## Task 3: Embed nowplaying

**Depends on:** 1
**Spec:** N/A — this plan, Design rules § Command embed shape (nowplaying exception)
**Files:**
- Modify: `packages/bot/src/commands/nowplaying.ts`
- Modify: `packages/bot/src/commands/nowplaying.test.ts`
- Copy from (first example): `packages/bot/src/reply-embed.ts`; command module shape from `packages/bot/src/commands/play.ts`

**Steps:**
1. Nothing playing: `await ctx.reply("", replyEmbed({ color: EMBED_COLOR.error, description: "Nothing is playing." }))`.
2. When a track is current: title `Paused` or `Now playing`; color `warn` if paused else `info`; description two lines: `{status}: {title} ({elapsed} / {duration})` then `formatProgressBar(elapsedSeconds, track.durationSeconds)` (omit the bar line when the bar is `""`); `url` `track.uri`; `thumbnailUrl` `youtubeThumbnailUrl(track.uri)`.
3. Do not put `<url>` in the body. Elapsed still comes from `session.playbackDurationMs()`.
4. Update tests: empty case still `"Nothing is playing."`; playing/paused cases assert description line 1 matches the old first line without the URL line, and line 2 is a 12-char bar when duration is 213 and elapsed is 65 s. FakeContext uses `recordedReplyText`.

**Verify:**
```bash
bun test packages/bot/src/commands/nowplaying.test.ts packages/bot/src/doors.test.ts
bun run --cwd packages/bot typecheck
```
Expected: exit 0, 0 fail. `!np` doors test still equals `Nothing is playing.`

**Out of scope:**
- Live-edit / interval refresh of nowplaying
- `queue.ts`
- Engine `Track` fields

**Escape hatches:**
- If `playbackDurationMs` is missing, STOP.
- If `formatProgressBar` is missing, STOP.

---

## Task 4: Embed queue

**Depends on:** 1
**Spec:** N/A — this plan, Design rules § Command embed shape
**Files:**
- Modify: `packages/bot/src/commands/queue.ts`
- Modify: `packages/bot/src/commands/queue.test.ts`
- Copy from (first example): `packages/bot/src/reply-embed.ts`; keep `formatQueueText` line rules from this file

**Steps:**
1. Keep `formatQueueText` output bytes the same (empty line, leftover header, `Now:` line, numbered rows, cap 10, `…and {k} more.`).
2. Empty: color `error`, no title, description is `Nothing is playing and the queue is empty.`
3. Non-empty: title `Queue`, color `info`, description is `formatQueueText` output.
4. FakeContext uses `recordedReplyText`. Do not change assertion strings.

**Verify:**
```bash
bun test packages/bot/src/commands/queue.test.ts packages/bot/src/doors.test.ts
bun run --cwd packages/bot typecheck
```
Expected: exit 0, 0 fail. Existing `toEqual` strings still match. Doors empty-queue strings still pass.

**Out of scope:**
- Pause marker on queue rows
- Raising the 10-row cap
- `nowplaying.ts`

**Escape hatches:**
- If `formatQueueText` line rules differ from these steps, keep the file’s current format — do not invent a third layout.

---

## Task 5: Embed skip, pause, and resume

**Depends on:** 1
**Spec:** N/A — this plan, Design rules § Command embed shape
**Files:**
- Modify: `packages/bot/src/commands/skip.ts`
- Modify: `packages/bot/src/commands/skip.test.ts`
- Modify: `packages/bot/src/commands/pause.ts`
- Modify: `packages/bot/src/commands/pause.test.ts`
- Modify: `packages/bot/src/commands/resume.ts`
- Modify: `packages/bot/src/commands/resume.test.ts`
- Copy from (first example): `packages/bot/src/reply-embed.ts`; command shape from `packages/bot/src/commands/play.ts`

**Steps:**
1. Each `ctx.reply` becomes `ctx.reply("", replyEmbed({ ... }))`.
2. Description is the exact current string (`Nothing is playing.`, `Already paused.`, `Nothing is paused.`, `Skipped: {title}`, `Paused: {title}`, `Resumed: {title}`).
3. Color `error` on the three failure strings; `ok` on the three success strings. No title.
4. On skip/pause/resume success, set `url` to `session.currentTrack.uri` and `thumbnailUrl` to `youtubeThumbnailUrl(session.currentTrack.uri)`.
5. Call order stays: skip replies then `skipCurrent`; pause checks then `pause` then replies; resume checks then `unpause` then replies.
6. Each FakeContext uses `recordedReplyText`. Keep assertion strings.

**Verify:**
```bash
bun test packages/bot/src/commands/skip.test.ts packages/bot/src/commands/pause.test.ts packages/bot/src/commands/resume.test.ts packages/bot/src/doors.test.ts
bun run --cwd packages/bot typecheck
```
Expected: exit 0, 0 fail. Doors `!leave` is Task 6; this verify only needs skip/pause/resume plus doors still green.

**Out of scope:**
- `stop.ts`
- Session pause implementation
- `play-from-query.ts`

**Escape hatches:**
- If a success reply today has no track title, send description only — do not invent a title field.

---

## Task 6: Embed remove, shuffle, clear, and stop

**Depends on:** 1
**Spec:** N/A — this plan, Design rules § Command embed shape
**Files:**
- Modify: `packages/bot/src/commands/remove.ts`
- Modify: `packages/bot/src/commands/remove.test.ts`
- Modify: `packages/bot/src/commands/shuffle.ts`
- Modify: `packages/bot/src/commands/shuffle.test.ts`
- Modify: `packages/bot/src/commands/clear.ts`
- Modify: `packages/bot/src/commands/clear.test.ts`
- Modify: `packages/bot/src/commands/stop.ts`
- Modify: `packages/bot/src/commands/stop.test.ts`
- Copy from (first example): `packages/bot/src/reply-embed.ts`; command shape from `packages/bot/src/commands/play.ts`

**Steps:**
1. Wrap every `ctx.reply` with `replyEmbed`. Description is the exact current string.
2. Color `error`: `Usage: /remove <position>`, `No track at position {n}.`, `The queue is empty.`, `Nothing is playing.`
3. Color `ok`: `Removed: {title}`, `Shuffled {n} tracks.`, `Cleared {n} tracks.`, `Stopped.`
4. No titles. On `Removed:`, set `url` / `thumbnailUrl` from the removed track.
5. Do not change session calls (`removeUpcomingAt`, `shuffleUpcoming`, `clearUpcoming`, `dropSession`).
6. Each FakeContext uses `recordedReplyText`. Keep assertion strings.

**Verify:**
```bash
bun test packages/bot/src/commands/remove.test.ts packages/bot/src/commands/shuffle.test.ts packages/bot/src/commands/clear.test.ts packages/bot/src/commands/stop.test.ts packages/bot/src/doors.test.ts
bun run --cwd packages/bot typecheck
```
Expected: exit 0, 0 fail. Doors `!leave` and remove-position-1 strings still pass.

**Out of scope:**
- `skip.ts` / `pause.ts` / `resume.ts`
- Leave-policy timers

**Escape hatches:**
- If `dropSession` usage differs from these files, keep the current call order — only change replies.

---

## Task 7: Embed help and settings

**Depends on:** 1
**Spec:** N/A — this plan, Design rules § Command embed shape
**Files:**
- Modify: `packages/bot/src/commands/help.ts`
- Modify: `packages/bot/src/commands/help.test.ts`
- Modify: `packages/bot/src/commands/settings.ts`
- Modify: `packages/bot/src/commands/settings.test.ts`
- Copy from (first example): `packages/bot/src/reply-embed.ts`; keep `formatHelpBody` / `formatSettingsBody` in these files

**Steps:**
1. Keep `formatHelpBody` and `formatSettingsBody` output the same.
2. Help: title `Help`, color `info`, description is `formatHelpBody(prefix)`.
3. Settings: title `Settings`, color `info`, description is `formatSettingsBody(view)`.
4. Do not split into Discord fields. Do not change mention-as-words (`@mention`, `@bot`).
5. FakeContext uses `recordedReplyText`. Keep assertion strings.

**Verify:**
```bash
bun test packages/bot/src/commands/help.test.ts packages/bot/src/commands/settings.test.ts packages/bot/src/doors.test.ts
bun run --cwd packages/bot typecheck
```
Expected: exit 0, 0 fail. Doors help still contains `Music: play` and `Admin (Manage Server)`.

**Out of scope:**
- Operator setter commands
- `register-commands.ts`

**Escape hatches:**
- If help/settings body helpers are inlined, wrap that same string — do not rewrite the list.

---

## Task 8: Embed prefix, setdj, settc, and setvc

**Depends on:** 1
**Spec:** N/A — this plan, Design rules § Command embed shape
**Files:**
- Modify: `packages/bot/src/commands/prefix.ts`
- Modify: `packages/bot/src/commands/prefix.test.ts`
- Modify: `packages/bot/src/commands/setdj.ts`
- Modify: `packages/bot/src/commands/setdj.test.ts`
- Modify: `packages/bot/src/commands/settc.ts`
- Modify: `packages/bot/src/commands/settc.test.ts`
- Modify: `packages/bot/src/commands/setvc.ts`
- Modify: `packages/bot/src/commands/setvc.test.ts`
- Copy from (first example): `packages/bot/src/reply-embed.ts`; command shape from `packages/bot/src/commands/play.ts`

**Steps:**
1. Wrap every `ctx.reply` with `replyEmbed`. Description is the exact current string (including `` `prefix` `` ticks and `<@&id>` / `<#id>` mentions).
2. Color `error`: usage and `Prefix must be 1 to 8 characters.`
3. Color `ok`: set and clear success lines.
4. No titles. Do not change parse / overlay writes.
5. Each FakeContext uses `recordedReplyText`. Keep assertion strings.

**Verify:**
```bash
bun test packages/bot/src/commands/prefix.test.ts packages/bot/src/commands/setdj.test.ts packages/bot/src/commands/settc.test.ts packages/bot/src/commands/setvc.test.ts
bun run --cwd packages/bot typecheck
```
Expected: exit 0, 0 fail.

**Out of scope:**
- `packages/bot/src/operator-config.ts`
- `packages/bot/src/door-gates.ts`
- help / settings

**Escape hatches:**
- If an overlay setter name differs, call the function that exists — do not add a second overlay map.

---

## Task 9: Rewrite README for operators

**Depends on:** none
**Spec:** N/A — this plan, Design rules § Docs
**Files:**
- Modify: `README.md` only
- Copy from (first example): N/A — operator doc, not a UI module. Keep the Need / Discord app / Run / Commands / Env / Missing token section set that already exists in `README.md`

**Steps:**
1. First sentence: yambot means “yet another music bot”.
2. Say it is a Discord music bot you run yourself.
3. Say it does not use Java: no JVM, no Lavalink, no lavaplayer to run the bot. Optional `bun run bench:vs-lavalink` may use a JDK; that is not required to run the bot.
4. Keep Need, Discord app, Run, Commands, Env, and Missing token. Keep current command names, env keys, and the invite URL.
5. Remove the winner-number table and the “this pass” / injected-hot-path paragraph. Point performance detail at `PERF.md` in one short paragraph (one Node process; YouTube webm/opus does not spawn ffmpeg; ffmpeg on PATH for SoundCloud or HTTP).
6. No branch name, slice number, task number, PR number, or “this pass”.
7. Plain English. No metaphor.

**Verify:**
```bash
bun run checks:structure
```
Expected: exit 0. Then confirm by reading `README.md`: the words “yet another music bot” appear; “Java” is named as something this bot does not need to run; no `cursor/`, `slice-`, `Task `, `PR #`, or `this pass`.

**Out of scope:**
- `PERF.md`
- `AGENTS.md`
- `.ai/` files
- Bot TypeScript

**Escape hatches:**
- If a command or env key in today’s README is missing from the tree, drop that name — do not keep a stale command.

---

## Task 10: Strip task language from PERF.md

**Depends on:** none
**Spec:** N/A — this plan, Design rules § Docs
**Files:**
- Modify: `PERF.md` only
- Copy from (first example): N/A — keep the tables and command blocks that already exist in `PERF.md`

**Steps:**
1. Keep measured tables, commands, method notes, scale rows, injected-delay table, LavaPlayer map, Remaining, and Human smoke.
2. Remove “Call for Brice”, “this pass”, “After the Raptor 3 cut”, “post-#10”, “Cut after #10”, and any PR or slice number.
3. You may keep “Measured 2026-09-13 on a Cloud Agent VM” as the date of the numbers.
4. Do not invent new numbers. Do not re-run benches unless a table cell is already blank.
5. No branch name or task number.

**Verify:**
```bash
bun run checks:structure
```
Expected: exit 0. Reading `PERF.md` shows the HTTP winner table still has yambot `http_mpeg_ttfa_ms` p50 `0.425` and Lavalink N=100 `fail_rate` **0.81**. File has no `PR #`, `slice-`, `Task `, `#10`, `this pass`, or `Call for Brice`.

**Out of scope:**
- `README.md`
- `scripts/bench-lavalink/*` TypeScript
- Re-running `bench:vs-lavalink`

**Escape hatches:**
- If a table you would edit does not match these numbers, keep the numbers on disk — do not replace them from memory.

---

## Task 11: Strip task language from remaining non-`.ai/` docs

**Depends on:** none
**Spec:** N/A — this plan, Design rules § Docs
**Files:**
- Modify: `packages/checks/README.md` — describe scanners as they exist; remove stamp / “after stamp” language
- Modify: `scripts/bench-lavalink/README.md` — only if it names a branch, slice, task, or PR; otherwise leave it
- Modify: `BACKWARD_COMPATIBILITY.md` — replace “when slice 6 ships” with “when self-host packaging ships”; keep the empty FROZEN/STABLE tables
- Copy from (first example): N/A — edit existing operator/process docs

**Steps:**
1. `packages/checks/README.md`: say what `structure` and `engine-seam` check today. Commands stay `bun run checks` / `bun run checks:structure` from the repo root. Remove “greenfield stamp” and “after stamp”.
2. Read `scripts/bench-lavalink/README.md`. If it already has no branch/slice/task/PR words, do not edit it.
3. `BACKWARD_COMPATIBILITY.md`: one sentence change for the first candidate. Do not freeze any surface.
4. Do not edit `AGENTS.md` (Task 1 owns the First examples row).

**Verify:**
```bash
bun run checks:structure
```
Expected: exit 0. The three files have no `slice 6`, `slice-`, `Task `, `PR #`, or `stamp` leftover that refers to factory day zero. `BACKWARD_COMPATIBILITY.md` still says nothing is frozen.

**Out of scope:**
- `README.md`, `PERF.md`, `AGENTS.md`
- `.ai/` files
- `packages/checks/configs/structure.ts`

**Escape hatches:**
- If `BACKWARD_COMPATIBILITY.md` already lists a frozen surface, STOP and report — do not clear it.

---

## Task 12: Scoped proof

**Depends on:** 1–11
**Spec:** N/A — this plan, Human smoke and Validation in `AGENTS.md`
**Files:**
- Modify: none unless a Verify command is red (then fix only the failing file; do not start new features)
- Copy from (first example): N/A — proof task

**Steps:**
1. Run the verify block below.
2. Confirm `packages/bot/package.json` gained no new production dependency and still depends on `discord.js` and `@yambot/audio-engine`.
3. Confirm `packages/audio-engine/package.json` still has no `discord.js` dependency.
4. Paste the Human smoke list from this plan into the finish report. Do not invent a second script.
5. Do not run `bench:perf`, `bench:load`, or `bench:vs-lavalink`.

**Verify:**
```bash
bun run typecheck
bun test packages/bot
bun run checks
```
Expected: all three exit 0, 0 fail. `engine-seam` pass (R1/R2). Structure pass.

**Out of scope:**
- Merging
- Human smoke (flag unverifiable; draft PR)

**Escape hatches:**
- If typecheck or tests are red, fix only the regression — do not add features.
- If live Discord is unavailable, leave smoke as can’t tell yet and do not mark embeds proved.
