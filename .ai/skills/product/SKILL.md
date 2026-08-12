---
name: product
description: Red-team the product idea with the human expert. Challenge fuzzy goals and bloat, then write .ai/product.md (what this product is, who, problem, what good looks like, MVP vs later, non-goals, open risks). Use when starting a new app or clarifying what to build before architecture. Supervised only.
disable-model-invocation: true
---

# Product

Sharpen what this app is for. The human is the expert. You red-team and challenge fuzzy goals. You do not invent the product.

**Announce at start:** "Using the product skill — clarifying what this product is and what good looks like."

Use this file. Prefer everyday words. Point at `.ai/rules/raptor-milspec.md` when cutting bloat.

## When to use

- Before `/architecture` or `/constitution` on a new app.
- When goals are fuzzy and you need a short written product brief.

## Output

Write `.ai/product.md` with these sections in everyday words:

1. **What this product is** — freeform, in the user’s words (not a dropdown or app-type menu). One or two plain sentences.
2. **Who** — who uses it or benefits.
3. **Problem** — what hurts today without this app.
4. **What "good" looks like** — 1–3 checks you can run or observe (not slogans).
5. **MVP vs later** — the smallest useful ship; what waits.
6. **Non-goals** — what you will not build now (and why).
7. **Open risks** — real unknowns that could change the plan.

Do not pad. Cut stock phrases. Prefer short words. Do not force SaaS / B2C / game / bot labels unless the user said them.

## Role

- Human decides. You challenge.
- Red-team fuzzy goals: ask for a concrete scene, a failed check, or a cut.
- Challenge bloat (Raptor 3 / milspec): fewer parts; no "in case we need it later."
- No forced invent-questions quota. Ask only what is unclear. User decides when done.
- No constitution jargon in this skill or in `product.md`.

## Question format

Every question uses this block:

```text
Why I'm asking: {one plain sentence}
Question: {the question}
My take (optional): {short recommendation}
```

Ask one unclear thing at a time unless the user asks for a batch. Wait for an answer before the next needed question.

Start with **what this product is** if that is still fuzzy. Capture their words; do not map them onto a preset type.

## Done when

- [ ] `.ai/product.md` exists with the seven sections above
- [ ] "What this product is" is freeform and clear
- [ ] "Good" has 1–3 real checks
- [ ] MVP vs later and non-goals are written
- [ ] Open risks are listed or marked none
- [ ] Speculative extras were challenged and cut or deferred

## Next

Hand off to `/architecture` (needs `.ai/product.md`). After architecture, day-zero rules go through `/constitution`.
