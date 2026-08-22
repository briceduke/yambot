# Architecture

High-level design for the **target** product: JMusicBot UX in TypeScript, zero Java, internals rebuilt from first principles — in-repo Discord-free audio engine, operator surface, and self-host packaging. Structure follows that product — not a SaaS stamp, not a port of JMusicBot or lavaplayer internals. Build order is vertical slices, not a layer cake.

## Main pieces (target)

| Piece | Job |
|-------|-----|
| **Bot** | Discord login, commands (music + operator), join/leave voice, guild permissions / DJ checks, pumps engine audio into Discord voice. Owns Discord libraries. |
| **Audio engine** (separate package) | Resolve sources → tracks; per-guild queue and player (play, skip, pause, advance); playlists/streams when those slices land. Yields stream/PCM. **No Discord dependency.** |
| **Guild music session** | Live session per guild: voice target, queue, current track, player state. In memory for core playback; may later hold or load guild operator settings if a slice proves persistence is needed. |
| **Guild operator config** | DJ role, prefixes / command surface choices, and other JMusicBot-class server setup. Exists in the target product; may stay file- or env-backed until a slice forces a store. |
| **Packaging** | How other people run it without Java: documented Bun/Node install first; optional native binary via [Perry](https://www.perryts.com/) after a proved spike. |

**Seam (load-bearing, target and day one):** bot depends on the engine package. The engine does not depend on the bot. In-process library — not a public lavaplayer release, not a Lavalink network protocol.

**Locked:** engine stays Discord-free (stream/PCM only). Bot owns Discord voice send.

**Locked:** parity is UX and capability, not internals. Design each part from first principles for performance and simplicity; never copy JMusicBot / lavaplayer structure, or a bot-framework “best practice,” out of habit — it must earn its keep here.

**Default runtime:** Bun for the workspace (install, tests, scripts, engine work). The bot process runs on Node LTS: Bun's voice path today has timer drift and 8–13x CPU cost (oven-sh/bun#11313, #26415), and voice must speak DAVE. Revisit when those issues close — the swap is one line. Perry is a packaging option, not the runtime that gates hearing audio. (Grill 2026-08-11: `.ai/runs/2026-08-11-grill-slice-1-core-playback.md`.)

**Permanent cuts:** no web dashboard, no hosted multi-tenant SaaS, no JVM, no remote player protocol, no public “TS lavaplayer” product.

## Request / action flow (target)

```text
Discord command (music or operator)
  → Bot: auth / DJ / guild rules as required
  → Bot: ensure guild music session; join voice if needed
  → Bot → engine: resolve (URL, search, playlist, or stream) → track(s)
  → Bot → engine: enqueue / play / skip / pause / …
  → Engine yields audio
  → Bot pumps frames into Discord voice
  → Engine advances queue; bot keeps pumping or leaves per policy
```

Failure modes stay split:

- Source extract fails → engine → bot reports in channel.
- Voice disconnect / encryption / reconnect → bot.
- Operator / DJ denial → bot; engine never sees the request.

## Vertical slices (path to target)

Ordered high-level cuts. Each slice ships an end-to-end user outcome. Do not start a later slice’s horizontal scaffolding before the earlier slice proves its outcome. Slice 1 is the smallest proof; the rest are the road to the product in `.ai/product.md`.

### 1 — Core playback (first ship)

**Outcome:** Join voice; play YouTube (URL or search); queue; skip; zero Java; engine package seam exists.

**In:** Bot + engine + in-memory guild session; Bun/Node; minimal commands for that flow on both doors — slash and prefix (hybrid locked at the 2026-08-11 grill; needs the MessageContent privileged intent).

**Out:** Extra sources, full command set, DJ config, Perry binary, persistence.

### 2 — Core music controls

**Outcome:** Everyday queue control in one session: pause/resume, now playing, remove, shuffle, clear, stop/leave, plus a leave policy. Same zero-transcode seam as slice 1.

**In:** Those commands on both doors, wired to the same engine session API (`TrackQueue` grows remove/shuffle/clear; bot session grows pause/stop/leave). Leave policy: leave now on `stop`; after the queue empties while still in voice, wait 5 minutes of nothing playing then leave (2026-08-19 addendum); do not leave when alone (no membership timer); voice-drop keeps the queue.

**Out:** Volume, seek, lyrics, repeat/playnext/move/skipto, reconnect-with-position, live now-playing message. New source sites; playlists-as-sources; DJ roles. Alone-timer and `stayinchannel` / idle-leave duration config wait for slice 5.

### 3 — Source breadth

**Outcome:** lavaplayer-class sources beyond YouTube, added as thin end-to-end cuts (one source or small group at a time: SoundCloud, Bandcamp, Vimeo, Twitch, local, HTTP, …).

**In (first cut):** SoundCloud track URLs through existing `/play`, plus `scsearch` on both doors (top hit, no picker). `resolveTrack({ query, source?: "soundcloud" })`; omit `source` on `/play`. Format list grows `"hls/aac"`; bot maps that to PATH ffmpeg; YouTube stays `webm/opus`. Engine extractor is `soundcloud.ts` (no operator API key). Engine does not decode. (Grill 2026-08-22: `.ai/runs/2026-08-22-grill-slice-3-source-breadth.md`.)

**Out (first cut):** Bandcamp, Vimeo, Twitch, local, HTTP. Spotify is not a source (cannot stream; no YouTube-guess). SoundCloud sets/playlists wait for slice 4. Do not ship a group of sources before SoundCloud plays in Discord.

### 4 — Playlists and streams

**Outcome:** Playlist URLs expand into queues; radio/streams play and behave sanely with skip/stop.

**In:** Engine resolve returns multiple tracks or a live stream handle; bot queue UX for “added N tracks.”

**Out:** A separate playlist product or web UI.

### 5 — Operator surface and command parity

**Outcome:** DJ-role / guild setup and remaining JMusicBot-class commands. Hybrid slash+prefix is already locked (slice 1 grill); this slice completes prefix parity: guild-level prefix config and mention-as-prefix.

**In:** Bot-side permissions and config; only persist if the slice needs settings to survive restart. Candidate knobs from JMusicBot: DJ role, guild prefix, `stayinchannel`, `alonetimeuntilstop` (alone in channel), and the slice 2 idle-leave duration (nothing playing).

**Out:** SaaS accounts; dashboard.

### 6 — Self-host packaging

**Outcome:** Other people can install and run without Java (docs + Bun/Node path). Optional: Perry native binary after a spike proves Discord + voice under Perry (native or `--enable-js-runtime`).

**In:** Packaging and docs; no change to the bot↔engine seam required for the Bun path.

**Out:** Making Perry the only supported runtime before the spike passes.

## Deliberately not building (ever, unless product changes)

- Web dashboard.
- Multi-tenant hosted SaaS.
- Any Java / JVM sidecar (JMusicBot jar, stock Lavalink, lavaplayer JVM).
- Lavalink-compatible remote protocol or separate player process.
- Publishing the engine as a standalone public lavaplayer product.
- Speculative packages (“voice,” “commands,” “config”) before a slice proves the first layout wrong.

**Not “never” — later slices:** full command/source parity, DJ surface, playlists/streams, public self-host packaging, Perry binary. Those are target work, ordered above.

## Short glossary

| Term | Meaning here |
|------|----------------|
| **Bot** | Discord-facing TypeScript app: commands, operator rules, voice connection. |
| **Audio engine** | In-repo package: sources, queue, play/skip/pause; no Discord types. |
| **Guild music session** | In-memory music state for one Discord guild during playback. |
| **Guild operator config** | Server DJ / setup settings for JMusicBot-class operator behavior. |
| **Track** | One playable item (title, URI, duration if known, playable handle). |
| **UX parity** | Same command surface and behavior class as JMusicBot. Internals are not a port. |
| **Zero Java** | No JVM, no JMusicBot jar, no stock Lavalink / lavaplayer in the runtime. |
| **Packaging** | How a stranger runs the bot without Java (install docs; optional Perry binary). |

## Need check (target-aware)

| Need | Verdict | Reason |
|------|---------|--------|
| **Database** | **Later / maybe** | Core playback needs none (in-memory session). Add a store only when operator settings or playlists must survive restarts and files/env are not enough. |
| **Auth** | **No** | Discord bot token + guild / DJ permissions. No end-user accounts. |
| **Jobs / workers** | **No** | Playback is real-time in the bot process. |
| **Perry** | **Later (slice 6)** | Packaging option after Bun path works; blocked on a Discord+voice spike. |

## Package shape

The workspace glob is `packages/*`. Packages that exist today are `packages/checks` (factory structure checks), `packages/audio-engine` (engine only), and `packages/bot` (Discord bot that depends on the engine). Target stays those two app packages plus checks.

Do not invent more packages until a later slice proves the two-package shape is wrong.

## Red team (speculative parts)

| Temptation | Verdict |
|------------|---------|
| Full lavaplayer API before YouTube plays | Cut. Slice 1 first. |
| Separate Lavalink-like Node server | Cut. In-process package is the target shape. |
| Engine owns Discord voice | Cut (locked). Bot owns voice. |
| Plugin registry for every source before a second source ships | Cut. Plain source modules per slice 3. |
| Spotify as a source, or Spotify URL → YouTube guess | Cut. Spotify ToS blocks streaming; JMusicBot refuses it. An error reply later is fine. |
| ffmpeg in the engine, or ffmpeg-static this slice | Cut. PATH ffmpeg in the bot for `"hls/aac"` only. YouTube stays zero-transcode. |
| DB on day one for “eventual” DJ settings | Cut. Persist when slice 5 (or config need) forces it. |
| Shared platform layer between bot and engine | Cut. One dependency arrow. |
| Perry-only MVP | Cut. Slice 1 on Bun; Perry in slice 6 after spike. |
| Horizontal “finish all sources” before music controls | Cut. Follow slice order; each cut must hear or operate something end to end. |
| Copying JMusicBot / lavaplayer internal design because it exists | Cut (locked). Parity is UX and capability; internals are first-principles. |

---

Next: `/constitution` for app hard rules, patterns to copy, and the proof ladder. Doctrine refresher: `.ai/docs/architecture-overview.md`.
