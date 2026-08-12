---
name: architecture
description: Turn .ai/product.md into a high-level design in .ai/architecture.md. Cover main pieces, request flow, first vertical slice, deliberate non-builds, glossary, and whether DB/auth/jobs are needed. Structure follows the product. Red-team speculative parts. Use after /product and before /constitution. Supervised only.
disable-model-invocation: true
---

# Architecture

Write a high-level design from the product brief. You are consultant and red teamer. Prefer vertical slices over a layer cake. Do not force DDD. Do not pick an app type from a menu — structure emerges from what the product is.

**Announce at start:** "Using the architecture skill — designing from the product brief."

Read `.ai/docs/architecture-overview.md` first. Apply `.ai/rules/raptor-milspec.md` when a part looks speculative.

## Hard gate

**Input:** `.ai/product.md` must exist.

If it is missing, STOP. Tell the user to run `/product` first. Do not invent a product brief here.

## Output

Write `.ai/architecture.md`. Always cover:

1. **Main pieces** — the few parts that matter (names in plain English), derived from “what this product is.”
2. **Request / action flow** — how a user action moves through the system.
3. **First vertical slice** — the smallest end-to-end cut that proves the idea.
4. **Deliberately not building yet** — parts deferred on purpose.
5. **Short glossary** — only terms that matter for this app.
6. **Need check** — whether DB, auth, and jobs are needed *from need*, not from rails or a preset type. Say yes, no, or later for each, with one plain reason.

This is high-level design. It is not "do DDD." Bounded contexts, aggregates, repositories, domain events, and microservices are optional tools. Use them only when they help. Never require them. If useful, put them in a short optional appendix in plain English — not as the title doctrine.

Folder layout, modules, and whether you need a database follow the product — not a SaaS / game / bot stamp.

## Tactical rule

When talking folders, modules, or layers, ask:

```text
Why I'm asking: I need the smallest proof, not a full stack of layers.
Question: What is the smallest vertical slice that proves this?
My take (optional): {short recommendation}
```

Prefer slice-shaped cuts over horizontal layers that wait on each other.

## Role

- Consultant: propose a lean shape that meets `.ai/product.md`.
- Red teamer: Raptor-challenge every speculative part. If removing it makes change easier, cut it or defer it.
- No "in case we need it later."
- Prefer an obvious seam (swap or mock) over a clever abstraction.
- When two options work, pick the one a mechanic can unscrew without a manual.

## Question format

Every question uses this block:

```text
Why I'm asking: {one plain sentence}
Question: {the question}
My take (optional): {short recommendation}
```

Ask only what is unclear. No forced invent-questions quota. User decides when done.

## Done when

- [ ] `.ai/architecture.md` exists with all six required sections
- [ ] Structure and pieces clearly follow “what this product is”
- [ ] First vertical slice is named and small enough to ship
- [ ] Speculative parts were challenged; deferred list is honest
- [ ] DB / auth / jobs each have a need-based yes / no / later
- [ ] No DDD ceremony required unless the human chose it and it earns its keep

## Next

Day-zero app rules: `/constitution`. Point the human at `.ai/docs/architecture-overview.md` if they need the short doctrine again.
