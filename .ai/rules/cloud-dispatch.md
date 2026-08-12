---
description: What cloud agents may do and what they must not touch.
paths:
  - "AGENTS.md"
  - ".ai/skills/**"
---

# Cloud dispatch

**Send freely:** small ready work items with a clear prove command; plan fan-out on independent tasks; PR feedback; read-only root-cause; research and spec drafts; docs and lessons upkeep.

**Keep out:** unresolved design questions; ask-first items; schema changes without a safe branch when you have a database; production; whole multi-phase features (fan out only the execute step).

**Hygiene:** pass the work item, precedent paths, prove commands, out-of-scope list, and branch env config. Cap time and WIP; do not invent a parallel process.
