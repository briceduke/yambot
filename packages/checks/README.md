# checks

Scanners that enforce the app constitution: folder rules and the engine/bot seam.

Add conformance or invariant scanners only when `/constitution` invents a real rule. Do not ship empty scanners “for later.”

## Scanners

- `structure` — folder rules: required files exist and forbidden files do not.
- `engine-seam` — R1: `packages/audio-engine` has no Discord dependency or import. R2: `packages/bot` depends on `@yambot/audio-engine`; the engine does not depend on the bot.

`bun run checks` (no args) runs `structure` then `engine-seam`.

## Commands

From the app root:

```bash
bun run checks
bun run checks:structure
```

From this package directory:

```bash
bun install
bun run check
bun run check:structure
bun run typecheck
bun test
```
