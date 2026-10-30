# Latest spectator engine integration

Candidate base88b9646f1f577c1e12b2f2a10172aa51d5f9e38e composes quality18c38d9 with main aa1f58c7699acb53ecba96c977a089c54c41c340. This worker changes only assigned engine copy/runtime and local world AI paths, owned tests and this receipt. It does not qualify the full candidate or provide native/browser approval.

The incoming copyState implementation is retained byte-for-byte. Legacy schemas1/2 use its independent recursive copy and idle pending preflight. Schemas3/4/5 retain structuredClone and the full chronological advance path: lights/doors/transit/device timers, knowledge and snapshot capture are not covered by the legacy idle predicate. applyAction/applyInput reuse only a newly allocated tick result, otherwise copy; no mutable history is intentionally shared with the input.

Original evidence: _artifacts/spectator-engine-incoming-red.txt has5/6 engine controls passing, with idle proxy history failing DataCloneError before adaptation. _artifacts/spectator-ai-baseline-red.txt has both map-local auxiliary/job controls failing: actual legal lights sabotage made a keeper navigate to remote repair instead of consuming the enabled task descriptor. The staggered seed3 controller simulation already ended by parity (12 completed jobs), but performed zero task inputs while auxiliary sabotage was active; it is not a reproduction of the native15-minute pause. The original raw44 native21/22 receipt remains separate and unaltered.

Local policy now keeps critical repairs urgent, completes nearby enabled owner tasks before remote auxiliary repair/device visits, and retains a chosen finite own-job destination. Only projected tasks, public equipment, current permitted doors and enabled descriptors enter proposals; the ordinary engine still validates every action. No winner/deadline/seed/budget changes, hidden-state input or provider calls are introduced. Optional device goals remain after owned work and critical repair may interrupt a task.

Focused green and native scheduler follow-up are pending at this milestone. No claimed frame rate or complete-match native approval.

Milestone focused results: incoming engine optimization6/6 and owned AI3/3, zero skips. Seed3 staggered500ms simulation now ends by actual crew task victory at147500 (20 completed jobs,72 task inputs,71 during auxiliary sabotage,zero denied proposals/zero fetch/model calls); original same cadence ended by parity at293500 with12 completed jobs andzero auxiliary task inputs. This is not a native scheduler result. Logs: _artifacts/spectator-engine-incoming-green.txt and _artifacts/spectator-ai-focused-green.txt. world-runtime.pending and state-copy were already present from the merge and are retained unchanged.

## Bounded final evidence and limits

Milestone ec9d51c0cb02c0461fc7b5deb0567569c0171d95 changes only engine/index and ai/world runtime. The follow-up retains the existing evidence-driven emergency-meeting priority, adds critical-over-job positive controls, and owns no transport/client/spectator changes. Existing exports/signatures are unchanged; copyState and worldRuntime.pending were already brought in by the merge and remain unchanged. Original exact maps, legacy formats, eleven step families, six station families, requests and private ghost rules are not replaced.

