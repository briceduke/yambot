# Proof and evidence

## Three outcomes

Every claim ends in one of three states:

1. **Proved** — you ran the check and it passed.
2. **Disproved** — you ran the check and it failed.
3. **Can’t tell yet** — you cannot run a sufficient check yet.

Absence of proof is not disproof. Do not treat silence as safety.

## Who owns what

| Owner | Owns |
|-------|------|
| **Automated ladder** (`/test`, CI) | Unit, fixture, typecheck, and other checks the app can run in CI |
| **Human smoke** | Unverifiable claims (external client permission, ACK, live naming, and similar). Named script; human runs it |

Do not pretend CI or `/test` covers external client truth. When the Proof plan
lists unverifiable items, report them **UNVERIFIABLE** and name the human smoke
script — do not mark the slice green.

## Evidence before assertions

- Name the command or check you ran.
- Quote or summarize the result.
- If you did not run it, say so. Count it as failed until you do.

## Single proof ownership

Under `/execute`, one owner per check: either the implementer’s done report
(command + exit code + expected output) or the parent’s Verify / commit gates.
Do not pay three cold starts for the same package tests (implementer, commit
agent, final ship ritual) when one thick report already proved the claim.

## Pre-execute: unverifiable + smoke

Before `/execute`, the spec or plan **Proof** section must list:

1. What automated checks will prove.
2. What is **unverifiable** in CI (if any).
3. The **named human smoke script** and steps for those items.

## Work you can’t prove yet

The slice stays a **draft** until human smoke passes, or until the PR lists the
blockers in plain English. Ship as a draft PR. Flag it for a human. Do not drop
it to keep the board green.
