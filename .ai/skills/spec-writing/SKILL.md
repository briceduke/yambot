---
name: spec-writing
description: Design a feature and write its spec at .ai/specs/{YYYY-MM-DD}-{slug}.md. Grill only when real questions are still undecided. Prefer vertical-slice design. Use for new features, modules, data-model changes, or work that touches 3+ files. Skip for small 1–2 file fixes with a clear prove command. Do not start implementation from this skill.
disable-model-invocation: true
---

# spec-writing — design, then write the spec

Input: a feature request (and optional research file). Output: a complete spec at
`.ai/specs/{YYYY-MM-DD}-{slug}.md`. Grill only when something is still undecided;
otherwise write the spec from settled choices.

The spec is the single design artifact. Do not write separate design docs in
other locations.

**Announce at start:** "Using the spec-writing skill — designing {feature}."

## When to write a spec

| Situation | Action |
|-----------|--------|
| New module or pattern to copy | Write spec |
| Feature touching 3+ files | Write spec |
| Data model change | Write spec |
| Cross-module behavior change | Write spec |
| Small change: 1–2 files with a clear prove command | Skip — use `/fix` (or `/root-cause` + `/fix`). No full spec/plan tax. |

## Step 1: Scope the request

If the request is unclear, ask at most 3–4 focused questions. Every user-facing
question uses:

```markdown
**Question:** {one clear question}
**Why I'm asking:** {what this answer changes}
**My take:** {optional}
```

Cover: **what** (the capability), **why** (the problem), **where** (which
surfaces), **who** (the users). If the request is already clear, skip to Step 2.

## Step 2: Read app context

Before designing anything, read:

1. Existing specs under `.ai/specs/` (and any `implemented/` folder) — do not
   duplicate a living spec.
2. `.ai/lessons.md` — known pitfalls.
3. Root `AGENTS.md` — Always / ask first / Never, constitution, first examples.
4. Matching `.ai/rules/` files from the Task Router.
5. Any package or module `AGENTS.md` the work will touch.
6. `.ai/product.md` and `.ai/architecture.md` when present.

## Step 3: Research when the domain is open

Invoke `/research {feature}` when requirements are vague, domain logic is
non-trivial, or the user asks for a survey. Findings land in
`.ai/research/{slug}.md`; cite that file from the spec. Skip research only when
the user already gave clear, detailed requirements for a familiar surface.

When the domain is settled but the **client surface is new** (Discord, web, CLI,
or another external API), write or point to a short **platform research note**
(official docs + failure modes) under `.ai/research/`. Domain research stays
optional for peer features on a known surface.

## Step 4: Separate settled choices from undecided questions

Prefer **vertical-slice** design: one user-visible path (UI → logic → data) as
the unit of design, not layer-first “build the whole data model then routes then
UI.”

For each significant decision (data model, status steps, workflow, integration):

1. State the question.
2. Cite research or codebase precedent when you have it.
3. List 2–3 options with one-line trade-offs.
4. **Decide it yourself if research + codebase settle it** — record the choice
   for the Design Decisions table.
5. **If you cannot settle it, it is undecided.** Do not pick a placeholder. Do
   not write "TBD".

Run new or changed surfaces through this checklist. Settled rows go in Design
Decisions; unsettled ones join the question list:

| # | Heuristic | Question to answer |
|---|-----------|--------------------|
| 1 | Scoping | Does every new store of data use the app's scoping axis and data access door from `AGENTS.md` (if any)? |
| 2 | Hard rules | Which load-bearing rules does this touch, and how is each still true? |
| 3 | Pattern to copy | Which vertical-slice first example (or planned path) does this copy? |
| 4 | Proof | What proves behavior for this change type (from the prove commands in `AGENTS.md`)? |
| 5 | Frozen surfaces | Does this touch FROZEN / STABLE / ADDITIVE-ONLY items in `BACKWARD_COMPATIBILITY.md` (if any)? |
| 6 | Ask first | Does any choice fall in ask-first territory in `AGENTS.md`? |
| 7 | Out of scope | What nearby work is explicitly not in this feature? |
| 8 | Scene (user-facing) | Short scene walk: 1 happy path + 3 failure modes in user words? (N/A for pure ledger/store internals — say why.) |
| 9 | Symmetric ops | If list↔unlist / assign↔revoke / enable↔disable pairs exist, what does each side do to markers and state? |
| 10 | Client / platform contract | External client API: ACK timing, defer, naming/sanitize, permissions, rate limits, ledger-vs-reply-vs-mirror order, mirror honesty? |
| 11 | Transition plan | Economy/state-touching: what exists, what maps, what players keep, rollback? |
| 12 | Unverifiable risks | What can CI not prove, and which named human smoke steps cover those gaps? |

**Raptor:** refuse speculative layers, packages, or “flexibility” abstractions
that this feature does not need. Fewer parts win.

If the undecided list is empty after this pass → skip `/grill` and go to Step 6.
Do not invent questions to look thorough.

