# Slice 5 — Operator surface and command parity

**Status:** ready-for-plan
**Research:** `.ai/research/jmusicbot-operator-surface.md` (command classes
and knobs). `.ai/research/discord-and-youtube-platform.md` (same Discord
surface; no new client).
**Grill:** N/A — autonomous mode (no human). Resolutions are marked
**Autonomous** in Open questions.
**Raptor:** `.ai/runs/2026-08-27-raptor-slice-5-operator-surface.md`
**Depends on:** `.ai/specs/2026-08-11-slice-1-core-playback.md` (command
modules, doors, `COMMAND_PREFIX`), `.ai/specs/2026-08-17-slice-2-core-music-controls.md`
(idle leave vs alone-timer), slices 3–4 command set.

## Problem

Slices 1–4 play music for anyone in the guild. There is no DJ role, no
guild prefix, no mention-as-prefix, no help, and no operator knobs for
leave policy. JMusicBot-class self-host needs a DJ/admin surface and
prefix parity without a dashboard or a new settings store.

## Goals

- An operator sets a DJ role, a guild prefix, optional text/voice
  channel binds, and leave knobs. DJ-class commands refuse non-DJ
  invokers when a DJ role is set. Music commands still work for everyone
  when no DJ role is set (current guilds keep working).
- Prefix door accepts the env/guild prefix **and** a bot mention
  (`@Bot skip`). `prefix` / `setdj` / `settc` / `setvc` / `settings` /
  `help` exist on both doors.
- Leave policy knobs: `stayinchannel` (no idle leave after an empty
  queue), `alonetimeuntilstop` (leave and clear when alone),
  `IDLE_LEAVE_SECONDS` (slice 2 wait, default 300). Alone-timer and idle
  leave stay two clocks.
- Env + in-memory overlay only. No database. No settings file. No new
  package. No new production dependency. Engine stays Discord-free.

## Non-goals

- Vote skip, `forceskip` as a second command, `skipratio`, requester-only
  remove.
- Volume, seek, lyrics, repeat, playnext, move, skipto, forceremove,
  search picker, local `Playlists/` folder, `queuetype`.
- Live channel topic / now-playing editor (`settc` is a channel gate
  only).
- Owner commands (shutdown, setavatar, setgame, autoplaylist). `about`
  and `ping`.
- SaaS accounts, dashboard, persistence store, new workspace package,
  new production dependency.
- Java, JVM, Lavalink, lavaplayer. Engine Discord types.

