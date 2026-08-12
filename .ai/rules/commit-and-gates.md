---
description: One door for commits; ordered gates before ship.
paths:
  - "**/*"
---

# Commit and gates

- `/check-and-commit` is the only committing skill.
- Derive flags from the diff. Run ordered gates: migration drift → format/lint → scoped typecheck → scoped tests → conditional build.
- Do not commit while gates are red.
- Use conventional commit messages.
- The loop never merges. Ship a gated PR with proof per criterion.
