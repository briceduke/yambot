# Discord and YouTube platform note (slice 1: core playback)

Platform note, not domain research. The domain (music bot UX) is settled by
JMusicBot parity. This note collects the official platform contract and known
failure modes for the two external surfaces slice 1 touches: Discord
(interactions, gateway, voice) and YouTube (extraction).

Facts marked **(grill)** were checked on 2026-08-11 during the slice 1 grill:
`.ai/runs/2026-08-11-grill-slice-1-core-playback.md`. Facts marked **(docs)**
come from official Discord documentation re-checked 2026-08-11.

## Summary

Slash commands must ACK within 3 seconds; defer then edit for slow work.
Guild-scoped command registration applies instantly; global takes up to an
hour, so a self-host bot should register per guild. The prefix door needs the
privileged MessageContent intent or the gateway closes with 4014. Voice
requires DAVE E2EE since 2026-03-01; `@discordjs/voice` is the only maintained
JS path and needs Node >= 22.12. YouTube serves opus-in-webm audio, which
Discord voice can play with no ffmpeg and no opus encoder. `youtubei.js` is the
only maintained extraction library; extraction breaks periodically and that is
an accepted product risk.

## Answers to platform questions

1. **ACK timing for slash commands?** — 3 seconds to respond or defer. Defer,
   then edit the reply when the track resolves. The interaction token stays
   valid 15 minutes, far longer than any resolve. **(docs)**
2. **How do commands get registered?** — Bulk `PUT` per scope. Guild commands
   apply instantly; global commands take up to 1 hour to propagate. Official
   docs recommend guild scope when you need commands to appear at once.
   Same-name registration overwrites, so a startup `PUT` is idempotent.
   Rate limit: 200 command creates per day per guild — irrelevant unless the
   bot restarts hundreds of times a day. **(docs)**
3. **What intents does slice 1 need?** — `Guilds`, `GuildVoiceStates` (see who
   is in which voice channel), `GuildMessages` + `MessageContent` (prefix
   door). MessageContent is privileged: the operator flips it in the developer
   portal. Requesting it without the portal flag closes the gateway with code
   4014 (disallowed intents); a bad token closes with 4004. **(docs)**
4. **What invite scopes and permissions?** — Scopes `bot` +
   `applications.commands` (without the second, slash commands never appear).
   Permissions: View Channel, Send Messages, Connect, Speak. **(docs)**
5. **What does voice require in 2026?** — DAVE E2EE is mandatory since
   2026-03-01; Discord rejects voice connections from clients without it.
   `@discordjs/voice` supports DAVE via `@snazzah/davey` (bundled; wraps
   Discord's C++ libdave) and requires Node >= 22.12. Transport encryption
   uses Node's built-in `aes-256-gcm`; no sodium package. WebM/Opus input
   demuxes natively — no ffmpeg, no opus encoder, for opus sources. **(grill)**
6. **Can the bot process run on Bun?** — Not today. Streaming voice on Bun
   shows 8–13x the CPU of Node (oven-sh/bun#26415) and timer drift in the
   audio loop (oven-sh/bun#11313). Bot process runs Node LTS; Bun stays
   package manager, test runner, and script runner. Revisit when both issues
   close. **(grill)**
7. **What extracts YouTube audio without Java?** — `youtubei.js` (InnerTube
   client): actively maintained (v17.x, June 2026, ~198k weekly downloads),
   pure TypeScript, no external binary, no API key. `ytdl-core` is
   unmaintained since 2023; `@distube/ytdl-core` declares itself unmaintained
   and points to `youtubei.js`. **(grill)**
8. **What audio format does YouTube serve?** — Audio-only opus-in-webm
   formats exist for normal videos. That gives a zero-transcode path from
   extraction to Discord voice.

## Failure modes the scene and client contract must cover

- **Slow resolve past 3 s** → interaction dies unless deferred. Always defer
  the slash door.
- **MessageContent intent not flipped** → gateway close 4014 at startup. Fail
  loudly with a plain-English fix; document the portal step in setup docs.
- **Missing `applications.commands` on invite** → slash commands never appear
  in the guild.
- **Missing Connect/Speak on the voice channel** → join fails; reply with the
  error instead of joining silently.
- **Message length cap 2000 chars** → queue listings must cap displayed
  entries.
- **Untrusted text in replies** → track titles can contain `@everyone` or
  mention syntax; suppress mentions in every bot reply.
- **Voice websocket/UDP drop** → playback stops. Slice 1 policy: in-memory
  queue survives untouched; next `/play` rejoins. No custom reconnect logic.
- **YouTube resolve failures** → age-restricted, region-locked, private, or
  deleted videos; datacenter IPs can hit bot checks; InnerTube changes break
  extraction until `youtubei.js` updates (accepted risk in `.ai/product.md`).
  The engine must surface a clean resolve error and the queue must never
  stall on a dead track.

## What CI can prove vs human smoke

CI can prove: queue logic, command parsing/dispatch, seam types, format
mapping, error mapping, dependency rules (R1/R2), piping a fixture stream.
Only human smoke can prove: audible audio in a real voice channel, the DAVE
handshake against real Discord, portal intent state, live YouTube extraction,
join/move behavior against the real gateway.

## Sources

- Discord docs — application commands (registration, scopes, limits):
  https://discord.com/developers/docs/interactions/application-commands
- Discord docs — receiving and responding (3 s ACK, defer, token lifetime):
  https://discord.com/developers/docs/interactions/receiving-and-responding
- Discord docs — gateway (privileged intents):
  https://discord.com/developers/docs/events/gateway
- Discord docs — close codes (4004, 4014):
  https://discord.com/developers/docs/topics/opcodes-and-status-codes
- Global command propagation discussion:
  https://github.com/discord/discord-api-docs/issues/2372
- DAVE protocol: https://daveprotocol.com
- `@discordjs/voice`:
  https://github.com/discordjs/discord.js/tree/main/packages/voice
- Bun voice issues: https://github.com/oven-sh/bun/issues/26415 ·
  https://github.com/oven-sh/bun/issues/11313
- `youtubei.js`: https://github.com/LuanRT/YouTube.js
- Grill session (2026-08-11 platform checks):
  `.ai/runs/2026-08-11-grill-slice-1-core-playback.md`
