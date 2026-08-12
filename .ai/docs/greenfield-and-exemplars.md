# Greenfield and first examples

## The problem

Quality leans on “copy the nearest path.” A new app has nothing to copy. Without a fix, each agent invents a pattern and the repo becomes irregular in days.

## The fix

1. Name the kinds of folders or files you will build more than once (patterns to copy). Prefer one thin path that works end to end.
2. Build the first good example of each pattern supervised — prefer a **vertical slice** (entry → logic → data or equivalent).
3. List it in AGENTS.md under **First examples** (pattern → path → what it shows). Prefer “first slice of X” over an abstract layer with no caller.
4. Point plans and rules at that path until neighbors exist.
5. Encode **folder rules** in the structure check the same week (required/forbidden files for matching dirs — only real rules, no empty scanners “for later”).
6. Grow `.ai/lessons.md` from corrections on those first builds.

## Sub-exemplars (when a pattern repeats)

Mint a **sub-exemplar** when a narrower pattern shows up more than once inside a
broader first example. Examples: first slash+defer handler, first private-channel-
under-locked-category mirror, first autocomplete-from-live-name.

Rules:

- Add a **First examples** row the week it ships.
- The second instance must **copy** that path — do not invent a sibling shape.
- Prefer a thin, named path over a vague “same area” note.

## Exception lists

Do not ship an exception list (grandfathering baseline) on day zero. If you ever need one, treat every entry as ask-first with a written reason. Prefer permanently zero.
