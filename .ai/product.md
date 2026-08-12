# Product

## What this product is

A TypeScript Discord music bot with the same UX as [JMusicBot](https://github.com/jagrosh/MusicBot): same class of commands, same class of audio sources, operator surface (DJ roles and guild setup), and easy self-host packaging — with a hard rule: **no Java runs anywhere**. It is not a port: under that UX, the internals are rebuilt from first principles for performance and simplicity, with no duty to copy how JMusicBot, lavaplayer, or other bots are built. The audio engine (lavaplayer-class capability, first-principles design) lives in its own in-repo package, separate from the bot. The bot owns Discord and voice; the engine stays Discord-free.

## Who

You run it on your own Discord servers first. The finished product is also something other people can download and run like JMusicBot — without a JVM.

## Problem

You want JMusicBot-class music in Discord, but you will not run Java (no JMusicBot jar, no Lavalink, no lavaplayer JVM). Existing easy bots lean on that stack. Without a non-Java engine, a Discord bot on top, and a simple way to ship the binary or install, that experience stays locked behind Java.

## What "good" looks like

1. Zero Java end to end: bot + engine with no JVM sidecar — and someone else can install and run it the same way (packaging is part of the product).
2. JMusicBot-class music commands work in a real guild (play, queue, skip, and the rest of the music/operator set people expect from that bot).
3. lavaplayer-class sources work for the sources JMusicBot users rely on (YouTube first; then the rest of that class as they earn their place).

## MVP vs later

**First useful ship (smallest path that proves the idea)**

- Join voice, play YouTube (URL or search), queue, skip.
- Engine in a separate package; bot depends on it; engine has no Discord types.
- Runs on Bun (or Node).

**Toward target (each is a vertical cut, not a horizontal layer; `.ai/architecture.md` owns the slice order)**

- Core music command set beyond play/skip (pause, now playing, remove, shuffle, clear, leave policy, and peers).
- More sources (SoundCloud, Bandcamp, Vimeo, Twitch, local, HTTP, playlists, radio/streams, formats as needed).
- DJ-role / guild operator surface and remaining JMusicBot command parity (including deliberate slash vs prefix UX choices).
- Easy self-host packaging for other people (Bun/Node install path; optional [Perry](https://www.perryts.com/) native binary when that spike proves Discord voice works).

## Non-goals

- Web dashboard.
- Multi-tenant hosted SaaS.
- Any Java or JVM sidecar (including stock Lavalink / lavaplayer).
- Porting JMusicBot’s or lavaplayer’s internal design. UX parity is the contract; their architecture is not.
- Shipping a standalone “TS lavaplayer for other bots” product to the world (in-repo package seam is fine; public engine product is not).
- A remote Lavalink-compatible network protocol (in-process package is the shape).

## Open risks

- YouTube (and other) extraction without lavaplayer is fragile and breaks often; keeping playback working is ongoing work, not a one-time port.
- Full lavaplayer-class source coverage is large; source work must not block hearing audio on the first ship.
- Discord voice in TypeScript (encryption, speaking, reconnects) fails in ways separate from source loading.
- Same-UX goal may conflict with Discord’s current slash-command / intent model vs JMusicBot’s older command style — exact UX parity needs deliberate choices.
- Perry packaging depends on Discord client + voice (often Node native addons) actually running under Perry; that is unproved until a spike.
- First-principles internals re-solve problems lavaplayer already solved (format edge cases, buffering, stream quirks) — accepted cost of not porting.
