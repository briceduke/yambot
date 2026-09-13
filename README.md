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

Slash commands `/play`, `/scsearch`, `/skip`, `/queue`, `/pause`, `/resume`, `/nowplaying`, `/remove`, `/shuffle`, `/clear`, and `/stop` register themselves when the bot comes online (every guild on ready, and again when invited to a new guild). No extra register step. If they do not appear, re-invite with `applications.commands` and restart.

`/play` accepts a YouTube URL, a YouTube playlist URL, a SoundCloud track URL, a SoundCloud set URL, an HTTP stream URL, or YouTube search words. `/scsearch` searches SoundCloud and plays the top hit.

`bun run dev` starts the same bot with Node `--watch` (restarts on file change).

## Playback benches

`bun run bench:perf` prints JSON and a markdown table. Injected source
clients and a mocked voice port. No Java, no Discord token, no live
YouTube. Optional `--n 10` sets repeats (default 10).

`bun run bench:load` is a headless N-session scale sweep (default
webm/opus fixtures, N = 1, 10, 50, 100). Not in CI. `--mode mock` is
the Java-free subset used by unit tests. `--mode http` uses real HTTP
resolve/open and PATH ffmpeg.

`bun run bench:vs-lavalink` is **opt-in**. It needs a JDK 17+, downloads
a pinned Lavalink jar, and prints a yambot vs Lavalink winner table.
Never run from CI. See `scripts/bench-lavalink/README.md`.

Numbers and the winner table live in `PERF.md`.

## Commands

Slash: `/play`, `/scsearch`, `/skip`, `/queue`, `/pause`, `/resume`, `/nowplaying`, `/remove`, `/shuffle`, `/clear`, `/stop`.

Prefix (default `!`; override with `COMMAND_PREFIX`): `!play`, `!scsearch`, `!skip`, `!queue`, `!pause`, `!resume`, `!nowplaying` (`!np`), `!remove`, `!shuffle`, `!clear`, `!stop` (`!leave`).

After the last track the bot stays 5 minutes, then leaves. `/stop` leaves now.

If the process exits and the message mentions Message Content, enable that intent in the portal and restart.

## Missing token

With `DISCORD_TOKEN` unset and without relying on `.env`, the process exits non-zero and prints:

`DISCORD_TOKEN is missing. Set it in the environment and start again.`

PowerShell:

```
Remove-Item Env:DISCORD_TOKEN -ErrorAction SilentlyContinue; node packages/bot/src/main.ts
```
