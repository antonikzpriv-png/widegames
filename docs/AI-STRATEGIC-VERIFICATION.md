# Strategic AI verification and follow-up audit

Cloud workspace `/workspace/widegames`, Node v24.19.0. The original audited baseline is
`90bb6e8`; later main integrations and their superseding results are recorded below. These are author checks, not an
independent review. No live/paid provider requests or deployment occurred.

The first implementation passed its original tests, but the deeper audit found
coverage gaps and concrete defects. This receipt supersedes the initial counts.

## Findings corrected

| Finding | Correction and regression |
| --- | --- |
| Straight-line goal distance treated valid wall detours as failures | Measure actual displacement with stall samples at least one second apart. All 30 station-to-station routes traverse the real engine without false failure or route resets. |
| Body sightings disappearing/reappearing could buy another plan | Remember up to 48 stable evidence identities. Unaffected routes continue after unrelated deaths; current target life/visibility and fresh lifecycle generations are still checked. |
| Council prompts duplicated heard claims and included opaque plan bookkeeping | Deduplicate current meeting claims, send compact intention/progress fields, and shed old optional context under the existing byte cap. Keep the full bounded public roster and offered alternatives. |
| Seventh-seat witness evidence was still restricted to canonical six IDs | Validate evidence against the bounded public roster and use its public names in accusations. A seventh-seat witness drives a legal ballot. |
| Investigation often meant the actor's current room | Offer fixed timestamped historical sightings of currently unseen players. Execution never updates that point from hidden state. |
| A task intention covered only one job | Offer forward/reverse itineraries of up to three tasks; persist the route index and continue across task completion and JSON restart without a model call. |
| Late provider errors could add a fallback notice after switching matches | Check the originating view fence in the error path as well as the success/send paths. A delayed 503 cannot mutate a subsequent match's context. |
| Original complete matches forced fallback after six calls | Retain those fallback controls and add four complete matches that must remain strategic through the outcome. |

The full suite also caught a legacy body-reporting scope error introduced during
this follow-up. It was corrected; the legacy tests remain unchanged and pass.

## Requirement coverage

| Requirement | Evidence |
| --- | --- |
| Explicit strategic configuration; demo/hybrid defaults | Config validation and presentation-label tests in `ai-strategic.test.mjs` / `ai-strategic-audit.test.mjs`; existing hybrid no-roaming-call tests remain active. |
| Meaningful structured choice and persistent plans | Non-default model task choice; alternative multi-task itinerary orders; actual route execution and restoration without another reservation. |
| Following, avoidance, historical investigation, alibis and positioning | Current visibility and separation checks; real positional engine routes; historical-point immutability; bounded plan expiry. |
| Isolation, sabotage timing, reporting and repair | Role/cooldown/witness/capability checks; model-selected sabotage, two distinct crew repairs and a report all accepted by the real engine. |
| Fake work never grants task progress | Real saboteur model selection produces only navigate/wait throughout a station visit; task completion stays zero. |
| Separate bounded character memory | Observations, claims, suspicions, evidence identities, one intention and progress; overflow and malformed-restoration tests. Claims never become firsthand witness evidence. |
| Privacy and public profiles | Hidden-property getters and a raw-state decoy throw if accessed; safe prompt allowlists; seventh-seat profile test; 24-seat prompt-bound test; HTTP context redaction. |
| Bounded replanning | Valid routes issue one navigation; unchanged failed plans do not buy repeated replans; new critical evidence invalidates assumptions; stationary failure and expiry controls. |
| Authoritative engine | Every action in the eight complete strategic match fixtures is accepted by the actual engine; no internal intention envelope reaches it. |
| Reservation order, retries, uncertainty and concurrency | Existing durable order/daily-budget suites plus explicit strategic retry authorization, parallel match cap, authorization denial, cancellation during authorization and retained charges. |
| Stale phase/life/room/match results | Real delayed HTTP provider results across meeting, death, pause and closure; generation transition controls; stale success/error tests. No current rematch endpoint is invented. |
| Restart recovery | JSON restore mid-route and mid-itinerary; actual server/disk restart after an uncertain request progresses without replaying or refunding it. |
| Existing capabilities/integrations | Engine/task/ability contracts unchanged; only implemented navigate/task/repair/report/eliminate/sabotage/wait actions are used. No vent, door, terminal or ghost system is assumed. |

