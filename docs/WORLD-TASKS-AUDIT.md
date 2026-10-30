# Task feature follow-up audit

The first PR qualification did not catch three integration defects. This follow-up reproduced and fixed them; the original passing evidence describes its narrower scenarios, not proof that every boundary was correct.

| Finding | Reproduction before fix | Fix and regression |
| --- | --- | --- |
| Pending steps lost keyboard focus | Native Chromium failed `Keyboard focus survives repair step 0`, receipt `world-browser-VyWJZq` | Capture the focused puzzle control before disabling it; restore it, or the next stage's control, after the pending request. Sliders also disable while pending. Native Tab/Enter, slider Home/ArrowRight and pressure touch input now exercise controls, rather than solving every puzzle by mouse or assigning slider values in JavaScript. |
| Saved diagnostic metadata allowed impossible states | The new independent protocol suite accepted stage zero with a nonzero timer; it also covers zero/far-future deadlines and completed tasks with incomplete progress | Validate timer/stage combinations and completion consistency. Store validation supplies the match clock: deadlines must originate within the match and at most 1,500ms after the checkpoint; a verified diagnostic cannot have a future deadline. Metadata-free legacy tasks remain supported. |
| Root response guards omitted taskStep | Two new tests failed: late rejection after movement surfaced `STALE STEP FAILURE`, and late resolution was not rejected | Apply task ownership/location checks to taskStep as well as task. Check task context before accepting successful responses too. Late replies cannot overwrite feedback, expose obsolete retries or replace a newer state. |

## Requirement trace

| Area audited | Evidence |
| --- | --- |
| Five distinct types, semantic input and ordering | Independent protocol oracle submits manually derived wire pairs, generated tuning/sequence values, pressure direction/amount and repair verbs, without the engine's answer helper. Future and wrong inputs fail at every stage; native browser solves all five. |
| Direct completion and forged client state | Actual HTTP and browser reject unfinished completion. HTTP rejects solved, counter, progress, readyAt, now and actor overrides without advancing a step. Browser sends both ordinary direct finish and solved:true completion attempts for every type. |
| Ownership, location, phases, timing | Engine validates living crew ownership, geometry/visibility and phase before task semantics. Existing lifecycle tests retain exact proximity checks. HTTP verifies spectator denial; the owner must navigate physically. Independent restart checks prove 1,499ms fails and 1,500ms succeeds, using server time. |
| Persistence and request identity | Concurrent same-ID HTTP step requests advance once; changed contents conflict. The actual service closes/reopens its disk store mid-diagnostic, preserving stage/deadline and the earlier too-early denial. Retrying that denied ID stays denied after time advances; a fresh legal ID succeeds. Completion retries after another restart keep completed count one and total 25. |
| Meetings, movement, reconnect, death, terminal phases | Existing world task and engine lifecycle suites exercise interruption, transfer, former-owner denial, movement settlement before deadlines, JSON restoration and phase guards. Native reload restores the original HttpOnly seat. Existing transfer policy is reused; no new ghost/death policy. |
| Privacy and bounded replay | The independent oracle checks every other actor and spectator after each accepted step: no foreign assignment, no player tasks, no live taskStep/action leak; replay is unavailable before ended. HTTP spectator view excludes the task ID. Existing defensive views and 12,000-event replay bound remain. |
| UI ownership and access | Root late success/failure regressions plus existing modal ownership/disposal tests. Native browser checks focus after every semantic step, uses real keyboard and touchscreen input, and checks mobile pressure controls. Optional UI qualification retains stale task closure, typing/selection, joystick, role and council controls. |
| Bots and victory/accounting | Actual world controller reuses semantic helper with only its safe view. Default-rule seeded human/spectator integration matches and both native browser match modes complete. Browser outcomes must follow real engine rules; original total accounting/cooldowns/final-task checks remain. |
| Compatibility and API bounds | No schema/world version change. Legacy board tests remain in the full suite. Optional progress is bounded and validated; original metadata-free saves load unchanged. Steps consume normal persisted action IDs and existing rate limits: at most four accepted step writes plus completion per task, not frame traffic. |

## Additional native UI qualification

The opt-in `tests/world-ui-browser.test.mjs` still assumed browser-only fixed answers and a locally enabled finish button. It now uses generated private challenge values, waits for server-confirmed stages and tests wrong-sequence feedback. Its original movement, joystick, modal invalidation, spectator polling, council focus/literal text, vote, elimination/report, critical repair and deadline-through-council scenarios remain. Linux Chromium receives the same test-only no-sandbox launch flags as the standard runner. The opt-in suite ran, rather than being counted as a default-suite skip.

The initial native touch attempt changed Puppeteer's mobile emulation after opening a modal, causing Chromium to reload and remove that modal. Keeping touch capability enabled throughout and changing only viewport dimensions corrected the driver; no product behavior was weakened to pass it. Receipt `world-browser-YxYQzn` is retained locally as a failed attempt.

All qualification uses local demo AI and controlled/accelerated server time. Physical hardware touch, screen readers, Safari/Firefox and paid providers are not established by these runs. Final exact commands/results and receipts are recorded in WORLD-TASKS-VERIFICATION.md.
