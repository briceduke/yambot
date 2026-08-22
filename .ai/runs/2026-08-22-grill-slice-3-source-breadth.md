# Grill — slice 3 (source breadth, first cut)

Date: 2026-08-22
Target: slice 3 in `.ai/architecture.md`. No spec file exists yet. These
resolutions carry into the slice 3 spec (Design Decisions / pre-checked Open
Questions) when `/spec-writing` runs.

This grill is the first source cut, not “finish every source.”

## Already settled (recorded, not asked)

- Copy the YouTube source module: one file per site under
  `packages/audio-engine/src/sources/` (`youtube.ts` is the first example).
  No plugin registry (architecture red team).
- Bot play path stays the same at the seam: `/play` still calls
  `resolveTrack` / `openTrackAudio`. The engine routes. No per-source logic
  in the bot.
- Playlists, radio, and live streams stay slice 4. DJ / operator config
  stay slice 5.
- R1–R4, two app packages, in-memory session, hybrid slash+prefix, zero
  Java. No new packages (AGENTS ask-first).
- `parseYoutubeQuery` today treats a non-YouTube URL as a YouTube search.
  A second source must intercept its hosts before that fallback.
- Closed format list is still `webm/opus` until a real source cannot yield
  it. Slice 1 already allowed ffmpeg / a new format member at that moment.
- Transition-honesty heuristic: N/A — nothing persisted. Sessions stay
  in memory.

## Decisions

### 1. First cut is SoundCloud only; Spotify is not a source

- **In:** SoundCloud track URLs as the second engine source module. Hear
  one SoundCloud track in the test guild. Then stop this cut.
- **Out (this cut):** Bandcamp, Vimeo, Twitch, local files, HTTP.
  SoundCloud sets/playlists wait for slice 4.
- **Spotify:** not a source. Spotify’s terms block third-party streaming.
  JMusicBot refuses it (wiki: will not be added). Do not add a Spotify
  client. Do not guess a YouTube match from a Spotify URL. A later slice
  may reply that Spotify cannot be played; that is an error path, not a
  source module.
- Architecture slice 3 In/Out and product non-goals updated in the same
  turn.