## Design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Persistence | Env for process defaults. In-memory `Map<guildId, overlay>` for `prefix` / `setdj` / `settc` / `setvc`. Overlay dies on restart. | Ask-first forbids a new store. Env/config files are allowed. Self-host operators put durable values in `.env`. **Autonomous.** |
| Unset DJ role | DJ-class commands stay open (anyone). | Preserve slices 1–4. JMusicBot admin-only default would break existing smoke. **Autonomous** deviation, documented. |
| Set DJ role | DJ role **or** Manage Server. | JMusicBot: admins always DJ. Manage Server is the Admin command permission on Discord. |
| DJ-class commands | `pause`, `resume`, `remove`, `shuffle`, `clear`, `stop`, `skip`. | Queue control. `play` / `scsearch` / `queue` / `nowplaying` stay Music. **Autonomous.** |
| Vote skip | Out. Skip is instant for allowed invokers. | No requester field. Vote skip is a second product. Raptor. |
| Prefix | `COMMAND_PREFIX` default `!`. Guild overlay via `prefix`. `prefix none` clears overlay. Mention is always a prefix. | Architecture: guild prefix + mention-as-prefix. Slice 1 default stands. |
| Mention parse | Content starts with `<@botId>` or `<@!botId>`, optional space, then name + args. | No extra intent. Message content already required. |
| `stayinchannel` | Env `STAY_IN_CHANNEL` true/false, default false. When true, do not arm idle leave. | JMusicBot config-only knob. |
| Alone-timer | Env `ALONE_TIME_UNTIL_STOP` seconds, default `0` (off). >0: after that many seconds with no human in the bot’s voice channel, `dropSession` (leave + clear). Cancel when a human joins. | Slice 2 parked this. Independent of idle leave. |
| Idle leave duration | Env `IDLE_LEAVE_SECONDS`, default `300`. Used only when `STAY_IN_CHANNEL` is not true. | Slice 2 constant becomes config. |
| `settc` / `setvc` | In-memory channel ids. Wrong text channel → `Use music commands in <#id>.` Wrong voice on play/scsearch → `Join #{name} to play.` Do not delete user messages. Do not edit channel topic. | Operator bind without Manage Messages or a now-playing editor. |
| Admin commands | `prefix`, `setdj`, `settc`, `setvc` require Manage Server. Guild owner counts (Discord grants them all guild permissions). | JMusicBot Admin = Manage Server. |
| `settings` / `help` | Anyone. `settings` shows current guild view. `help` lists commands by class. | General + parked help. |
| Prefix aliases | Existing `np`, `leave`. Add `setprefix` → `prefix`, `status` → `settings`. | Fewest aliases that match JMusicBot names we ship. |
| Scoping | Same guild axis. Overlay map is guild-keyed. Session leave policy is read at `createSession` from env (process-wide knobs). | Constitution scoping. Channel/DJ overlay is not on the engine. |
| Hard rules | R1: no Discord in the engine; leave/DJ stay bot-side. R2: bot → engine. R3: zero Java. R4: UX parity; do not copy JMusicBot settings file or command framework. | |
| Pattern to copy | Command modules copy `packages/bot/src/commands/play.ts`. Overlay module is a new first example: `packages/bot/src/operator-config.ts`. | Mint the First examples row this slice. |
| Proof | Typecheck + `bun test packages/bot` (+ engine unchanged) + named human smoke. Structure check grows required command files + `operator-config.ts`. | Constitution §5. Voice/permission in a live guild is unverifiable. |
| Frozen surfaces | None. | |
| Ask first | No new production dependency. No new package. No persistence store. Honored. | |
| Out of scope | See Non-goals. | |
| Symmetric ops | `setdj` ↔ `setdj none`; `prefix` ↔ `prefix none`; `settc` ↔ `settc none`; `setvc` ↔ `setvc none`. Markers are overlay fields. | |
| Client / platform | Copy slices 1–4: slash defers; prefix channel message; guild bulk PUT grows; mention suppress; public replies. Manage Server checked on the member; no extra invite permission. | Same Discord surface. |
| Transition | No persisted users. After restart, overlay is gone; env defaults apply. DJ gate is new only when `DJ_ROLE_ID` or `setdj` is used. | |
| Unverifiable | Live DJ deny, mention prefix, settc/setvc, alone-timer wall clock, stay-in-channel, slash appearing. Named smoke. | CI has no Discord. |
| Raptor refuse | No settings file, no DB, no vote skip, no volume/seek, no live topic, no owner commands, no `about`/`ping`, no extra packages, no engine changes. | Raptor run. |

## Behavior

Copy slices 1–4 unless this section replaces them.

### Operator config

New module `packages/bot/src/operator-config.ts`. No Discord types.

```typescript
export interface OperatorEnv {
  readonly commandPrefix: string;
  readonly djRoleId: string | null;
  readonly stayInChannel: boolean;
  readonly aloneTimeUntilStopSeconds: number;
  readonly idleLeaveSeconds: number;
}

export interface GuildOperatorOverlay {
  readonly prefix?: string;
  readonly djRoleId?: string | null;
  readonly textChannelId?: string | null;
  readonly voiceChannelId?: string | null;
}

export interface GuildOperatorView {
  readonly prefix: string;
  readonly djRoleId: string | null;
  readonly textChannelId: string | null;
  readonly voiceChannelId: string | null;
  readonly stayInChannel: boolean;
  readonly aloneTimeUntilStopSeconds: number;
  readonly idleLeaveSeconds: number;
}
```

`readOperatorEnv(env)`:

| Key | Default | Rules |
|-----|---------|-------|
| `COMMAND_PREFIX` | `!` | Empty → `!`. Already exists. |
| `DJ_ROLE_ID` | unset / null | Empty → null. |
| `STAY_IN_CHANNEL` | `false` | `true` / `1` / `yes` (case-insensitive) → true. Else false. |
| `ALONE_TIME_UNTIL_STOP` | `0` | Integer seconds. Missing, non-integer, or ≤0 → `0` (off). |
| `IDLE_LEAVE_SECONDS` | `300` | Integer seconds. Missing or non-integer → `300`. `0` means leave immediately when idle (still respects `STAY_IN_CHANNEL`). Negative → `300`. |

