# Lessons

Append after every correction. Plan authors, grill, spec, and constitution read
this file before non-trivial work. Execute workers use only the plan’s
**Lessons** tags or ≤40-line digest — not this whole file.

Schema for each entry: **Context → Problem → Rule → Applies to**, plus optional
**Tags:** Prefer `process` / `platform` / `product` when useful (add domain tags
like `bot-discord` as needed). Untagged entries count as general process. After
2+ hits in a tag that imply a missing grill/spec heuristic, update that skill in
the same branch as the next related slice (not someday).

---

## Context

Agents treat “no failing test” as proof that a change is safe.

## Problem

Absence of proof is not disproof. Unchecked work ships as if verified.

## Rule

Use the proof trichotomy: proved, disproved, or unverifiable. A check you did not run counts as failed. Flag unverifiable work for a human.

## Applies to

All features, bugs, PRs, and cloud-agent tasks.

---

## Context

A new repo has no neighbor screens or modules to copy.

## Problem

Agent #1 invents a shape; agent #2 invents another. Week-two brownfield in a two-week-old app.

## Rule

Mint the first instance of each pattern to copy supervised. Record it in AGENTS.md First examples. Copy the first example until real neighbors exist.

## Applies to

First module, route, form, system, command, and any new pattern type.

---

## Context

Checks packages often ship with a grandfathering baseline for legacy debt.

## Problem

In a greenfield app, agents treat the baseline as a place to dump new debt without review.

## Rule

Keep the baseline empty. Adding an entry needs a written reason and Ask First. Target: permanently zero.

## Applies to

`packages/checks` baseline files and any exception list.

---

## Context

Chat and local memory feel faster than opening `.ai/` files.

## Problem

Rules, lessons, and plans drift. Later agents miss corrections that already happened.

## Rule

`.ai/` is the source of truth. Read lessons before non-trivial work. Append lessons after corrections. Fix a stale AGENTS.md in the same branch.

## Applies to

All non-trivial work and any edit that changes process or constitution.

---

## Context

Agents can commit from many skills or ad-hoc shell commands.

## Problem

Gates get skipped. Bad commits land. History loses the one-door audit trail.

## Rule

Commit only through `/check-and-commit`. No other skill commits.

## Applies to

Every commit on every branch.

---

## Context

Greenfield stamps copied the full Carbon line: empty multi-scanners, DB stubs, conductor, automations, and constitution-first day zero.

## Problem

Empty scanners and DB stubs are debt. Agents treat them as real work. Constitution before product and architecture locks technical rails before the product is clear. Soft “optional” parallel notes let one agent eat a whole plan.

## Rule

Stamp a lean MVP: structure check only; no DB until architecture says so; product → architecture → constitution; vertical slices; parallel groups in plans; fan-out execute by default when files do not overlap. Prefer fewer parts (Raptor 3 / milspec).

## Applies to

`factory init`, seed template, day-zero skills, plan/execute, and AGENTS Always.

---

## Context

Init used `--profile saas|b2c|game|bot|minimal` to pre-fill constitution drafts and write `factory.json.profile`.

## Problem

Fake app types at stamp time are debt. They pretend the product was decided before `/product` and `/architecture`. Agents copy the draft instead of inventing structure from the real product.

## Rule

One lean stamp. No profile enum. Product says what this product is in freeform words. Architecture derives structure. Constitution only locks settled design. Name repeated layouts as **patterns to copy** and record the **first example** path in plain English — not “canonical shape” or hollow exemplar jargon.

## Applies to

`factory init`, `factory.json`, AGENTS First examples table, constitution Q4, and day-zero skills.

---

## Context

`/execute` fans out implementers, then the parent spawns a `/check-and-commit`
subagent as each task finishes (even one at a time).

## Problem

Each commit agent pays a full cold start (skill + lessons + plan) and often
re-runs the same package gates the implementer already reported. Concurrent
commits also race on git and clobber the plan Progress checklist.

## Rule

Parallelism stops at implementation. The commit lane is serial and **parent
in-process**: one verify (or trust a thick done report) → `/check-and-commit` in
the parent session → Progress checkbox. Do not spawn a commit agent per task.
Implementers never edit `.ai/plans/`.

## Applies to

`/execute`, `/check-and-commit`, plan Progress lists, Multitask and subagent fan-out.

**Tags:** process, execute

---

## Context

Execute worker briefs say “read `.ai/lessons.md` and the group/main plan” for
every implement and every smoke fix.

## Problem

Cold-start agents re-load the same long context. Design already lives in the
spec; group preambles restate it; lessons restate AGENTS hard rules. Token cost
scales with agent count, not with human gates.

## Rule

Worker brief = Task N card only (≤80 lines). Plan cites the spec; does not
restate design. Plan lists **Lessons** tags or a short digest; workers read that
only. After slice ship, smoke nits use parent `/fix` + one commit — not a
root-cause → fix → commit agent chain.

## Applies to

`/plan`, `/execute`, worker briefs, post-smoke fixes, `.ai/lessons.md` tags.

**Tags:** process, execute, plan

---

## Context

The seed kept `packages/database` stubs and an omit list for conductor / automations / groomer that were not even in the template. Agent-label wake workflow sat unused.

## Problem

Deferred stubs in the factory repo are still debt. “Omit on stamp” pretends the junk is intentional inventory. Agents and humans waste time wondering why it exists.

## Rule

The template only contains what we stamp. No DB stubs. No ghost omit paths. Add a database package (or wake loop) in a real app when architecture proves the need — do not keep a half-built copy “for later” in the seed.

## Applies to

