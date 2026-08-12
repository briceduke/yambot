---
name: grill
description: Interview the user one question at a time to resolve undecided design, spec, or plan choices. Gives Why I'm asking, a recommended take, checks answers against the codebase, and writes each resolution to its home file. Use when the user says "grill me" or when real undecided questions block a spec. Skip when nothing is undecided. Supervised only.
disable-model-invocation: true
---

# grill — close undecided choices with the human

Input: a plan, spec, design idea, or a question list from `/spec-writing`.
Output: every still-undecided choice resolved with the human, one branch at a
time, each resolution written to its home file, and every clash with the
codebase named.

**Skip when nothing is undecided.** If research, architecture, codebase, and the
user’s request already settle the work, say so and hand off to `/spec-writing`
or `/plan`. Do not invent questions to look thorough.

**Supervised only.** This skill interviews a human. Inside an automated loop
(headless or cloud unattended runs) do not invoke it. Those flows use
`/spec-writing` autonomous mode instead.

**Announce at start:** "Using the grill skill — stress-testing {target}."

## Step 1: Identify the target and write destination

| Grilling | Questions come from | Resolutions written to |
|----------|---------------------|------------------------|
| A spec (`.ai/specs/…`) | Open Questions, plus fuzzy Design Decisions | Inline in the spec: `- [x] {Question} — **Answer:** {decision and rationale}`, plus a changelog line when done |
| A spec in design (`/spec-writing` — no file yet) | The question list from `/spec-writing` | Carried into the spec Open Questions (pre-checked, with answers) when the spec is written |
| A plan (`.ai/plans/…`) | Ambiguous or risky tasks, missing proof | The affected task in the plan file |
| An idea in chat (no file) | The whole decision tree | `.ai/runs/{YYYY-MM-DD}-grill-{slug}.md` — create it when the first decision lands |

If there is no artifact and the grill shows the work is spec-worthy (new module,
data-model change, or 3+ files), say so and offer `/spec-writing`. Keep grilling
without a file only if the user declines.

## Step 2: Pick depth from blast radius

| Target involves | Depth |
|-----------------|-------|
| New module, data-model change, or cross-module behavior | **Full grill** — one question per message |
| Anything smaller | **Light grill** — closely related questions may be grouped, max 2–3 per message |

Depth changes grouping only. Never dump the full question list and wait for a
batch answer.

## Fixed heuristics (check when relevant)

Before you close the grill, walk these when they apply. Do not invent questions.
If a heuristic is unsettled, it becomes a grill question. If it is already
settled (user, codebase, research, or prior decision), record it as decided in
the Step 1 destination. Skip any row that does not apply. **Do not ask
constitution questions in grill** (scoping axis, data access door, prove ladder
shape) — those live in `/constitution` and `AGENTS.md`.

| Heuristic | When it applies | What must be settled |
|-----------|-----------------|----------------------|
| **Scene** | User-facing slices only. Skip pure ledger/store internals. | A short scene walk: 1 happy path + 3 failure modes in user words (who does what, what they see, what stays true if the external client fails). Put this in a grill preamble or write it into the target artifact — not a separate skill or file type. |
| **Symmetric ops** | Feature has list↔unlist, assign↔revoke, enable↔disable (or similar pairs). | An explicit symmetry decision: what each side does to markers and state. |
| **Platform / client contract** | Change talks to Discord, web, CLI, or another external API. | ACK timing, defer rules, rename/sanitize, permission inheritance, rate limits, ledger-vs-reply-vs-mirror order, best-effort mirror honesty. |
| **Transition honesty** | Economy or other state-touching slices. | What exists, what maps, what players keep, rollback. |

Still skip inventing questions when nothing is undecided after this check.

## Step 3: Interview

Walk only what is still undecided. Wait for the user's answer before the next
question. For every question use this shape:

```markdown
**Question:** {one clear question}
**Why I'm asking:** {what changes downstream if we get this wrong}
**My take:** {optional recommended answer + one-line rationale + alternatives}
```

Also:

- Order by dependency: settle decisions that other questions hinge on first.
- If the codebase or an existing research file answers it, answer that way
  instead of asking.
- Cross-check every answer against the code. Surface clashes at once, with file
  paths: "you said X, but `{file}` does Y — which is right?"
- Stress-test fuzzy answers with a concrete scenario before accepting them.
- Sharpen fuzzy terms. Prefer terms already used in `AGENTS.md`, rules, and
  first examples.
- Challenge bloat (Raptor): if a proposed layer, package, or abstraction is not
  load-bearing for this feature, push back. Prefer fewer parts.

## Step 4: Write back as each decision lands

Do not batch write-backs to the end. Record each resolution in the Step 1
destination in the same turn it is decided.

Also:

- A decision that sets a lasting convention beyond this feature → update the
  matching `.ai/rules/*.md` file in the same turn (or flag it for the user if
  ask-first applies).
- A new durable lesson → offer a `.ai/lessons.md` entry (Context → Problem →
  Rule → Applies to) after the user confirms.

## Done when

- [ ] Nothing undecided remains for this target (answered by the user, the
      codebase, or an explicit documented "out of scope" decision)
- [ ] Applicable fixed heuristics checked — unsettled ones grilled; settled ones
      recorded as decided (Scene / Symmetric ops / Platform contract /
      Transition honesty when relevant)
- [ ] Every resolution recorded in the Step 1 destination — none live only in chat
- [ ] Lasting conventions reflected in rules or lessons where they belong

If you started with an empty undecided list, you are already done — do not force
a grill. Still run the fixed-heuristics check once when they apply; if all are
settled or N/A, record that and stop.

## Anti-patterns

- Dumping the full question list in one message and accepting batch answers
- Inventing questions when nothing is undecided
- Asking constitution questions in grill
- Closing without a Scene walk on a user-facing slice (or without recording
  settled Scene / N/A)
- Closing a list↔unlist-style pair without an explicit symmetry decision
- Accepting an answer without checking it against the code
- Resolving a question yourself to keep moving
- Recording decisions only in chat
- Adding speculative layers “in case we need them”

Red flags — if you think any of these, STOP:

- "the user probably means X, I'll assume it"
- "we can settle this during implementation"
- "I'll write the answers up at the end"
- "zero open questions means I haven't thought hard enough"