Overlay map is process-global, keyed by guild id. `getGuildOperatorView(guildId, env)` merges overlay over env. `prefix` overlay, when set to a non-empty string, replaces env prefix. Clearing overlay prefix (`prefix none`) deletes that field.

`canUseDjCommands({ djRoleId, invokerIsAdmin, invokerRoleIds })`: if `djRoleId` is null, return true. If `invokerIsAdmin`, return true. Else whether `invokerRoleIds` includes `djRoleId`.

`canManageGuild` is **not** in this module — the door passes `invokerIsAdmin` from Discord `ManageGuild` (or Administrator, which implies it).

### Prefix parse (mention)

`parsePrefixMessage` grows optional `botUserId: string`. After the existing prefix check, if content starts with `<@botUserId>` or `<@!botUserId>`, strip that mention plus following whitespace and parse name/args. Mention works even when a string prefix is also set. Empty after mention → null.

`readPrefixDoorCommand` uses the guild view prefix, not only env. Unknown names still drop silently.

### Leave policy on the session

`CreateSessionInput` grows:

```typescript
export interface LeavePolicy {
  readonly idleLeaveMs: number;
  readonly stayInChannel: boolean;
  readonly aloneTimeUntilStopMs: number;
}
```

Default when omitted: `{ idleLeaveMs: 300_000, stayInChannel: false, aloneTimeUntilStopMs: 0 }` (slice 2). Tests inject. `main.ts` passes values from `readOperatorEnv`.

`IDLE_LEAVE_AFTER_MS` remains `300_000` as the default constant. `#armIdleLeave` uses `leavePolicy.idleLeaveMs` and no-ops when `stayInChannel` is true.

`noteHumanListenerCount(count: number)`: if `aloneTimeUntilStopMs === 0`, return. If `count > 0`, cancel the alone timer. If `count === 0` and the bot is in voice, schedule `dropSession` after `aloneTimeUntilStopMs`. No extra message when it fires. `leaveNow` and voice-drop cancel the alone timer. Humans = non-bot members in the session’s voice channel. The bot itself is a bot; do not count it.

`main.ts` listens for `VoiceStateUpdate`. When the session exists, count humans in `session`’s current voice channel and call `noteHumanListenerCount`. No extra gateway intent (already `GuildVoiceStates`).

### CommandContext

Add `readonly invokerUserId: string` (needed for future requester work? **Raptor: skip unless a command needs it.** Vote skip is out. setdj does not need it. **Do not add invokerUserId unless a shipped command reads it.**)

Door-only fields stay in `main.ts`. Command modules keep today’s `CommandContext` plus whatever args they already parse. **Autonomous: CommandContext unchanged.** Admin/DJ/channel gates run in the door before `dispatchCommand`.

Slash args for new commands: serialize the option into `args` the same way `remove` serializes `position`.

- `setdj`: role id, or `none` when the option is omitted / prefix `none`.
- `prefix`: the string, or `none`.
- `settc`: channel id, or `none`.
- `setvc`: channel id, or `none`.
- `help` / `settings`: empty args.

### Door gates (before dispatch)

Order:

1. Parse command (slash name or prefix/mention).
2. If admin command (`prefix`, `setdj`, `settc`, `setvc`) and not `invokerIsAdmin` → reply `You need Manage Server to use that.` Stop.
3. If DJ-class command and not `canUseDjCommands` → reply `You need the DJ role to use that.` Stop.
4. If music or DJ-class command (not admin, not `help`, not `settings`) and `textChannelId` is set and `ctx.channelId` differs → reply `Use music commands in <#id>.` Stop.
5. If `play` or `scsearch` and `voiceChannelId` is set and invoker voice channel differs (including null) → reply `Join #{name} to play.` (`#` plus the channel name; if the name is unknown, `Join the bound voice channel to play.`) Stop. Do not create a session solely to fail this check — resolve the name from the guild cache in the door.
6. Dispatch as today (`play`/`scsearch` still `getOrCreateGuildSession`).

`invokerIsAdmin`: member permissions include `ManageGuild`. Missing member → not admin.

### Commands

Copy `play.ts`: one file, slash builder export, `executeX(ctx, session?)`.

#### help

Anyone. One public reply. No session.

