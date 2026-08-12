# Architecture overview

Architecture here means high-level design: main pieces, how a request moves, and what you build first. It does not mean "do DDD."

## Default: vertical slices

Prefer one vertical slice that ships over horizontal layers that wait for each other.

A vertical slice is a thin end-to-end cut: enough UI (or CLI), enough logic, and enough storage to prove one user outcome. Folders and modules should serve that cut. When you plan layers or packages, ask: what is the smallest vertical slice that proves this?

## Order of work

1. **Product** (`/product` → `.ai/product.md`) — what this product is, who, problem, what good looks like, MVP vs later, non-goals, risks.
2. **Architecture** (`/architecture` → `.ai/architecture.md`) — main pieces, flow, first slice, deliberate non-builds, glossary, need for DB/auth/jobs. Structure follows the product; no app-type menu.
3. **Constitution** (`/constitution`) — this app’s hard rules (scoping, patterns to copy, proof, frozen surfaces).

Do not skip product. Architecture without a product brief invents goals. Constitution without architecture invents rails.

## What architecture.md must answer

- Main pieces (few names).
- Request / action flow.
- First vertical slice.
- What you are not building yet.
- Short glossary of terms that matter.
- Whether DB, auth, and jobs are needed from need — not from habit.

See `/architecture` for the skill steps. Cut bloat with `.ai/rules/raptor-milspec.md`.

## DDD (optional appendix only)

Domain-driven design tools (bounded contexts, aggregates, repositories, domain events) are optional. Use them only when they help this product. Never treat them as the title doctrine or a required checklist.

If you use any of these ideas, write them in plain English in a short appendix on `.ai/architecture.md`. Explain why each part earns its keep. Prefer fewer parts.
