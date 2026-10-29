# Engine / AI closure at exact coordinator pins

This closes the two AI findings recorded in `ENGINE-INTEGRATION-REVIEW.md` for its historical snapshot. It does not claim that the historical wrong vote or shared dialogue remains current. One additional event-privacy finding was discovered during the final source audit and remains open below.

## Pins and isolation

| Purpose | Exact commit |
| --- | --- |
| Original negative control | `414e77fca2c79e239cf60630b134adfd6b062acd` |
| AI owner correction | `3b8fc3d13361d6aab16af6dfea74c4dcdc5685dd` |
| Integrated correction | `5ca413186995f60b277cca92564270adf09e033b` |
| Requested current coordinator audit | `6411e8d2f8fb1eb88194cc43cb75f902ed339db2` |

Exact Git archives under D:/Widegames-work/temp were reviewed and tested read-only. AI, engine and transport source are byte-identical between 5ca4131 and 6411e8d (`git diff --quiet` exits 0 for those paths). Rooms additionally allowlist truthful hybrid-policy metadata at 6411e8d. The engine branch remains based on its existing b7f8130 receipt; production source, other worker trees, and the coordinator were not rewritten. Only `tests/engine-ai-review.test.mjs` and this new document change. All source, archives, dependency references, logs, temporary room data and test processes use D:. No browser or paid/live provider calls were used.

## Original findings: closed

The updated positive suite now requires a real eyewitness to choose actual killer p6 over innocent p1 even when p1 has saturated proximity suspicion. The legal-action case is unchanged from the independent review. It now checks the actual controller as well as demo candidates, applies the returned vote through the authoritative engine, verifies no outcome exists before tally, and reaches a crew ejection win at the real vote deadline.

The live prompt must preserve `firsthandWitnesses` separately from `proximitySuspicions`. The same-situation demo dialogue must produce five distinct crew first statements. All six live prompts retain their distinct canonical personas. These are positive current requirements, never assertions that the current implementation should choose an innocent keeper.

The original characterizations remain in a separate suite explicitly named **historical 414e77f characterizations only**, loaded through `ENGINE_AI_HISTORICAL_ROOT`. They confirm that the pinned original chooses p1 and produces one shared first statement. They are not run against the current source.

| Test run | Result |
| --- | --- |
| Positive closure suite against original 414e77f | Expected red: 5 pass, 3 fail |
| Same positive checks against integrated fix 5ca4131, plus pinned historical characterizations | 10 pass, 0 fail |
| Same positive checks against current 6411e8d, plus pinned historical characterizations | 10 pass, 0 fail; 1 opt-in open-finding check skipped |

The three historical failures are exactly: wrong p1 vote instead of p6; absent distinct firsthand-evidence payload; one demo dialogue instead of five. The serial demo control additionally completes 12 new seeded matches per run through real engine outcomes, with frozen safe views, all proposed actions accepted, and fetch disabled.

## Current integration / privacy gates

The existing independent `engine-integration-review.test.mjs` was run without edits against exact 6411e8d. All seven checks pass: colon identity compatibility; first-ID replay after the former eviction window; full 2,048 cap and new-ID rejection; old success/denial/conflict retention and actor isolation; HTTP denial/deadline persistence through restart; earliest-due six-actor scheduling; and persisted AI denials with private context redaction.

The snapshot's actual `tests/engine*.test.mjs` also pass all 30 tests. Its corrected retained-request count is **302**, comprising the initial rule denial, one move, and 300 waits; p2 retains its independent one request. The tests verify opaque task IDs, untallied ballots remaining hidden through a maximum-duration pause, replay locking, all four engine victories, illegal actions and missed deadlines. The old 256 expectation in this worker's historical source is neither reintroduced nor used to judge the current snapshot.

## Final source audit: one new meaningful finding

**Medium: a remote critical-repair event reveals a hidden actor and thereby role/location.** At exact 6411e8d, `server/engine/index.mjs:203` emits a global public event containing `{playerId:p.id,repairsCompleted}` when a keeper repairs the Engine critical. Repair validation permits crew only. An observer outside Engine consequently learns a guaranteed crew identity and the actor's current room, even though that actor's `players[].roomId` is correctly null in the same safe view. This conflicts with the contract's locally observable positions and exclusion of hidden actor metadata from the public timeline. It also defeats hiding the internal repairer list by allowing its reconstruction from events.

A complete legal-action reproduction, retained as an explicit opt-in failing regression in the owned AI review test, is:

