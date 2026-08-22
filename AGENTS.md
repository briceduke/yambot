<!-- factory:start -->
# AGENTS.md

Router for agents in this app. Keep under ~300 lines. Put depth in `.ai/` files.

## Always

- Use plain English in all text you write: rules, skills, docs, comments, commit messages, and CLI output.
- Follow ASD-STE100 intent and Orwell’s six rules:
  1. Do not use metaphor, simile, or stock phrases.
  2. Prefer a short word to a long word.
  3. Cut each word you can cut.
  4. Use active voice.
  5. Prefer everyday English to jargon. Keep required product names (Cursor, Neon, bun) as proper nouns.
  6. Break a rule only if the result would be unclear or false.
- Keep fixed technical tokens as they are: file paths, command names, package names, env keys, label names.
- Prefer the design with fewer parts that still meets the need (Raptor 3 / milspec). See `.ai/rules/raptor-milspec.md`.
- Every part must earn its keep: if removing it makes change easier, remove it.
- Prefer one vertical slice that ships over layers that wait for each other.
- Prefer an obvious seam (swap or mock the dependency) over a clever abstraction.
- Do not add “in case we need it later.”
- When two options work, pick the one a mechanic can unscrew without a manual.
- Treat `.ai/` as the single source of truth for rules, skills, lessons, specs, plans, runs, and research.
- Before non-trivial work: plan authors, grill, spec, and constitution read `.ai/lessons.md`. Execute workers read only the plan’s **Lessons** tags or ≤40-line digest (not the full file). Append a lesson after every correction.
- Follow the Task Router. Do not invent a side process.
- Copy the nearest first example when one exists for the pattern you are building.
- Use proved / disproved / can’t tell yet. Absence of proof is not disproof.
- Treat a verification you did not run as failed.
- Ship work you can’t prove only as a draft PR flagged for human checks. Do not drop it silently.
- If a change makes this file stale, fix this file in the same branch.
- Commit only through `/check-and-commit`.

## Ask First

- Any frozen surface listed in `BACKWARD_COMPATIBILITY.md` (none until constitution freezes something).
- New production dependencies.
- Schema or data-store changes without a safe branch (only if this app has a database).
- Raising how much work may run without you.
- Adding any persistence store (database or file-backed state). Architecture says in-memory and env/config files until a slice proves the need.
- Adding a workspace package beyond `packages/bot`, `packages/audio-engine`, and `packages/checks`.

## Never

- Grade your own homework. Use the readonly judge subagent for verdicts.
- Point any agent or script at production data or production parents.
- Branch a database from a production ref when you have one. Branch from the seed.
- Commit outside `/check-and-commit`.
- Invent a second layout when a first example already covers the pattern.
- Add an exception list entry without a written reason. Prefer zero exceptions.
- Import a Discord library or type inside `packages/audio-engine` (R1).
- Make the engine depend on the bot; the arrow is bot → engine (R2).
- Add Java in any form: JVM, Lavalink, lavaplayer, or a spawned `java` process (R3).
- Copy JMusicBot or lavaplayer internal design; parity is UX and capability only (R4).
- Build a permanent cut: web dashboard, hosted SaaS, remote player protocol, or a public engine release.

## Validation

Run these to prove health. The per-change-type ladder lives in Constitution §5.

| Check | Command | When |
|-------|---------|------|
| Structure | `bun run checks:structure` | Before commit; CI |
| Engine seam (R1/R2) | `bun run checks` (`engine-seam`) | Before commit; CI |
| Typecheck | `bun run typecheck` | Any TypeScript change |
| Tests | `bun test` (scope to the touched package) | Any logic change |
| Human smoke | Play a track in the test guild; hear audio; skip works | Voice, extraction, or Discord-visible change |

Add conformance or invariant scripts only when constitution invents a real rule — not empty scanners “for later.” The R1/R2 scan is `engine-seam` inside `bun run checks`.

## Task Router

| Task | Guide |
|------|--------|
| New here / how AIDLC works | `.ai/docs/how-aidlc-works.md` |
| Product brief (day zero) | `.ai/skills/product` |
| High-level design | `.ai/skills/architecture` · `.ai/docs/architecture-overview.md` |
| Technical rules (second pass) | `.ai/skills/constitution` · `.ai/docs/constitution-overview.md` |
| New feature | `research` (optional; domain peers or short platform note) → Scene+Client contract in grill/spec when user-facing/client → `grill` (undecided) → `spec-writing` → raptor check (risky slices) → `plan` → `execute` → `test` + human smoke for unverifiable → `judge` (leave-draft) |
| Risky slice raptor | Readonly pass on `.ai/rules/raptor-milspec.md` before plan approval / execute |
| Ship / leave-draft | Readonly `judge` agent (`.cursor/agents/judge.md`); self-review is optional hygiene only |
| Small fix (1–2 files, clear prove command) | Skip full spec/plan; fix → prove → `/check-and-commit` |
| Smoke nit after slice ship | Parent `/fix` → prove → `/check-and-commit` (no root-cause fan-out) |
| Bug (unknown / multi-file) | `.ai/skills/root-cause` → `fix` → `test` → `check-and-commit` |
| Commit | `.ai/skills/check-and-commit` only |
| Context / where truth lives | `.ai/docs/context-system.md` |
| Proof and evidence | `.ai/docs/proof-and-evidence.md` |
| Patterns to copy / first examples | `.ai/docs/greenfield-and-exemplars.md` |
| Stability tiers | `BACKWARD_COMPATIBILITY.md` |

