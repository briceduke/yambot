---
name: constitution
description: Technical second-pass interview after product and architecture. Fills scoping, data access door, prove commands, patterns to copy, frozen surfaces, and who drives work. Writes AGENTS constitution, validation commands, and related files. Use after /product and /architecture when constitution blanks remain.
disable-model-invocation: true
---

# Constitution

Technical second pass for this app. Product and architecture come first; this skill fills only what checks and agents still need to enforce.

Use this file and `.ai/docs/constitution-overview.md`. If the human is new to AIDLC, point them at `.ai/docs/how-aidlc-works.md`.

## When to use

- After `/product` and `/architecture` (day zero technical pass).
- When constitution blanks in `AGENTS.md` are still empty.

## Prerequisites

Before asking anything:

1. Read `.ai/product.md`.
2. Read `.ai/architecture.md`.

If either file is missing → **STOP**. Tell the user to run `/product` then `/architecture` first. Do not invent product or architecture answers here.

## Hard rules

- Ask **one question at a time**. Wait for an answer (or “use your recommendation”) before the next.
- Every question uses this shape:

```markdown
**Why I'm asking:** {what this answer lets checks or agents enforce}
**Question:** {one clear question}
**My take:** {optional short recommendation with 2–4 options}
```

- Skip any question already settled in `.ai/architecture.md` or `.ai/product.md`. Record the settled answer; do not re-ask.
- Ask only what is still missing to enforce. Do not pad the interview.
- Do not copy Carbon ERP rules (`companyId` on every table, RLS module shapes, multi-tenant ERP invariants) unless this app truly chose that scoping axis and you rename them to this app’s terms.
- No empty check configs “for later.” Write only configs that have real rules today.
- No database stubs if architecture said no database.
- Prefer **vertical slices** as patterns to copy (UI → logic → data as one first example), not layer-only examples.
- Do not invent answers from a fake app-type menu. Use the product and architecture the human already wrote.
- Use bun in any commands you suggest. Do not use pnpm.
- After answers are complete, write the files listed under Outputs. Do not invent a parallel docs tree.
- Commit only through `/check-and-commit` if the user wants the result committed.

## The seven questions (skip when settled)

Ask remaining questions in this order. Keep each prompt short.

### 1. Scoping axis (if any)

What single identity does scoped data hang off — if anything?

Recommend from `.ai/product.md` and `.ai/architecture.md`. Common outcomes include tenant/org, user/owner, guild/server, world/save, or none — but only if the design needs them. Do not force a type from a preset list.

**Skip** when architecture already fixed scoping (or none).

### 2. Data access door (if any)

What single code door should all scoped access go through, so unscoped access is hard to express by accident?

Name the door from architecture (for example `tenantDb(orgId)`, `ownerDb(userId)`, a per-guild store, or a sim context). If architecture said no scoped store / no database → **skip**. Do not create stubs for a door you do not need.

### 3. Load-bearing rules (2–4)

Which few rules, if broken, corrupt everything?

Keep the list tiny. Prefer: structure check + commit gate; add 1–2 AST checks only when needed. For each hard rule you keep, seed a `.ai/lessons.md` entry later.

Pull candidates from architecture hard constraints (tenancy, ownership, privacy, determinism, frozen command names, and so on). Do not paste a profile example list.

**Skip** items already stated as hard constraints in architecture.

### 4. Patterns to copy

What kinds of folders or files will we repeat? Where is the first good example of each?

Prefer one thin path that works end to end (UI → logic → data) over separate “models only” / “routes only” / “UI only” examples unless a shared foundation truly stands alone.

For each pattern: required files, forbidden files (**folder rules**), and which path will be the **first example** (may be “to be built next”). Encode folder rules into `packages/checks/configs/structure.ts`.

### 5. Prove commands

Per change type, what is the cheapest sufficient proof?

Derive from this product’s surfaces (web UI, sim, bot, library/CLI, and so on). Fill the App proof ladder row in `AGENTS.md` Validation with **concrete commands**. No “TBD later.”

### 6. Frozen surfaces (if any)

What must not change from day one?

If something is frozen, write tiers into `BACKWARD_COMPATIBILITY.md`: FROZEN / STABLE / ADDITIVE-ONLY. Everything FROZEN is automatically ask first in `AGENTS.md`.

If nothing is frozen yet → **skip** creating a fake frozen list. Do not invent stability theater.

### 7. Who drives work

Who drives day-to-day work?

**Default:** you drive. Raise later only with evidence.

Ask only if still open: which work kinds may ever run unattended, and what infra the prove gate needs (database branch, preview URL, test guild, none). Default: you drive. Raise later only with evidence.

## Outputs (after remaining answers)

Write or update these. Keep edits tight and plain English.

1. **`AGENTS.md` — Constitution section** — Fill settled technical answers. Update Ask First / Never / Validation for this app.
2. **`AGENTS.md` — Validation prove commands** — Concrete commands where known.
3. **`BACKWARD_COMPATIBILITY.md`** — Only if something is actually frozen. Otherwise leave alone or note “nothing frozen yet.”
4. **Data access door files** — Only if architecture requires a scoped store. Replace real names and shapes. Do **not** add database stubs when architecture said no DB.
5. **Check configs that have real content today**
   - `packages/checks/configs/structure.ts` — folder rules (required)
   - Do **not** require empty `conformance.ts` / `invariants.ts` / `clobbers` configs “for later.” Add those files only when you have real rules to put in them.
6. **`.ai/lessons.md`** — One seed entry per load-bearing hard rule (Context → Problem → Rule → Applies to).
7. **First examples table** — Prefer vertical-slice rows. Leave paths blank or “planned” until supervised builds land; do not fake first examples.

## Session shape

```markdown
# Constitution session (technical second pass)

## Prerequisites
- product.md: present / missing
- architecture.md: present / missing

## Progress
- [ ] 1 Scoping (or skipped — settled)
- [ ] 2 Data access door (or skipped — none / settled)
- [ ] 3 Load-bearing rules
- [ ] 4 Patterns to copy (prefer vertical slices)
- [ ] 5 Prove commands
- [ ] 6 Frozen surfaces (or skipped — none)
- [ ] 7 Who drives work (default: you drive)
- [ ] Files written

## Current question
<only one, with Why I'm asking>

## Recorded answers
1. ...
```

## Stop conditions

- Missing `.ai/product.md` or `.ai/architecture.md` → STOP; send user there.
- User pauses mid-interview → save recorded answers in session notes; do not write partial constitution into `AGENTS.md` unless they ask to checkpoint.
- User asks to skip a still-needed question → mark it “undecided” and keep autonomy at you-drive until filled.
- Never invent ERP tenancy for a non-tenant app.
- Never ship empty check configs or DB stubs “for later.”