Checks (Node24.20.0, all temporary data below this D: checkout's ignored _artifacts/test-temp; reused coordinator node_modules through a dependency junction, no install/update):

- Incoming engine optimization controls:6/6 passed. Full retained focused run:59 total,55 passed,4 failed,0 skips. The four failures are incoming ActorSamples presentation assertions in world-movement-performance (constant speed, stationary restart, obstacle corner, expanded-map collision); public/world/model is outside this worker scope. All13 retained ghost-faction/actual HTTP-store tests,15 world-AI policy tests,13 CAPTCHA tests,3 protocol controls,5 owned AI tests and6 incoming engine optimization controls pass. Evidence: _artifacts/spectator-retained-focused.txt. These failures are not suppressed or reported as full green.
- Owned final tactical copy/deadline controls:5/5 pass (_artifacts/spectator-engine-copy-final.txt). Actual legal lights expiry, pending door closure/reopen, hatch arrival and stationary device-read completion are checked at exact boundaries on both maps. Deep-frozen schemas3/4/5 input survives tick/action/input; returned replay extension, checkpoint tasks, receipts, legally created private field note, player/spectator knowledge and investigation storage can mutate without touching input. Intermediate logs preserve test-fixture lookup mistakes (knowledge belongs to players; the new action may append after an extension record), not attributed engine defects.
- Actual offline createGameServer HTTP/auth/private store/earliest-due scheduler/controller with seed3, default Beacon2 match5, unchanged rules and budgets:1/1 passed. At authoritative593000, crew won by all20 tasks;72 task inputs,54 during auxiliary sabotage,24 sabotage proposals,12 repairs,1 device visit,4 eliminations,2 reports.257 decisions; one stale INVALID_TARGET denial remains in the recorded receipts. Zero external/model calls. The real monotonic test clock advances500ms/20ms, not native wall time or browser qualification; measured37.57s test duration. Native result is independently visible in _artifacts/spectator-engine-native-boundaries.txt, whose overall command also includes3 earlier test-fixture errors; those copy controls are corrected and green in the separate final log. Graceful game.close and contained test-data cleanup complete. No death, completion, position, vote, deadline or winner is assigned by the fixture.
- Retained six-station local demo control:1/1 pass,106 ordinary taskInteract inputs, all six puzzle kinds, crew task victory at87400. This deliberately delays hostile critical/kill cooldowns to isolate puzzle completion; it is not the default native match. _artifacts/spectator-engine-six-stations.txt.

Commands actually executed from this worktree (TEMP/TMP=D:/Widegames-work/temp):

```powershell
node --test --test-isolation=none --test-name-pattern='idle world|tick preflight|fast state copy|moving state copies|expanded-map movement' tests/world-movement-performance.test.mjs
node --test --test-isolation=none tests/latest-spectator-engine-copy.test.mjs tests/latest-spectator-engine-transport.test.mjs
node --test --test-isolation=none tests/latest-spectator-engine-ai.test.mjs tests/world-movement-performance.test.mjs tests/quality-main-ghost-factions.test.mjs tests/world-ai-policy.test.mjs tests/captcha-task-engine.test.mjs tests/latest-main-engine-protocol.test.mjs
node --test --test-isolation=none tests/latest-spectator-engine-copy.test.mjs
node --test --test-isolation=none --test-name-pattern='all six actual station' tests/quality-station-ai.test.mjs
```

## Exact incoming equivalence and timing

Raw core.autocrlf=false/core.eol=lf git archives for main41 and candidate88 are retained at _artifacts/spectator-reference-main41 and _artifacts/spectator-reference-candidate88. The unchanged incoming scripts were run:

```powershell
$env:SPECTATOR_EQUIVALENCE_BASELINE_ROOT="$PWD/_artifacts/spectator-reference-main41"
node scripts/spectator-engine-equivalence.mjs
$env:SPECTATOR_EQUIVALENCE_BASELINE_ROOT="$PWD/_artifacts/spectator-reference-candidate88"
node scripts/spectator-engine-equivalence.mjs
$env:SPECTATOR_BASELINE_ROOT=$env:SPECTATOR_EQUIVALENCE_BASELINE_ROOT
$env:SPECTATOR_PERF_REPORT="$PWD/_artifacts/spectator-engine-performance.json"
node scripts/spectator-performance-check.mjs
```

The exact-main41 run compares240 Beacon transactions then stops on expanded creation: quality's intentional started.mapId metadata adds24 replay bytes. Its red log is _artifacts/spectator-main-equivalence-first.txt. It is not a copy/movement counterexample. Against exact88b9646f1f577c1e12b2f2a10172aa51d5f9e38e all720 transactions compare identical full states/events/receipts (3 legacy worlds,2 modes,2 feature presets). The incoming script hardcodes its printed baseline field to41 even when its documented environment override selects88: the actual reference for the passing receipt is88, not41. No script/assertion or baseline source was rewritten.

The timing receipt compares candidate88 with current engine:120 idle ticks,30 moving ticks,120 views in each of4 fixtures. With12000 synthetic retained records, mean legacy idle tick human33.968ms ->0.000987ms and spectator34.276ms ->0.000715ms; moving tick human35.767ms ->20.475ms and spectator37.340ms ->12.855ms. Empty-history moving tick human0.197ms ->0.155ms and spectator0.181ms ->0.103ms. Machine/load/JIT affect these single-run wall-clock measurements; no CI threshold, browser FPS, tactical speedup or guaranteed native-match latency is claimed. Schemas3..5 intentionally retain the full generic copy/tick path. Exact values/method: _artifacts/spectator-engine-performance.json.

## Coordinator/Frontend handoff

The four client interpolation failures remain assigned to Frontend; do not weaken the assertions without reviewing MotionTrack context/collision semantics. The engine six controls are green separately. The incoming unadapted server/spectator.mjs also needs owner integration: selectedPlan resolves room validity through getWorld(state.mapId), which cannot represent exact tactical Beacon2/Annex rooms; task rows use legacy taskProgress(task), which does not project station challenge kind/completion. Inspection must use the exact map and station-specific progress without feeding omniscient inspection into AI views. That module is outside this worker's ownership and was not edited. Full composed/native/browser approval remains pending coordinator and independent Reviewer gates. No Chrome, live model/provider, main write, push or deployment.
