# Task 3: Add LeavePolicy and alone-timer on the session

**Depends on:** none
**Spec:** `.ai/specs/2026-08-27-slice-5-operator-surface.md` § Leave policy on the session
**Branch:** `cursor/slice-5-operator-surface-8944`
**Lessons:** Idle leave ≠ alone-timer. Copy `scheduleIdleLeave` inject. Do not sleep 5 minutes. No `/check-and-commit`. Do not edit `.ai/plans/`.

**Files:**
- Modify: `packages/bot/src/guild-music-session.ts`
- Modify: `packages/bot/src/guild-music-session.test.ts`

**Steps:**
1. Add `LeavePolicy` `{ idleLeaveMs, stayInChannel, aloneTimeUntilStopMs }` and optional `leavePolicy` + `scheduleAloneLeave` on `CreateSessionInput`. Default: 300_000 / false / 0.
2. `#armIdleLeave` no-ops when stayInChannel; else delay `idleLeaveMs`.
3. `noteHumanListenerCount(count)`: alone ms 0 no-op; count>0 cancel; count 0 and in voice schedule `dropSession`. `leaveNow` and voice-drop cancel both timers.
4. Tests with injected schedules only.

**Verify:**
```bash
bun test packages/bot/src/guild-music-session.test.ts
```
Expected: exit 0, 0 fail. Existing idle-leave tests pass.

**Out of scope:** main.ts VoiceStateUpdate, operator-config import
**Escape hatches:** If `scheduleIdleLeave` inject is missing, STOP.