```text
Music: play, scsearch, queue, nowplaying (np), skip
DJ (when a DJ role is set): pause, resume, remove, shuffle, clear, stop, skip
Admin (Manage Server): prefix, setdj, settc, setvc
Also: settings, help
Prefix: {prefix} and @mention. Example: {prefix}play and @bot skip
```

Use the guild view prefix in the example. Keep under 2000 chars. Mentions suppressed (bot mention in the example should not ping — wrap as text `` `@bot` `` or `<@id>` with suppress). **Autonomous:** write `@mention` as the word, not a live mention: `Prefix: {prefix} and @mention`.

#### settings

Anyone. One public reply. No session.

```text
Prefix: `{prefix}`
DJ role: <@&id>   (or none — DJ commands are open)
Text channel: <#id>   (or none)
Voice channel: <#id>   (or none)
Stay in channel: yes|no
Alone time until stop: {n}s   (or off)
Idle leave: {n}s
```

When DJ role is none, the DJ line is `DJ role: none — DJ commands are open`. Role/channel mentions display; pings stay suppressed.

#### setdj

Manage Server (door). Args: role id or `none`.

- `none` or empty → overlay `djRoleId: null` (clears env DJ for this guild until restart? **Autonomous:** overlay `null` means “no DJ role for this guild”, which **overrides** env `DJ_ROLE_ID` for that guild. `setdj none` then open commands even if env has a role. Restart without overlay returns to env.)
- Else store that role id. Do not resolve names in the command module; the door puts a snowflake in `args`. Prefix: accept `<@&id>` or a raw id. Invalid → `Usage: /setdj <role>` (prefix: same slash-shaped usage string as other commands).
- Success: `DJ role set to <@&id>.` or `DJ role cleared. DJ commands are open.`

#### prefix (command file `commands/prefix.ts`)

Manage Server. Args: string or `none`.

- Empty → `Usage: /prefix <prefix>` 
- `none` → clear overlay prefix. Reply `Prefix reset to `{envPrefix}`.`
- Else: reject whitespace-only. Reject a prefix longer than 8 characters → `Prefix must be 1 to 8 characters.` Store overlay. Reply `Prefix set to `{p}`.`
- Mention-as-prefix always remains.

Slash: string option `value` required? Make it required so Discord enforces presence; `none` is the clear token.

#### settc

Manage Server.

- `none` or empty option → clear. `Text channel cleared.`
- Else store channel id. `Text channel set to <#id>.`
- Prefix: `<#id>` or raw id. Invalid → `Usage: /settc <channel>`

Slash: optional channel option; omit means `none`.

#### setvc

Same shape for a voice channel.

- Clear: `Voice channel cleared.`
- Set: `Voice channel set to #{name}.` If name unknown, `Voice channel set.`
- Prefix: raw id (voice channels are not `<#>` in the same way in messages? They are `<#id>` too.) Accept `<#id>` or raw id.
- Invalid → `Usage: /setvc <channel>`

Slash: optional channel option (guild voice). Omit = none.

### Package layout (adds)

```text
packages/bot/src/
  operator-config.ts          env + overlay + canUseDjCommands
  operator-config.test.ts
  prefix.ts                   mention-as-prefix (parser)
  guild-music-session.ts      LeavePolicy, noteHumanListenerCount
  main.ts                     gates, VoiceStateUpdate, aliases, register
  register-commands.ts        help, settings, setdj, prefix, settc, setvc
  commands/help.ts
  commands/settings.ts
  commands/setdj.ts
  commands/prefix.ts
  commands/settc.ts
  commands/setvc.ts
```

No engine file changes. No new packages. No new production dependencies.

`.env.example` lists the five keys with comments. README lists new commands, env knobs, and that runtime overlay dies on restart.

`packages/checks/configs/structure.ts`: `bot-src` requires `operator-config.ts`. `bot-command-module` requires the six new command files. Do not drop existing names.

AGENTS.md First examples: add row **Guild operator config** → `packages/bot/src/operator-config.ts`.

## Scene

