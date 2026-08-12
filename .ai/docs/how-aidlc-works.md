# How AIDLC works (start here)

You scaffolded this app with factory. This file explains the process in plain English.

AIDLC means: agents do the work; written rules, skills, and checks keep the work safe and repeatable.

Do not invent a second process. Follow `AGENTS.md` and the skills it points to.

## Two parts

1. **The factory (already in this repo)** — shared process: folder layout, skills, rules, commit gate, structure check, and agent roles.
2. **This app’s rules** — product brief, high-level design, then a short technical constitution: who owns data (if anyone), which patterns to copy are legal, what proves a change is good.

## Which skill do I start with?

Pick the **first** skill from your situation. Do not run the full feature pipeline for every change.

| Your situation | Start with | Then |
|----------------|------------|------|
| Brand-new app (no `.ai/product.md` yet) | `/product` | `/architecture` → `/constitution` → mint First examples |
| Product philosophy changed (pivot) | `/product` | `/architecture` only if pieces move; do not bury a pivot in `/grill` |
| Architecture pieces unclear or wrong | `/architecture` | `/constitution` if hard rules must change |
| Constitution blanks still empty, or a hard rule must change | `/constitution` | Features only after blanks are real |
| Small fix: 1–2 files, clear prove command | `/fix` (or just edit) | Prove → `/check-and-commit` (skip spec/plan) |
| Smoke nit after a shipped slice (copy, ACK, one flag) | `/fix` | Prove → one `/check-and-commit` (no mini-pipeline) |
| Bug; cause unknown or spans packages | `/root-cause` | `/fix` → `/test` → `/check-and-commit` |
| Bug; cause already clear, ≤2 packages | `/fix` | Prove → `/check-and-commit` |
| New feature; domain doors clear; little UX novelty | `/spec-writing` | Skip `/research` and `/grill` if nothing is undecided → `/plan` → … |
| New feature; real undecided forks | `/grill` (or start `/spec-writing`, which calls grill when needed) | Close questions → finish spec → `/plan` → … |
| New feature; unfamiliar domain peers | `/research` (domain) | `/grill` if needed → `/spec-writing` → … |
| New feature; new Discord/web/CLI/API surface | `/research` (platform note) or go straight to `/spec-writing` and fill **Scene** + **Client / platform contract** | Grill only what is still undecided → `/plan` → … |
| Spec ready; need tasks | `/plan` | Human approves plan (raptor first if risky) → `/execute` |
| Plan approved | `/execute` | `/test` → human smoke for unverifiable → **judge** to leave draft |
| Ready to leave draft / gated PR (≥3 acceptance criteria) | Readonly **judge** agent | Stay draft until smoke closes unverifiable (or list blockers) |
| Any commit | `/check-and-commit` only | — |

**Shortcuts that stay legal**

- Day zero only: `/product` → `/architecture` → `/constitution`. Do not start features until First examples exist (or you are minting the first one).
- Tiny work skips research, grill, spec, and plan.
- Grill is skippable when nothing is undecided. Research is skippable when domain and platform are both settled.
- Self-review is optional hygiene. **Judge** is the ship verdict.

## First week, in order

1. Open this folder in Cursor. Run `bun install`.
2. Read this file, then `FACTORY_NEXT_STEPS.md`.
3. Run `/product`. Write `.ai/product.md` (you are the expert — say what this product is in your words).
4. Run `/architecture`. Write `.ai/architecture.md` (high-level design + first vertical slice from the product).
5. Run `/constitution`. Technical second pass — only what is still missing to enforce.
6. Run `bun run checks:structure`. Keep CI green on an empty app before features.
7. Build the first **vertical-slice examples** supervised (day 1–3). List them in `AGENTS.md` under First examples.

## Feature pipeline (full path)

Use this when the work is a real slice (new module, data change, client surface, or 3+ files). Each step has one job.

```
research? → grill? → spec-writing → raptor? → plan → execute → test + smoke → judge
```

| Step | Skill / gate | When to run | What it produces |
|------|--------------|-------------|------------------|
| 1 | `/research` | Domain peers open **or** client API surface is new. Skip if both settled. | `.ai/research/{slug}.md` — domain survey **or** short platform note (official docs + failure modes) |
| 2 | `/grill` | Something is still undecided. Skip if research, architecture, and the request already settle it. | Decisions written to the home file. For user-facing/client work: **Scene** (happy path + failures) and **Client contract** / symmetry when relevant |
| 3 | `/spec-writing` | New feature / module / data model / 3+ files. | `.ai/specs/…` — single design artifact: behavior, Scene, Client contract, Transition, acceptance, **unverifiable list + named smoke script** |
| 4 | Raptor check | Risky only: new pattern, new mirror helper, schema, cross-package contract. Optional for 1–2 file fixes. | Readonly lean-parts pass on `.ai/rules/raptor-milspec.md`. Fix cuts **before** execute |
| 5 | `/plan` | Spec is `ready-for-plan` (no open questions). | `.ai/plans/…` — tasks, **Parallel groups** with `Mode: fan-out` or `Mode: serial contract`, Lessons tags. **You approve** before execute |
| 6 | `/execute` | Plan status is approved. | Code on the branch. Fan out disjoint domain files; keep shared client contracts **serial** (or one owner). Parent commits via `/check-and-commit` |
| 7 | `/test` | After execute (or after a fix that needs proof). | Automated ladder (CI / unit / fixtures). Does **not** pretend to prove live client permission/ACK truth |
| 8 | Human smoke | Spec listed unverifiable items. | You run the named smoke script. Slice stays **draft** until smoke closes those items (or blockers stay listed) |
| 9 | **judge** | Slice ship / leave-draft / gated PR with ≥3 acceptance criteria. | PASS / FAIL / BLOCKED with citations. Optional `/self-review` is hygiene only — not the verdict |