## Constitution

Filled by `/constitution` (2026-08-11) from `.ai/product.md` and `.ai/architecture.md`.

1. **Scoping axis:** Guild. Sessions, queues, and operator config hang off one Discord guild. In memory today; nothing scoped is persisted yet.
2. **Data access door:** None — no database. If a later slice adds persistence, name one door for guild-scoped access first (ask first).
3. **Hard rules (2–4):**
   - **R1 Engine stays Discord-free.** `packages/audio-engine` never imports or depends on a Discord library. It yields stream/PCM only. Check: dependency scan lands with slice 1; judge review until then.
   - **R2 One dependency arrow.** Bot depends on engine; engine never depends on bot. Check: same scan as R1.
   - **R3 Zero Java.** No JVM, no Lavalink, no lavaplayer — not as a dependency, sidecar, or spawned process. Check: dependency review; deny anything that needs a JVM.
   - **R4 Parity is UX, not internals.** Match JMusicBot behavior and capability; never copy JMusicBot or lavaplayer internal design. Check: judge review on ship; raptor pass on risky slices.
4. **Patterns to copy:** Bot command module (one file per command) and engine source module (one module per source site). Both get minted by the slice 1 vertical cut (play path end to end). Structure rules for the two app packages now live in `packages/checks/configs/structure.ts`.
5. **Proof ladder:**
   - Engine logic (resolve, queue, player) → `bun run typecheck` + `bun test packages/audio-engine`.
   - Bot command or session wiring → typecheck + `bun test packages/bot` + human smoke in the test guild for Discord-visible behavior.
   - Voice or source extraction → the above, plus mandatory smoke: play a real YouTube track, hear audio, skip works.
   - Docs / `.ai/` / process → `bun run checks:structure`.
   - Every commit → `/check-and-commit` (runs `bun run checks`).
6. **Frozen surfaces:** None yet. First candidate at slice 6 (self-host ship): operator command surface and config format. See `BACKWARD_COMPATIBILITY.md`.
7. **Who drives work:** You drive. Unattended runs only for test-provable work per Cloud types. Smoke infra: your test guild and a bot token — no database branch, no preview URL.

## First examples

First supervised build of each pattern to copy. Prefer a vertical slice (one thin path end to end). Mint a First examples row the week a new pattern ships (a second instance would otherwise invent).

| Pattern | First example path | What it shows |
|---------|--------------------|---------------|
| Core playback vertical slice | `packages/bot/src/main.ts` | command → guild session → engine resolve → audio in voice |
| Bot command module | `packages/bot/src/commands/play.ts` | one file per command: parse input, call session, reply |
| Engine source module | `packages/audio-engine/src/sources/youtube.ts` | resolve URL or search into a track; no Discord types |

## Cloud types

**Send freely:** ready small work items (bug, copy, usability) with test-shaped proof; test- or typecheck-provable work; plan fan-out (one agent per independent task, own branch); `@cursor` PR-feedback fixes; read-only root-cause briefs; research and spec drafts; docs and lessons upkeep; read-only audits.

**Keep out:** unresolved design questions; ask-first territory; schema changes without a provisioned branch; anything pointed at production; whole multi-phase features (fan out only the execute step).

**Dispatch hygiene:** give a cloud agent exactly what a doer gets: work item + notes, precedent paths, verify commands, out-of-scope list, Lessons tags/digest (not the full lessons file), and branch connection strings via environment config. Task N card only — not the whole plan.
<!-- factory:end -->

## Cursor Cloud specific instructions

Toolchain: bun and Node 24 live in the environment snapshot. If `node` reports v22 or `bun` is not found, run `export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$HOME/.bun/bin:$PATH"`.

You cannot prove YouTube playback or voice from a Cloud Agent:

- YouTube blocks its API from Cloud Agent IPs with an anti-bot wall (`LOGIN_REQUIRED: "Sign in to confirm you're not a bot"`) for every InnerTube client. `resolveTrack` and `openTrackAudio` reach YouTube and parse responses, but no track resolves to playable audio. This is external, not a code defect. Do not treat it as a bug or try to fix it in the engine.
- The human smoke (play in the test guild, hear audio, skip works) needs a real `DISCORD_TOKEN`, a live guild, and a person in a voice channel. The maintainer runs it; a Cloud Agent cannot.

What a Cloud Agent can prove: `bun install`, `bun run typecheck`, `bun test`, `bun run checks`, and bot startup (missing `DISCORD_TOKEN` exits 1 with the documented message; a dummy token boots the process and fails at Discord login with `TokenInvalid`).