Happy path: Brice invites the bot (same scopes as slice 1). `/help` lists commands. `/settings` shows prefix `` `!` ``, DJ none (open), channels none, stay no, alone off, idle 300s. He runs `/setdj` with the DJ role. A member without that role runs `/pause` while music plays and sees `You need the DJ role to use that.`; audio continues. A DJ member `/pause` → `Paused: {title}`. He sets `/prefix ?`. `?skip` works. `@Bot skip` also works. `!skip` is ignored. `/prefix none` restores `!`. He sets `/settc` to `#music`. `/queue` in `#general` replies `Use music commands in <#music>.` `/settc none` restores any channel. `/setvc` to a stage/voice channel; play from another voice replies `Join #{name} to play.` Env `STAY_IN_CHANNEL=true` (restart): last track ends, bot stays. Env `ALONE_TIME_UNTIL_STOP=5` (restart): everyone leaves voice; after 5s the bot leaves and the queue is gone.

Failure modes:

1. Member without Manage Server runs `/setdj` → `You need Manage Server to use that.` Overlay unchanged.
2. `/prefix` with a 20-character string → `Prefix must be 1 to 8 characters.` Overlay unchanged.
3. Music command in the wrong text channel → bound-channel reply; no join, no queue change.

If Discord voice drops: slice 2 drop behavior stands. Alone-timer and idle-leave cancel on drop (bot is not in voice). Next `/play` rejoins.

## Client / platform contract

- **ACK timing:** slash defers at receipt (same as slices 1–4). Prefix is a channel message. All replies public; no ephemeral; no DMs (JMusicBot DMs on wrong settc — we do not).
- **Registration:** guild-scoped bulk PUT adds `help`, `settings`, `setdj` (optional role), `prefix` (required string `value`), `settc` (optional channel), `setvc` (optional channel). No slash aliases. `setprefix` is prefix-only.
- **Naming and sanitize:** slash names lowercase. Every reply suppresses all mentions. Track titles stay untrusted. Settings may include `<@&role>` / `<#channel>` display mentions with parse disabled.
- **Permissions:** same invite as slice 1. Manage Server is a member permission, not a bot invite flag. DJ is a guild role id, not a Discord permission.
- **Rate limits:** no custom handling.
- **Ledger-vs-reply-vs-mirror:** N/A — in-memory overlay plus the reply.
- **Symmetric ops:** set/clear pairs above. slash↔prefix same modules; aliases prefix-only.

## Transition plan

No persisted queues or users. Operators on slices 1–4 see these behavior changes:

- New slash names appear on ready PUT.
- Mention-as-prefix starts working (`@Bot play`).
- If they set `DJ_ROLE_ID` in env, DJ-class commands start denying non-DJ members.
- If they do not set a DJ role, music control stays open.
- Idle leave still 5 minutes unless they set `IDLE_LEAVE_SECONDS` or `STAY_IN_CHANNEL`.
- Alone-timer stays off unless they set `ALONE_TIME_UNTIL_STOP`.

Runtime `setdj` / `prefix` / `settc` / `setvc` reset on process restart. README says so.

Rollback: run the slice 4 build. No data migration.

## Acceptance criteria

- [ ] `readOperatorEnv` / overlay merge / `canUseDjCommands` unit tests pass with no Discord login. Unset DJ role → anyone. Set role → role or admin. Overlay `djRoleId: null` overrides env role.
- [ ] Prefix parser: string prefix still works; mention forms `<@id>` and `<@!id>` parse; mention plus prefix both work; bots/DMs still null.
- [ ] Session: `stayInChannel` does not arm idle leave; `idleLeaveMs` is used when not staying; `noteHumanListenerCount(0)` arms alone-timer; count > 0 cancels; `0` ms alone policy never arms; drop/leave cancels both timers. Injected schedules; no real 5-minute sleep.
- [ ] Door tests (fake members, no network): admin deny, DJ deny, settc wrong channel, setvc wrong voice, allow paths, aliases `setprefix` and `status`, mention parse wired.
- [ ] Command tests: help/settings/setdj/prefix/settc/setvc success and usage/error replies. Prefix `none` / setdj `none` / settc `none` / setvc `none` clear overlay.
- [ ] Guild slash PUT includes the six new names. `bun run typecheck` passes. `bun test packages/bot` passes. `bun test packages/audio-engine` still passes (no engine edit required). `bun run checks` passes (structure + engine-seam).
- [ ] No new workspace package; no new production dependency; no settings file or database. R1/R2/R3 hold.
- [ ] README and `.env.example` document the env keys and that overlay dies on restart. Structure check requires `operator-config.ts` and the six command files. AGENTS.md First examples has the operator-config row.
- [ ] Named human smoke below. Live Discord/voice stays unverifiable in CI.

