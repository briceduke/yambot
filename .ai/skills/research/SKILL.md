---
name: research
description: Survey how strong products and industry practice handle a feature, and write findings to .ai/research/{slug}.md. Use when designing a new feature, comparing approaches, or answering how others solve a domain problem. Do not use for UI styling (copy a first example instead) or for bugs (use /root-cause).
---

# research — survey practice before design

Input: a feature or domain question. Output: `.ai/research/{feature-slug}.md` with
shared patterns and a clear recommendation for this app. This skill only
researches and writes the findings file. It does not design, plan, or write code.

**Do not make research a default tax.** Skip when both domain and platform are
already settled (existing research, first examples, or constitution cover the
questions). Run research only when something is still unknown.

**Announce at start:** "Using the research skill — surveying how others handle
{feature}."

## Fork: Domain research vs Platform note

Choose one or both before searching. State which you are doing.

| Kind | When | What to gather |
|------|------|----------------|
| **Domain research** | Peers, workflows, entities, or industry practice are unclear | How strong products handle the feature; shared patterns; terms |
| **Platform note** | The client surface is new or unsettled | Official API docs + known failure modes: ACK, naming, permissions, rate limits |

Skip domain research when peers and workflows are settled. Skip the platform note
when the client contract is already written and proved in a first example. If both
are settled, skip `/research` and go to grill/spec (or plan).

## Step 1: Name the domain (and platform, if any)

State the domain in one line (for example: billing, invites, save format,
command UX, replay tests). List 2–4 leaders or well-known products in that
domain. Prefer primary docs and clear product references over blog fluff.

If this is a **Platform note**, also name the client or SDK surface (for example:
Discord slash commands, Stripe webhooks) and the failure modes you must cover.

If the app already has related research under `.ai/research/`, read those files
first and avoid repeating settled facts.

## Step 2: Write the research questions

Before searching, list 3–6 concrete questions the design will need answered.

For **Domain research**, prefer data-model and workflow questions over UI:

- What entities and status steps do strong products use?
- What edge cases do they handle that we might miss?
- Is there a standard term we should adopt instead of inventing one?
- What proof do they rely on (tests, audits, user checks)?

For a **Platform note**, prefer contract and failure-mode questions:

- What does the official API require for ACK, naming, and permissions?
- What rate limits or quotas apply?
- What known failure modes must the scene + client contract call out?
- What can automated tests prove vs what needs human smoke?

## Step 3: Search

For each product or source, run searches shaped like:

- `{Product} {feature} documentation`
- `{Product} {feature} how it works`
- `{feature} best practices {domain}`

Rules:

- Be specific: `Stripe subscription trial end behavior`, not `Stripe billing`.
- Fan searches out to subagents (one product or one question per subagent) to
  keep the main context clean. Each subagent returns findings and source URLs
  only.
- Focus on data models, workflows, and terms — not screenshots or UI copy.
- For a **Platform note**, prefer official API docs and documented failure modes
  over secondary blogs.
- Prefer bun and Cursor stack docs when the question is about tooling we already
  chose (Neon, Drizzle, Better Auth, Vercel, Inngest).

## Step 4: Write the findings file

Save to `.ai/research/{feature-slug}.md` (kebab-case slug). Use exactly this
structure:

```markdown
# {Feature} Research

## Summary
One short paragraph: what was researched and the key findings.

## Sources surveyed
- **{Product or doc}** — {why it matters}
- **{Product or doc}** — {why it matters}

## Shared patterns
### 1. {Pattern name}
- **{Source}**: {how they do it}
- **{Source}**: {how they do it}
- **Why it is common**: {one line}

## Answers to research questions
1. {Question} — {answer, naming the source}

## Source-specific notes
### {Source}
{useful options, terms, or unique approaches}

## Recommended approach for this app
1. {Recommendation with rationale, naming the pattern it follows}

## Sources
- {URL}
```

## Done when

- [ ] Every research question from Step 2 has an answer, or is marked unanswered
      (carry unanswered items into `/grill` / the spec Open Questions)
- [ ] The findings file exists at `.ai/research/{slug}.md` with all sections filled
- [ ] Every claim has a source URL in the Sources section

## Next step

Hand the findings file to `/grill` (open questions) then `/spec-writing`, or cite
it from an existing spec. Do not start implementation from research alone.