### What “done before execute” means

- Scene walk written (user-facing), or N/A with reason.
- Client / platform contract written (external client), or N/A with reason.
- Transition plan written when state/economy moves.
- Unverifiable list named with smoke steps.
- No optional client marker without a symmetry decision.
- Risky slices passed a raptor check; plan approved by you.

### What “done before leave draft” means

- Automated ladder proved.
- Human smoke on unverifiable items — or still draft with blockers listed.
- Judge PASS or FAIL with citations (unverifiable ≠ pass).

## Everyday map (short)

| You want to… | Run |
|--------------|-----|
| Product brief | `/product` |
| High-level design | `/architecture` |
| Technical hard rules | `/constitution` |
| Add a feature | See **Feature pipeline** above |
| Small fix | Fix → prove → `/check-and-commit` |
| Smoke nit | `/fix` → prove → `/check-and-commit` |
| Unknown bug | `/root-cause` → `/fix` → `/test` → `/check-and-commit` |
| Commit | `/check-and-commit` only |
| Ship / leave draft | Readonly **judge** (`.cursor/agents/judge.md`) |

## Human gates that matter

- Grill only when something is still undecided. Put **scene + client contract** into grill/spec when the work is user-facing or talks to an external client.
- Approve the plan before `/execute`. Proof plan lists unverifiable items + named human smoke script.
- Plans list **Parallel groups**; execute fans out when files do not overlap. Groups that share a client contract stay **serial**. Parent runs verify + `/check-and-commit` + Progress in-process (serial). Do not spawn a commit agent per task.
- Worker briefs are Task N cards only — not the whole plan, not all of lessons.
- Never grade your own homework — use the readonly **judge** on ship. Run **raptor** when the slice is risky. Do not use self-review as the ship gate.
- Automated ladder owns CI; human smoke owns unverifiable. Slice stays draft until smoke (or blockers listed).
- Never commit outside `/check-and-commit`.
- After smoke clusters: tag lessons (`process` / `platform` / `product`). After 2+ hits that imply a missing grill/spec check, update that skill in the same branch as the next related slice.

## What you got

| Path | Role |
|------|------|
| `AGENTS.md` | Short router. Always / ask first / Never, Task Router, constitution blanks, First examples. |
| `.ai/rules/` | Source rules (incl. Raptor 3 / milspec). `bun install` copies them into `.cursor/rules`. |
| `.ai/skills/` | Step-by-step workflows. Slash commands come from these. |
| `.ai/lessons.md` | Corrections after mistakes. Plan authors and constitution work read the full file. Execute workers use the plan’s **Lessons** tags or short digest only. Append after each correction. |
| `.ai/docs/` | Longer guides (this file and the others linked below). |
| `.cursor/agents/` | Roles: judge (readonly verdicts), root-causer. |
| `packages/checks/` | Structure scanner only. Empty folder rules = pass. |
| `BACKWARD_COMPATIBILITY.md` | What may change and what must not. Empty until something is frozen. |
| `FACTORY_NEXT_STEPS.md` | Ordered setup list written by `factory init`. |

Not in the seed: database package, automations, conductor, empty multi-scanners. Add them later only if the app earns them.

Truth for process lives under `.ai/`. Depth stays out of `AGENTS.md`.

## Words you will see

| Plain term | Meaning |
|------------|---------|
| Shared process / factory | The stamped skills, rules, and checks common to every app. |
| Product brief | What this product is, who, problem, what good looks like. From `/product`. |
| Architecture | High-level design + first vertical slice. From `/architecture`. Structure follows the product. |
| Constitution | Technical hard rules for this app. From `/constitution`. |
| Scene | Short player journey: 1 happy path + failure modes in user words. Lives in grill/spec. |
| Client / platform contract | ACK, defer, naming, permissions, mirror order, symmetry for an external client. |
| Pattern to copy | A kind of folder or file you will build more than once. |
| First example | First supervised file or folder for a pattern (prefer a vertical slice). Later work copies it. |
| Serial contract group | Plan group that shares an invisible client contract — one owner, not eight parallel inventors. |
| Folder rules | Required/forbidden files for matching dirs in the structure check. |
| Proved / disproved / can’t tell yet | Proof outcomes. If you did not run a check, treat it as failed. |
| Unverifiable | CI cannot prove it; a named human smoke script must. |
| Judge | Readonly agent that scores acceptance + smoke status before leave-draft. |
| Data access door | One code door for scoped data access (only if you need a DB). |
| Ask first | Surfaces you must not change without an explicit human decision. |
| Vertical slice | One thin path that works end to end (entry → logic → data or equivalent). |

## Rules agents must follow

- Plain English in text they write.
- Fewer parts (Raptor 3 / milspec). See `.ai/rules/raptor-milspec.md`.
- Copy the nearest first example when one exists.
- Ask before touching ask-first / frozen surfaces.
- Never point agents or scripts at production data or production database parents.
- Ship work you can’t prove only as a draft PR flagged for a human.

## Where to read next

| Topic | File |
|-------|------|
| Setup checklist | `FACTORY_NEXT_STEPS.md` |
| Architecture overview | `.ai/docs/architecture-overview.md` |
| Constitution questions | `.ai/docs/constitution-overview.md` |
| Where files live | `.ai/docs/context-system.md` |
| Patterns to copy | `.ai/docs/greenfield-and-exemplars.md` |
| Proof | `.ai/docs/proof-and-evidence.md` |
| Slash command details | `.ai/skills/*/SKILL.md` |
| Task Router (compact) | `AGENTS.md` |
