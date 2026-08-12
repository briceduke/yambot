# Backward compatibility

Stability tiers for this app. Empty on day zero. Fill during `/constitution` only when something must not change. Everything FROZEN is automatically ask first (see AGENTS.md).

Nothing frozen yet (constitution, 2026-08-11): no API has shipped and nobody depends on this code. First candidate: when slice 6 ships self-host packaging, the operator command surface and config format go STABLE or ADDITIVE-ONLY for other people's installs.

| Tier | Meaning | Change policy |
|------|---------|----------------|
| FROZEN | Must not change after publish | Do not edit. Ask first. Prefer a new name or version over a break. |
| STABLE | May change with care | Require a migration path, tests, and a clear reason in the PR. |
| ADDITIVE-ONLY | May grow; must not shrink | You may add fields, commands, or variants. Do not remove or rename. |

## FROZEN

None yet.

| Surface | Notes |
|---------|-------|
| | |

## STABLE

None yet.

| Surface | Notes |
|---------|-------|
| | |

## ADDITIVE-ONLY

None yet.

| Surface | Notes |
|---------|-------|
| | |
