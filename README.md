# yambot

Discord music bot. Play YouTube audio in a voice channel. No Java.

## Need

- Node 24 or newer (bot process)
- bun (install and test)
- ffmpeg on PATH for SoundCloud or HTTP streams. YouTube video play does not need ffmpeg. The bot starts without ffmpeg.

## Discord app

1. Open the [Discord developer portal](https://discord.com/developers/applications). Create an application and a bot. Copy the bot token.
2. Enable the Message Content intent (privileged) on the bot page.
3. Invite the bot with scopes `bot` and `applications.commands`, and permissions View Channel, Send Messages, Connect, and Speak.

Invite URL (replace `CLIENT_ID` with your application id):

```
https://discord.com/oauth2/authorize?client_id=CLIENT_ID&scope=bot%20applications.commands&permissions=3148800
```

## Run

1. Copy `.env.example` to `.env` and set `DISCORD_TOKEN`.
2. From the repo root run `bun install`, then `bun start`.
3. The bot shows online in Discord.

Slash commands `/play`, `/scsearch`, `/skip`, `/queue`, `/pause`, `/resume`, `/nowplaying`, `/remove`, `/shuffle`, `/clear`, `/stop`, `/help`, `/settings`, `/setdj`, `/prefix`, `/settc`, and `/setvc` register themselves when the bot comes online (every guild on ready, and again when invited to a new guild). No extra register step. If they do not appear, re-invite with `applications.commands` and restart.

`/play` accepts a YouTube URL, a YouTube playlist URL, a SoundCloud track URL, a SoundCloud set URL, an HTTP stream URL, or YouTube search words. `/scsearch` searches SoundCloud and plays the top hit.

`bun run dev` starts the same bot with Node `--watch` (restarts on file change).

## Commands

Slash: `/play`, `/scsearch`, `/skip`, `/queue`, `/pause`, `/resume`, `/nowplaying`, `/remove`, `/shuffle`, `/clear`, `/stop`, `/help`, `/settings`, `/setdj`, `/prefix`, `/settc`, `/setvc`.

Prefix (default `!`; override with `COMMAND_PREFIX`): `!play`, `!scsearch`, `!skip`, `!queue`, `!pause`, `!resume`, `!nowplaying` (`!np`), `!remove`, `!shuffle`, `!clear`, `!stop` (`!leave`), `!help`, `!settings` (`!status`), `!setdj`, `!prefix` (`!setprefix`), `!settc`, `!setvc`.

A bot mention also works as a prefix: `@Bot skip` is the same as `!skip`.

`/help` lists commands. `/settings` shows the current guild prefix, DJ role, bound channels, and leave knobs.

`/setdj`, `/prefix`, `/settc`, and `/setvc` need Manage Server. Values they set live in memory and die on restart. Put durable values in `.env`.

When no DJ role is set, DJ commands (`pause`, `resume`, `remove`, `shuffle`, `clear`, `stop`, `skip`) stay open. When a DJ role is set (`DJ_ROLE_ID` or `/setdj`), those commands need that role or Manage Server.

## Env

| Key | Default | Meaning |
|-----|---------|---------|
| `DISCORD_TOKEN` | (required) | Bot token. |
| `COMMAND_PREFIX` | `!` | Prefix for channel messages. Mention-as-prefix always works too. |
| `DJ_ROLE_ID` | unset | Discord role id. Empty or unset: DJ commands stay open. |
| `STAY_IN_CHANNEL` | `false` | `true`: do not leave after an empty queue. `/stop` still leaves now. |
| `ALONE_TIME_UNTIL_STOP` | `0` | Seconds with no human in the bot’s voice channel before leave and clear. `0` is off. |
| `IDLE_LEAVE_SECONDS` | `300` | Seconds to wait after the last track, then leave. Ignored when `STAY_IN_CHANNEL` is true. |

After the last track the bot stays `IDLE_LEAVE_SECONDS` (default 5 minutes), then leaves. `/stop` leaves now.

If the process exits and the message mentions Message Content, enable that intent in the portal and restart.

## Missing token

With `DISCORD_TOKEN` unset and without relying on `.env`, the process exits non-zero and prints:

`DISCORD_TOKEN is missing. Set it in the environment and start again.`

PowerShell:

```
Remove-Item Env:DISCORD_TOKEN -ErrorAction SilentlyContinue; node packages/bot/src/main.ts
```