`template/`, `getOmittedTemplatePaths`, factory-owned paths, and graduate-later docs.

---

## Context

Player or platform truth (ACK, naming, permissions, rate limits) was learned after
`/execute` had already shaped handlers and contracts.

## Problem

Work that looked green in CI failed in the real client. Specs and plans missed
the scene + client contract. Unverifiable smoke was skipped until ship.

## Rule

Require Scene + Client contract + unverifiable smoke before execute. Put scene
and client contract into grill/spec. List unverifiable items and the named human
smoke script in the proof plan before execute. Run the readonly judge on ship.
After 2+ tagged hits that imply a missing grill/spec heuristic, promote that
lesson into the skill in the same branch as the next related slice.

## Applies to

Grill, spec-writing, plan Proof sections, execute, test, and ship gates when a
client surface is new or unsettled.

**Tags:** process

---

## Context

An audit of the day-zero docs (`.ai/product.md`, `.ai/architecture.md`) written
during supervised skill sessions.

## Problem

Session dialogue (a question-format block) was left inside `architecture.md`,
and a target package layout was written as already existing ("Workspace already
has..."). Cold-start agents would read both as truth.

## Rule

Question-format blocks are session dialogue; strip them before writing output
docs. When a doc names repo shape, split what exists today from the target
shape.

## Applies to

`/product`, `/architecture`, `/constitution` output docs and audits of them.

**Tags:** process

---

## Context

`.ai/product.md` called the product a “faithful clone” of JMusicBot. The user
meant UX parity only; internals are a first-principles rebuild for performance
and simplicity.

## Problem

Parity words (clone, port, faithful) blur two promises: same UX and same
internal design. Docs written with those words read as a port, and agents copy
the reference app’s architecture out of habit.

## Rule

When a product references an existing app, split UX/behavior parity from
internal-design parity during /product, and write which one is the contract.

## Applies to

/product grill, `.ai/product.md`, `.ai/architecture.md` framing.

**Tags:** product, process

---

## Context

Constitution hard rule R1. The bot and audio engine live in one repo, and
Discord types are one import away.

## Problem

One Discord import inside the engine welds the seam shut. The engine stops
being testable or swappable without Discord, and the package split becomes
decoration.

## Rule

`packages/audio-engine` never imports or depends on a Discord library. The
engine yields stream/PCM only. Enforce with a dependency scan from slice 1.

## Applies to

Engine package, dependency reviews, any spec or plan that touches the
bot↔engine seam.

**Tags:** product, engine-seam

---

## Context

Constitution hard rule R2. Two app packages with one intended direction: bot
depends on engine.

## Problem

A reverse import (engine → bot) creates a cycle and drags Discord into the
engine through the back door.

## Rule

The dependency arrow is bot → engine, never engine → bot. Same dependency scan
as R1.

## Applies to

package.json dependencies, imports across `packages/*`, slice plans.

**Tags:** product, engine-seam

---

## Context

Constitution hard rule R3. The product exists because JMusicBot-class music
normally requires Java (JMusicBot jar, Lavalink, lavaplayer).

## Problem

One "temporary" JVM sidecar or Java-backed dependency quietly kills the
product's reason to exist.

## Rule

Zero Java anywhere: no JVM, no Lavalink, no lavaplayer — not as a dependency,
a sidecar, or a spawned process.

## Applies to

All dependencies, packaging, deployment and self-host docs.

**Tags:** product

---

## Context

Constitution hard rule R4. JMusicBot and lavaplayer are the UX reference, and
their source code is public.

## Problem

Copying their internal design out of habit imports JVM-era architecture and
its complexity, and breaks the first-principles promise.

## Rule

Match JMusicBot UX and capability. Design internals from first principles.
The judge checks for copied structure on ship; risky slices get a raptor pass.

## Applies to

Engine and bot design, specs, plans, judge reviews.

**Tags:** product

---

## Context

Root `bun start` is `bun run --cwd packages/bot start`. Node
`--env-file-if-exists=.env` is resolved against that cwd.

## Problem

Operators put `.env` at the repo root (README). Start looked for
`packages/bot/.env`, skipped it, and exited with a missing-token error.

## Rule

When start changes cwd into a package, the env-file path must point at
repo-root `.env` (`../../.env` from `packages/bot`). Do not add dotenv.

## Applies to

Bot `start` scripts, README run steps, smoke step 0.

**Tags:** process, product

---

## Context

youtubei.js v18 `download()` for audio-only webm/opus.

## Problem

`chooseFormat({ type: "audio", format: "webm", codec: "opus" })` succeeds, so
resolve looks fine. `download()` then fails: it defaults `quality` to `360p`
(drops audio-only formats: "No matching formats found") and the WEB client
lists formats with no stream URLs ("No valid URL to decipher"). Both map to
`Couldn't play that YouTube video.`

## Rule

Pass `quality: "best"` and `client: "VISIONOS"` on InnerTube download (and
matching `getInfo`). Do not add ffmpeg, a second extractor, or a JS evaluator.

## Applies to

`packages/audio-engine` YouTube source module.

**Tags:** platform

---

## Context

Slice 2 grill set empty-queue leave as immediate and parked
`alonetimeuntilstop` in slice 5.

## Problem

Operators still wanted the bot to wait after music stopped so they could
queue another track without a rejoin. Agents treated that as the slice 5
alone-timer (the bot is the only member in the channel).

## Rule

Idle leave (nothing current, empty upcoming, still in voice) is not the
alone-timer (nobody else is in the channel). Idle leave is a session
timeout. Alone-timer stays slice 5.

## Applies to

Leave policy in specs, plans, and the guild music session idle path.

**Tags:** product
