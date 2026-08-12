# checks

Structure scanner that enforces folder rules from the app constitution.

Empty folder rules = healthy greenfield stamp. Add conformance or invariant scanners later only when `/constitution` invents a real rule — do not ship empty scanners “for later.”

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
