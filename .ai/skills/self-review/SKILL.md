---
name: self-review
description: Optional thin hygiene checklist for the parent agent before leave-draft. Docs freshness, scope creep, and missing-work hunt only. Not an acceptance verdict — invoke the readonly judge agent for that.
disable-model-invocation: true
---

# self-review — optional hygiene (not a verdict)

Short checklist for the parent agent after execute / before leave-draft. Do **not**
treat this as acceptance. For slice ship or a gated PR with ≥3 acceptance
criteria, invoke the readonly **judge** agent.

**Announce at start:** "Using the self-review skill — optional hygiene only;
judge owns the verdict."

## Checklist

1. **Docs freshness**
   - Sibling `AGENTS.md` lines still true for paths the diff touches?
   - New pattern → First examples row due this week?
   - Lesson or spec status the change should have updated?

2. **Out-of-scope creep**
   - Diff vs plan / binding out-of-scope list. Accidental extras are Must fix
     notes for the human — not a pass/fail verdict from this skill.

3. **Missing work hunt**
   - Plan Progress incomplete? Verify commands skipped? Escape hatch ignored?

4. **Deep cut (one line)**
   - For a Raptor / milspec deep pass, use `.ai/rules/raptor-milspec.md` or the
     judge — do not expand this skill into a thermo-nuclear audit.

## Output

List findings under:

- **Must fix** (hygiene only)
- **Risks / questions**
- **Docs freshness**

Present to the user. Do not auto-fix. Do not emit PASS / FAIL — that is the
judge’s job.