## Open questions

Autonomous resolutions (2026-08-27; no grill):

- [x] Persistence — **Autonomous:** env + in-memory overlay. No store. Restart drops overlay. Ask-first not crossed.
- [x] Unset DJ role — **Autonomous:** commands stay open (deviation from JMusicBot admin-only).
- [x] Vote skip — **Autonomous:** out. Instant skip for allowed invokers.
- [x] Remaining catalog (volume, seek, lyrics, repeat, playnext, move, skipto, owner, about, ping) — **Autonomous:** out. Operator surface is the slice outcome; those are extra products (some need decode).
- [x] `settc` topic editor — **Autonomous:** out. Channel gate only.
- [x] Wrong-channel DM + delete — **Autonomous:** public reply only; do not delete; do not DM.
- [x] `setdj none` vs env `DJ_ROLE_ID` — **Autonomous:** overlay null wins for that guild until restart.
- [x] Prefix max length — **Autonomous:** 1–8 characters.
- [x] CommandContext — **Autonomous:** unchanged; gates live in the door.
- [x] `IDLE_LEAVE_SECONDS=0` — **Autonomous:** idle leave immediate unless `STAY_IN_CHANNEL`.
- [x] Admin permission — **Autonomous:** Manage Server (`ManageGuild`).
- [x] New dependencies / packages / store — **Autonomous:** none.

## Proof plan

Per constitution §5:

- Bot command/session/config → `bun run typecheck` + `bun test packages/bot`.
- Engine untouched → still run `bun test packages/audio-engine` once before PR.
- Structure + R1/R2 → `bun run checks`.
- Voice, live permissions, mention in Discord → human smoke.
- Every commit through `/check-and-commit`.

Unverifiable (CI cannot prove): slash names appearing; `@Bot skip` in a real guild; Manage Server / DJ role actually denied by Discord; settc/setvc against real channels; bot leaving when the last human leaves; bot staying when `STAY_IN_CHANNEL` is true after the queue ends; overlay dying on a real restart.

At ship this slice stays a **draft PR** until the smoke below passes — or with those items listed as blockers. Spec status stays `ready-for-plan`. Do not invent a third status.

Human smoke script (test guild; slices 1–4 smoke already green):

0. Start from README. Confirm new slash names: `help`, `settings`, `setdj`, `prefix`, `settc`, `setvc`. Confirm `/setprefix` does **not** appear.
1. `/help` lists Music / DJ / Admin. `/settings` shows prefix `!`, DJ none — open, channels none, stay no, alone off, idle 300s.
2. Play a track. A non-admin `/pause` still works (DJ unset).
3. `/setdj` as a Manage Server member with a role. `/settings` shows that role. A member **without** the role `/pause` → `You need the DJ role to use that.`; audio continues. A member **with** the role `/pause` → `Paused: {title}`. `/resume` works for DJ. Non-admin `/setdj` → `You need Manage Server to use that.`
4. `/prefix ?` → prefix set. `?np` works. `!np` is ignored. `@Bot np` works (mention). `/prefix none` restores `!`. `!np` works again.
5. `/settc` to the current channel. `/queue` works there. In another text channel `/queue` → `Use music commands in <#…>.` `/settc none` restores both channels. `/help` still works in the other channel.
6. `/setvc` to voice A. From voice B, `/play <url>` → `Join #{A} to play.` From voice A, `/play` works. `/setvc none`.
7. `/setdj none`. Non-DJ `/skip` works again (open).
8. Restart the process **without** changing `.env`. `/settings` DJ/prefix/channels are back to env defaults (overlay gone).
9. Stop. Set `STAY_IN_CHANNEL=true`, restart. Play one short track; after it ends the bot **stays**. `/stop` still leaves now.
10. Stop. Set `STAY_IN_CHANNEL=false`, `ALONE_TIME_UNTIL_STOP=10`, restart. Play a track. Everyone except the bot leaves the voice channel. Within ~10s the bot leaves and `/nowplaying` is `Nothing is playing.` Do not wait 5 minutes for idle leave; this step is the alone-timer.
11. Prefix aliases: `!status` → settings, `!setprefix none` matches `/prefix none` (admin).

## Changelog

- 2026-08-27: created in autonomous spec-writing (no grill). Resolutions listed in Open questions. Status: ready-for-plan. Raptor then `/plan`.