The baseline engine/lobby still creates six seats. AI scheduling, prompt handling,
profiles and witness memory accept bounded public rosters up to 24 when supplied;
the roster tests do not claim a new 24-player lobby or engine implementation.

## Complete credential-free matches

`tests/ai-strategic-matches.test.mjs` runs eight matches through the actual engine.
Models are deterministic mock tool responses and see only serialized permitted
prompts plus public geometry. Every fixture preserves the default three tasks per
crew, world geometry, speed, ranges and cooldowns; only council deadlines are
shortened to 6/4 seconds. No state edits manufacture a winner. Each fixture restores
engine state and private context mid-route.

Four fixtures retain a six-call cap and require labeled demo fallback. Their
outcomes remain all-AI tasks at 23/37 seconds, idle-human ejection at 93 seconds
and tasks at 37 seconds (seeds 1/7).

Four additional fixtures prefer task itineraries and must finish in live strategic
mode. Their configured call/cost caps remain 48 / $0.50. The all-AI fixtures use
the unchanged production default 120,000-token cap. Idle-human sustained fixtures
use the already-supported explicit 250,000-token configuration; no server default
or maximum was raised. The default budget can intentionally fall back earlier.

| Mode | Seed | Engine outcome/time | Requests | Reserved tokens |
| --- | --- | --- | --- | --- |
| All AI, sustained | 1 | Crew tasks, 25 seconds | 10 | 54,379 |
| All AI, sustained | 7 | Crew tasks, 23 seconds | 10 | 53,646 |
| Idle human, sustained | 1 | Crew tasks, 45 seconds | 31 | 168,191 |
| Idle human, sustained | 7 | Crew tasks, 41 seconds | 33 | 176,723 |

Separate real-engine scenarios exercise strategic sabotage, distinct repairs and
reporting. Match receipts include navigation, waiting, tasks, elimination, report,
speech and votes. Counters are conservative reserved ceilings, not invoices.

## Final commands and limits

- `npm ci`: passed with the existing lockfile.
- `npm run check`: 96 JavaScript modules passed.
- `npm test`: 468 tests, 462 passed, zero failed, six existing opt-in skips.
- `CHROME_PATH=/usr/bin/chromium npm run test:browser`: passed both complete world
  modes, equipment, movement, reload/identity, privacy, replay, desktop/mobile
  layouts, runtime-source stability and console checks.
- `git diff --check`: passed.

Final browser report and screenshots are under
`_artifacts/world-browser-n3IZnl/`. Browser fixtures use demo mode; strategic
selection and lifecycle behavior use mocked providers through the real adapter.
Live model quality, latency and billing are deliberately untested. The initial
sandbox audit subprocess failures (`spawnSync git EPERM`) were rerun successfully
with the required process permissions.

## Pre-merge revalidation, 2026-10-30

Re-fetched main (still `90bb6e8`) and audited the PR's source, safe-view boundaries,
reservation order and lifecycle fences. Fresh `npm ci`, `npm run check` and
`npm test` passed: 96 modules; 462 passed, zero failed, six existing opt-in skips.
The additional `LW_WORLD_BROWSER=1` UI browser suite passed without skips, with
evidence in `_artifacts/world-ui-n3Qhf0/`.

GitHub run `40962864493` had passed the offline suite but failed the browser driver:
its fixed +19-second jump after reload overshot the 10-second voting window when
reload took eight real seconds. The driver now advances only to the engine's
current deadline and waits for actual app connection readiness after reload.
No engine timing, game rules, AI budgets or assertions were weakened.

A negative control retaining the old fixed jump, with a seven-second post-reload
delay, reproduced `Timed out: voting phase` in
`_artifacts/world-browser-bKiGLG/`. The deadline-aware delayed fixture passed in
`_artifacts/world-browser-IUM73i/`; the final normal browser driver also passed
both complete match modes in `_artifacts/world-browser-XZfnyw/`.
GitHub checks on the updated head must pass before the authorized merge proceeds.

