# yambot

Discord music bot. Play YouTube audio in a voice channel. No Java.

## Performance

yambot plays in one Node process. No JVM, no Lavalink sidecar. YouTube
audio stays webm/opus and does not spawn ffmpeg. Play and skip are
fast. On this VM, 100 headless guild sessions stay at 0 fail; Lavalink
timed out on about 80% of players at N=100.

Same-machine bake-off vs Lavalink 4.2.2 (local HTTP fixture, n=10).
Method, caveats, and full tables: `PERF.md`.

| What | yambot | Lavalink | Winner |
|------|-------:|---------:|--------|
| HTTP load p50 | 0.005 ms | 2.6 ms | yambot |
| HTTP first frame / skip p50 | 0.43 / 1.1 ms | 2.9 / 3.5 ms | yambot |
| RSS / CPU | 126 MB / 1.4% | 302 MB / 2.5% | yambot |
| Scale TTFA p50 at N=1 / 10 / 50 | 0.8 / 3.6 / 16 ms | 3.3 / 12 / 50 ms | yambot |
| Scale N=100 | 100/100 play, 0 fail | ~19/100 TrackStart, ~81% timeout | yambot |
| Live YouTube hear-audio | — | — | can't tell yet |

Injected bench vs the pre-cut hot path: resolve-then-open **−50%**,
play-to-current **−31%**, skip with prefetch **−98%**. This pass held
those wins and cut the remux pool, duplicate play door, and HTTP load
mode.

```
bun run bench:perf          # Java-free; CI-safe
bun run bench:load          # N-session scale (no Java)
bun run bench:vs-lavalink   # opt-in JDK; not required to run the bot
```

Flags and methodology live in `PERF.md`. `bench:vs-lavalink` needs a
JDK; see `scripts/bench-lavalink/README.md`. Never run it from CI.

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