1. Use the deterministic fixture with p6 saboteur, p1 crew repairer, and p2 observer on Bridge.
2. At time 65000 p6 starts sabotage. p1 moves Bridge -> Workshop at 65000 -> Engine at 65001 and repairs there.
3. p2 remains on Bridge. Its safe view has p1 position null and critical room Engine, yet receives the public repair event naming p1.

Observed packet excerpt:

```json
{"observer":"p2","observerRoom":"bridge","repairerPosition":null,"criticalRoom":"engine","repairEvent":{"type":"repair","at":65001,"playerId":"p1","repairsCompleted":1,"id":"e3"}}
```

`ENGINE_AI_CHECK_REPAIR_PRIVACY=1` enables the intended privacy assertion, which fails on 6411e8d with: `Unseen crew-only repair broadcasts hidden actor identity and therefore role/location`. With that flag absent, the open-finding check is explicitly skipped so the two original AI closures can be measured separately. A green closure run is not approval of this still-failing privacy property. No production repair was made in this review. Recommended engine correction: retain public aggregate repair progress but remove global actor attribution; provide actor detail only through locally observable events if needed. This requires no shared-view field addition.

Other audited source paths showed no additional meaningful finding in the requested boundaries:

- Checked every public event emission and the private replay records in `server/engine/index.mjs`. Role assignment and task transfers remain private; unseen eliminators are absent from public elimination events. Private witness attribution is filtered by the event's original observer list. Bodies expose local sightings to players. Roles appear in player records only after ended, and replay returns null before ended, including paused.
- Checked full safe-view construction and added a metamorphic test: swapping other hidden roles and task ownership leaves the observer's and spectator's initial views identical. Opaque task IDs remain present. The event scan and legal kill fixture establish no hidden role/actor keys for the tested public elimination path; they do not override the repair finding above.
- Checked `rooms.mjs`, HTTP/WS serialization in `transport.mjs`, private store writes, and static serving. Room/client broadcasts use engine views and a narrow AI summary allowlist. AI receives its own engine view and a public character entry. Replay is room-authenticated and ended-only; private source/data is outside the static public/shared allowlist. Private context is not serialized into public room responses.
- Checked AI controller, demo policy and provider adapter. The adapter selects from enumerated actions and optional public speech. Neither AI module imports the engine or assigns game outcomes. The transport serializes proposals through `applyAction`.
- The only engine outcome assignment is `end()` at line 22, called for task completion, saboteur ejection, parity, or critical expiration (lines 29-32 and 77). Maximum duration pauses without a winner. Independent tests reject model-supplied outcome/phase fields; a permitted speech message claiming a winner leaves phase and outcome unchanged. A model proposal can influence legal votes, but the engine alone evaluates their tally and resulting win.

## Reproduction and retained evidence

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP='D:/Widegames-work/temp'
$env:npm_config_cache='D:/Widegames-work/npm-cache'
$env:ENGINE_AI_REVIEW_ROOT='D:/Widegames-work/temp/engine-review-ai-414e77f'
node --test tests/engine-ai-review.test.mjs # expected 3 failures in positive requirements
$env:ENGINE_AI_REVIEW_ROOT='D:/Widegames-work/temp/engine-ai-closure-5ca4131'
$env:ENGINE_AI_HISTORICAL_ROOT='D:/Widegames-work/temp/engine-review-ai-414e77f'
node --test tests/engine-ai-review.test.mjs
$env:ENGINE_AI_REVIEW_ROOT='D:/Widegames-work/temp/engine-ai-closure-6411e8d'
node --test tests/engine-ai-review.test.mjs
$env:ENGINE_AI_CHECK_REPAIR_PRIVACY='1'
node --test --test-name-pattern='unseen critical repair actor' tests/engine-ai-review.test.mjs # expected open-finding failure
Remove-Item Env:ENGINE_AI_CHECK_REPAIR_PRIVACY
Remove-Item Env:ENGINE_AI_REVIEW_ROOT
Remove-Item Env:ENGINE_AI_HISTORICAL_ROOT
$env:ENGINE_REVIEW_ROOT='D:/Widegames-work/temp/engine-ai-closure-6411e8d'
node --test tests/engine-integration-review.test.mjs
Remove-Item Env:ENGINE_REVIEW_ROOT
node --test D:/Widegames-work/temp/engine-ai-closure-6411e8d/tests/engine*.test.mjs
```

Retained D:/Widegames-work/temp logs: `engine-ai-closure-original-negative.txt`, `engine-ai-closure-current-positive.txt`, `engine-ai-closure-current-cap.txt`, and `engine-ai-closure-repair-privacy-finding.txt`. The expected red controls are deliberate and documented. Live model quality, billing, browser behavior and later revisions remain outside this exact-pin review.
