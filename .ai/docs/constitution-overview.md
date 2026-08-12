# Constitution overview

The shared process (factory) is the same for every app. Product and architecture come first. `/constitution` is the **technical second pass**.

## Order

1. `/product` → `.ai/product.md`
2. `/architecture` → `.ai/architecture.md`
3. `/constitution` → hard rules in `AGENTS.md` and check configs

If product or architecture is missing, stop and run those skills first.

## What constitution decides

Ask only what is still missing to enforce. Skip answers already settled in product or architecture. Every question includes **Why I'm asking**.

1. **Scoping axis** — What identity does everything hang off? (or none)
2. **Data access door** — One code door for scoped access, only if you need persisted data
3. **Hard rules (2–4)** — Which few rules, if broken, corrupt everything?
4. **Patterns to copy** — What kinds of folders or files will we repeat? Where is the first good example of each? Prefer one thin path that works end to end. Encode folder rules in the structure check when ready.
5. **Proof ladder** — Cheapest sufficient proof per change type
6. **Frozen surfaces** — What must not change? (Write `BACKWARD_COMPATIBILITY.md` only if something is frozen.)
7. **Who drives work** — Default: you drive. Raise later only with evidence.

Do not pre-fill answers from a fake app type. Product and architecture invent what the app is; constitution only locks settled design into hard rules, prove commands, and folder rules.

## Output

Writes or updates: Constitution section in `AGENTS.md`, Validation prove commands, `packages/checks/configs/structure.ts` for real folder rules, lessons for hard rules, and frozen-surface lists when needed.

Does **not**: invent empty conformance/invariants/clobbers configs, stamp a DB if architecture said no, or copy another product’s ERP rules.
