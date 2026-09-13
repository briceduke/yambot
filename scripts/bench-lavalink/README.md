# Optional Lavalink bake-off (not CI)

Java is allowed **only** here. Product packages, `bun test`, and GitHub
Actions must stay Java-free (constitution R3).

## Need

- JDK 17+ (`java` on PATH)
- ffmpeg on PATH (local sine fixtures)
- Network once, to download pinned Lavalink `4.2.2` and
  `youtube-plugin` `1.18.2` into `/tmp/yambot-lavalink-cache`

## Command

From the repo root:

```
bun run bench:vs-lavalink
bun run bench:vs-lavalink --n 10
```

The script:

1. Runs Java-free `bench:perf` (injected delays) in the same session.
2. Serves a local HTTP mpeg/opus fixture.
3. Starts a throwaway Lavalink on localhost (no Discord).
4. Times yambot vs REST `loadtracks` / WS play `TrackStartEvent` / skip.
5. Attempts live YouTube and SoundCloud once. Bot-wall rows are
   `can't tell yet`.
6. Sweeps yambot headless scale (`webm/opus`, N = 1, 10, 50, 100) and
   Lavalink N players when `TrackStartEvent` works without voice.
7. Prints JSON and a markdown winner table.
8. Tears down Java and temp files.

## Other benches (no Java)

```
bun run bench:perf
bun run bench:load
bun run bench:load --mode webm --sessions 1,10,50,100
bun run bench:load --mode mock --sessions 1,2
```

`bench:load --mode mock` is the CI-safe subset (used by
`packages/bot/src/bench/load.test.ts`). Default `bench:load` is opt-in
and uses real webm/opus fixture decode.
