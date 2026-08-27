# JMusicBot operator surface (slice 5)

Domain inventory, not a new Discord platform note. Discord ACK, intents, and
registration stay in `.ai/research/discord-and-youtube-platform.md` (proved in
slices 1–4). This file lists JMusicBot operator knobs and command classes so
slice 5 can copy UX without copying internals.

Sources: [JMusicBot commands](https://jmusicbot.com/commands/),
[example config](https://jmusicbot.com/config/), checked 2026-08-27.

## Summary

JMusicBot splits commands into General, Music (anyone), DJ (admin + one DJ
role), Admin (Manage Server), and Owner. Server setup lives in `config.txt`
plus per-guild overrides (`prefix`, `setdj`, `settc`, `setvc`) stored in
JMusicBot’s own settings file. yambot must not add that store this slice
(ask-first). Env + in-memory overlay is enough for a self-host bot.

## Command classes (UX reference)

| Class | Who | yambot today | Slice 5 take |
|-------|-----|--------------|--------------|
| General: `about`, `ping`, `settings` | Anyone | none | `settings` only. `about`/`ping` do not earn keep. |
| Music: play, queue, np, skip (vote), lyrics, search picker, playlists folder | Anyone; settc binds text channel | play, scsearch, queue, np, skip (instant), no picker | Keep music doors. Gate by settc when set. No lyrics, picker, local playlists, vote skip. |
| DJ: pause, stop, forceskip, volume, repeat, playnext, move, skipto, forceremove | Admin + DJ role. No DJ role → admin only | pause, resume, remove, shuffle, clear, stop, skip — anyone | Gate pause/resume/remove/shuffle/clear/stop/skip when a DJ role is set. Unset DJ role stays open (current UX). No volume/seek/repeat/playnext/move/skipto/forceremove (decode or extra queue product). |
| Admin: `prefix`, `setdj`, `settc`, `setvc`, `setskip`, `queuetype` | Manage Server | none | `prefix`, `setdj`, `settc`, `setvc`. No `setskip`/`queuetype` (no vote skip, one queue). |
| Owner: shutdown, setavatar, playlists folder, autoplaylist | Bot owner id | none | Out. Process manager stops the process. Slice 6 packaging. |

`help` is the command-list door (slice 1 parked it here). Prefix aliases we
already copy: `np` → nowplaying, `leave` → stop. Add `setprefix` → prefix,
`status` → settings. Do not import JMusicBot’s full alias table.

## Config knobs (UX reference)

| JMusicBot | Meaning | yambot slice 5 |
|-----------|---------|----------------|
| `prefix` | String prefix; unset means mention-only | `COMMAND_PREFIX` default `!` (slice 1). Also accept mention as prefix. Guild overlay via `prefix` command. |
| `altprefix` | Second prefix | Out. Mention covers the second door. |
| `stayinchannel` | Do not leave when the queue ends | `STAY_IN_CHANNEL` env (`true`/`false`, default `false`). No Discord command (JMusicBot has none). |
| `alonetimeuntilstop` | Seconds alone in voice before leave+clear; ≤0 off | `ALONE_TIME_UNTIL_STOP` seconds, default `0` (slice 2 stay-when-alone). |
| Idle leave after nothing playing | Not a JMusicBot name; yambot slice 2 is 5 minutes | `IDLE_LEAVE_SECONDS`, default `300`. Independent of the alone-timer. |
| DJ role | One role; `setdj none` → admin-only DJ commands | `DJ_ROLE_ID` env optional. `setdj` overlay. **Deviation:** unset role keeps DJ commands open (do not surprise existing guilds). Set role → that role or Manage Server. |
| `settc` / `setvc` | Bind music text / voice channel | In-memory overlay. No live channel topic (that is a now-playing editor). |
| `skipratio` | Vote-skip percent | Out with vote skip. |
| `token`, `owner`, emojis, `eval`, lyrics provider, transforms | Process / owner toys | Token already. Rest out. |

## Persistence

JMusicBot writes per-guild settings to a file. Architecture: in-memory and
env/config files until a slice proves a store. Ask-first: do not add a
database or a new file-backed settings store. Env survives restart. Runtime
`setdj` / `prefix` / `settc` / `setvc` are an in-memory overlay and die on
restart. Operators who need a value after restart put it in `.env`.

## Failure modes for the scene

- Non-DJ uses pause after a DJ role is set → deny; audio unchanged.
- Non-admin uses `setdj` → deny; overlay unchanged.
- Music command in the wrong text channel when settc is set → point at the
  bound channel; do not delete the user message (needs Manage Messages).
- Play while setvc is set and the invoker is in another voice channel →
  tell them to join the bound channel; do not yank the bot.
- Mention-as-prefix with no extra prefix character: `@Bot skip` still parses.
- Alone-timer and idle-leave are different clocks. Do not merge them.

## Recommendation

Ship operator config + DJ gate + prefix/mention parity + help/settings +
settc/setvc + leave knobs. Do not ship the rest of the JMusicBot catalog
(volume, vote skip, owner commands, live topic). That is UX-class operator
parity, not a port of `Bot.java` / `GuildSettings`.
