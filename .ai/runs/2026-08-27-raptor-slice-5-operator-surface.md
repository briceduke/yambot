# Raptor check — slice 5 (operator surface)

Date: 2026-08-27
Rule: `.ai/rules/raptor-milspec.md`
Target: `.ai/specs/2026-08-27-slice-5-operator-surface.md`
Readonly lean-parts pass before `/plan`. Cuts written back into the spec
in the same turn.

## Verdict

The cut is thin enough to plan. Bot-only config + door gates + six
command modules + two leave clocks. No engine change, no new package, no
store. Overlay is a `Map`. Env is already how `COMMAND_PREFIX` works.

## Rejected (do not build)

- Database or settings JSON file (ask-first; env covers restart)
- Vote skip, skipratio, forceskip command, requester-only remove
- Volume, seek, lyrics, ffmpeg volume transformer
- repeat / playnext / move / skipto / forceremove
- Live channel topic, now-playing editor, Manage Messages delete, DMs
- Owner commands, about, ping, altprefix, full JMusicBot alias table
- New workspace package; production dependency; Discord types in engine
- `invokerUserId` on `CommandContext` with no reader
- Engine Player or engine-side leave policy

## Kept (earns keep)

- `operator-config.ts` (env + overlay + `canUseDjCommands`) — first
  example for guild operator config
- Mention-as-prefix in the existing parser
- Door gates (admin / DJ / settc / setvc) so command modules stay thin
- `LeavePolicy` on the session (idle ms, stay, alone ms) +
  `noteHumanListenerCount`
- Commands: help, settings, setdj, prefix, settc, setvc
- Aliases: setprefix, status (plus existing np, leave)
- Unset DJ role stays open (zero surprise)

## Cuts applied to the spec

1. Vote skip out; skip is DJ-gated only when a role is set.
2. No settings file.
3. CommandContext unchanged.
4. No live topic / delete / DM on settc.
5. Overlay `setdj none` overrides env for that guild until restart.

## Ready for

`/plan`. This run is unattended AIDLC; plan status may be set approved
after write (same as slice 4 autopilot).
