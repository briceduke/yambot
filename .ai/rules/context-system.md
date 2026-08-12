---
description: .ai/ is the source of truth; AGENTS.md is a router.
paths:
  - "AGENTS.md"
  - ".ai/**"
  - ".cursor/**"
---

# Context system

- `.ai/` holds rules, skills, lessons, specs, plans, runs, and research. Prefer these over chat memory.
- Root `AGENTS.md` is a router: Always / Ask First / Never, validation, Task Router, Constitution blanks, First examples, Cloud types. Keep it under ~300 lines.
- Put depth in scoped files. Add nested `AGENTS.md` per package or module as the app grows; keep the same section shape.
- Rules live in `.ai/rules/*.md` with `paths:` frontmatter. `factory install-rules` writes `.cursor/rules/*.mdc` and skill command stubs.
- Plan authors, grill, spec, and constitution read `.ai/lessons.md` before non-trivial work. Execute workers use the plan’s **Lessons** tags or short digest only. Append after every correction.
- Freshness: if a change makes `AGENTS.md` stale, fix it in the same branch.