## Integration with main's authoritative tasks (80dcc60)

Main advanced to `80dcc60` (PR #3) before merge, so the earlier 90bb6e8-based
qualification above is historical. Integrated the complete task feature and its
browser work, resolving the shared browser-driver edit while retaining the
current-deadline fix. Engine, task validation, storage and task UI implementations
match that main revision; the strategic feature does not replace their rules.

Both local and strategic world plans now call `worldTaskAction`, which reuses the
merged taskProgress/taskInput helpers on the permitted owner's task view. It emits
one semantic taskStep, waits for diagnostic readyAt, and only proposes task
completion after the final confirmed stage. Fake work still never calls this
helper. A new real-engine regression restores a running repair diagnostic,
waits for its authoritative timer, completes all four steps, and proves the model
was called only once for the entire task.

The full integrated qualification passed:

- `npm run check`: 99 modules.
- `npm test`: 483 tests; 477 passed, zero failed, six existing opt-in skips.
- Standard browser driver: five generated equipment types, native keyboard/touch,
  both complete match modes and replay passed in `_artifacts/world-browser-VFKERF/`.
- Opt-in world UI browser suite passed without skips in
  `_artifacts/world-ui-3CGuWA/`.
- Engine, budget, store, shared contracts and task UI have no strategic changes
  relative to 80dcc60. The task AI helper is shared rather than duplicated.

Interactive steps change the earlier fixture durations and token requirements.
Sustained all-AI seed 1 retains the default 120,000-token cap; the other sustained
fixtures explicitly use the already-supported 250,000-token allowance. Production
budget defaults, maxima, accounting order and uncertain reservations are unchanged.
All four sustained fixtures remain in strategic mode until the real outcome:

| Mode | Seed | Outcome/time | Requests | Reserved tokens |
| --- | --- | --- | --- | --- |
| All AI | 1 | Crew ejection, 35 seconds | 22 | 118,501 |
| All AI | 7 | Crew tasks, 61 seconds | 33 | 182,107 |
| Idle human | 1 | Crew tasks, 69 seconds | 37 | 200,575 |
| Idle human | 7 | Crew tasks, 65 seconds | 36 | 191,320 |

The six-call fallback fixtures also still finish, now at 51/89 seconds for all-AI
(tasks/ejection), and 111/115 seconds for idle-human (saboteur parity). Every
proposed taskStep and completion is accepted by the actual integrated engine.

## Integration with ghost/ability main (fa7aaa0)

Main advanced again to `fa7aaa0` before merge. Preserved its optional feature
configuration, lobby/UI, ghost scheduler, task retention, private fallen channel,
abilities, engine, storage validation and expanded CI workflow. Conflict resolution
retains strategic status/configuration and deadline-aware browser progression.

Ghost tasks/chat always use the feature's local policy, even when strategic mode
is configured. The living-model gate remains living-only, while transport permits
fresh authorized ghost proposals. A living-to-ghost transition changes the room
generation and discards the originating model result. Optional local Ward/Echo
behavior is retained before planning; these ability actions do not buy a model
request. Real engine controls prove ghost task completion and fallen chat remain
local across restart, and Ward/Echo actions remain legal with zero model calls.
A real HTTP ghost-death case retains the earlier reservation while rejecting the
late living result. No engine, store, shared-feature or task rules were replaced.

Final combined local validation:

- `npm run check`: 105 modules.
- `npm test`: 514 tests; 508 passed, zero failed, six existing opt-in skips.
- Standard five-task browser suite passed: `_artifacts/world-browser-bprNYT/`.
- Optional ghost/abilities browser suite passed:
  `_artifacts/ghost-abilities-browser-9S1xPc/`.
- Opt-in world UI browser suite passed without skips:
  `_artifacts/world-ui-6KIzOY/`.
- `git diff --check` passed and all merge conflicts are resolved.

Earlier counts and receipts remain historical evidence. These combined results
supersede them for the merge. No paid/live model request or deployment occurred.
