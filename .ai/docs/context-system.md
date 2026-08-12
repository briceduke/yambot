# Context system

`.ai/` is the single source of truth for agent process.

| Path | Role |
|------|------|
| `.ai/rules/` | Markdown rules with `paths:` frontmatter → Cursor `.mdc` via `factory install-rules` |
| `.ai/skills/` | Versioned workflow skills (product, architecture, constitution, feature pipeline, bug, commit) |
| `.ai/lessons.md` | Corrections in fixed schema (optional **Tags:**). Plan authors read full file; execute workers use plan **Lessons** tags/digest |
| `.ai/specs/`, `.ai/plans/`, `.ai/runs/`, `.ai/research/` | Work artifacts as the app grows |
| `AGENTS.md` | Router only (Always / Ask First / Never / Validation / Task Router / Constitution / First examples / Cloud types) |

Depth lives in scoped files, not in the root router. Keep `AGENTS.md` under ~300 lines.
