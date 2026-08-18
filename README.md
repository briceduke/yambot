# yambot

Discord music bot. Play YouTube audio in a voice channel. No Java.

## Need

- Node 24 or newer (bot process)
- bun (install and test)

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

## Commands

Slash: `/play`, `/skip`, `/queue`.

Prefix (default `!`; override with `COMMAND_PREFIX`): `!play`, `!skip`, `!queue`.

If the process exits and the message mentions Message Content, enable that intent in the portal and restart.

## Missing token

With `DISCORD_TOKEN` unset and without relying on `.env`, the process exits non-zero and prints:

`DISCORD_TOKEN is missing. Set it in the environment and start again.`

PowerShell:

```
Remove-Item Env:DISCORD_TOKEN -ErrorAction SilentlyContinue; node packages/bot/src/main.ts
```
