# checks

Scanners that enforce the app constitution: folder rules and the engine/bot seam.

Empty folder rules = healthy greenfield stamp. Add conformance or invariant scanners later only when `/constitution` invents a real rule — do not ship empty scanners “for later.”

## Scanners

- `structure` — folder rules: required files exist and forbidden files do not.
- `engine-seam` — R1: `packages/audio-engine` has no Discord dependency or import. R2: `packages/bot` depends on `@yambot/audio-engine`; the engine does not depend on the bot.

`bun run checks` (no args) runs `structure` then `engine-seam`.

## Commands

From this package directory:

```bash
bun install
bun run check
bun run check:structure
bun run typecheck
bun test
```

From the app root after stamp: `bun run checks` or `bun run checks:structure`.