## Step 5: Grill — only if something is undecided

> HARD STOP: do not write the spec file while any listed question is unresolved.

Invoke `/grill` on the undecided list only. The spec does not exist yet, so grill
runs in its in-design mode; resolutions carry into the Open Questions section
when the spec is written in Step 6.

Interview one question at a time (group max 2–3 only for small, single-surface
designs). For each question:

```markdown
**Why I'm asking:** {what changes downstream}
**Question:** {one clear question}
**My take:** {recommended answer + one-line rationale + alternatives}
```

Cross-check the user's answer against the codebase before accepting it. Record:
`- [x] {Question} — **Answer:** {decision and rationale}`.

The user may batch ("accept all recommendations") — that is their call, not
yours to assume. Never resolve a still-undecided question yourself to unblock
work.

### Autonomous mode (automated loops only)

When this skill runs in an automated loop with no human available, do not invoke
`/grill` and do not wait. Instead:

- Resolve each question in this order: (1) codebase precedent, (2) research
  consensus, (3) your recommended answer. Record:
  `- [x] {Question} — **Autonomous:** {answer + rationale}`.
- List all autonomous resolutions in the spec changelog and in the PR "Assumed
  decisions" section.
- **Ask-first territory is never resolved autonomously.** Those questions →
  BLOCKED with the question stated clearly.

## Step 6: Write the spec

Only when nothing is undecided (or after grill closed them). Create
`.ai/specs/{YYYY-MM-DD}-{slug}.md` (today's date, kebab-case slug) and fill every
section, with Step-5 resolutions baked into the design.

Minimum sections:

```markdown
# {Feature}

**Status:** draft | ready-for-plan
**Research:** .ai/research/{slug}.md (or N/A — why)
  (client-touching + new surface: also cite platform research note if used)

## Problem
## Goals
## Non-goals
## Design decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
## Behavior
## Scene (or N/A — why)
1 happy path + 3 failure modes in user words (who does what, what they see,
what stays true if the external client fails).
## Client / platform contract (or N/A — why)
ACK timing, defer rules, rename/sanitize, permission inheritance, rate limits,
ledger-vs-reply-vs-mirror order, best-effort mirror honesty, and any
list↔unlist (or similar) symmetry decision.
## Transition plan (or N/A — why)
What exists, what maps, what players keep, rollback — for economy/state-touching
slices.
## Acceptance criteria
- [ ] {testable criterion}
## Open questions
- [x] {Question} — **Answer:** {decision and rationale}
  (or: none — all settled before write)
## Proof plan
{how we will prove each acceptance criterion}
Unverifiable (CI cannot prove): {list}
Human smoke script: {named steps — not vague "manual smoke"}
## Changelog
- {date}: created
```

Rules:

- Acceptance criteria must be testable. Prefer concrete user or API outcomes.
- No `{placeholders}` left in the file; mark unused sections `N/A` with a reason.
- Open Questions is the audit trail of decisions (including “none”), not a to-do
  list of work left for implementers.
- Design for the vertical slice the user will feel, not for a speculative layer
  cake.
- Status stays `draft | ready-for-plan`. Client-touching slices that still need
  human smoke stay **draft until smoke** at ship time — the Proof plan owns that
  gate; do not invent a third status value.

## Step 7: New questions found while writing

If writing surfaces new undecided questions:

- Add them as unchecked items with why they matter.
- Take them back through `/grill` before calling the spec final.
- Do not say "we can figure these out during implementation."

## Step 8: Finalize

After every question is resolved: add a changelog entry, set status to
`ready-for-plan`. The spec is ready for `/plan`.

## Done when

- [ ] Spec exists at `.ai/specs/{YYYY-MM-DD}-{slug}.md` with real content
- [ ] Research is linked, or N/A with a reason (platform note linked when the
      client surface is new)
- [ ] Every applicable heuristic has a Design Decisions row — no TBDs
- [ ] Scene, Client / platform contract, and Transition plan filled or marked
      N/A with why
- [ ] Proof plan lists unverifiable items and a named human smoke script when
      anything is unverifiable
- [ ] Any questions that were undecided were closed before final (grill or
      codebase). Empty undecided list is fine.
- [ ] Questions found while writing were also resolved before final

## Anti-patterns

- Writing the spec first and grilling afterward when questions were known
- Forcing a grill when nothing is undecided
- Writing a design doc outside `.ai/specs/`
- Marking questions resolved without human input (except autonomous mode rules)
- "TBD" in Design Decisions
- Vague acceptance criteria ("works as expected")
- Speculative layers “for later flexibility”
- Marking a client surface “optional” without a symmetry decision for paired ops
- Treating Open Questions alone as a design audit when Scene or Client /
  platform contract were skipped though they applied
- Proof plan that says only “manual smoke” with no named steps

Red flags — if you think any of these, STOP:

- "I'll draft the spec now and confirm questions after"
- "we can settle this during implementation"
- "the user probably wants X, I'll assume it"
- "I'll add a shared abstraction in case we need it"
