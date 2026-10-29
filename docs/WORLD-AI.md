# World AI implementation and separate review

## Navigation milestone

Base: `d5eed65eb4737ceccab594c6dad911ff9033d2ba`, branch `codex/lantern-world-reviewer-20261029`. This is an explicit AI implementation assignment. AI checks below are author self-checks; they do not independently approve my AI. Other owners' committed engine/transport/frontend source will be reviewed separately after it exists.

Schema1 room bots retain their existing policy. A safe view with `worldVersion:1` selects a local world policy. It uses the actor's own position/moving/destination, public map/stations/bell and currently visible player/body positions. It never receives engine state. Task/repair/report/eliminate/meeting proposals check world proximity as well as engine action hints. Navigation remains a server-validated `navigate {x,y}` proposal; the server owns movement, collision and time. Stable path lengths from public geometry choose work, and station patrols have character offsets. The bell's table is solid, so its approach point must be reachable within interaction range.

Normal travel produces wait proposals until arrival; no per-frame provider work or repeated normal route reset. A current visible body or an urgent repair can interrupt a route; a saboteur may chase a currently visible target. No last-known hidden actor coordinate is stored or pursued. A local repair contribution marker persists in the private actor memory, keyed by that sabotage's deadline; a new critical event is eligible again. All proposals still pass engine validation. Existing persona speech, firsthand/heuristic distinction, match/actor isolation, cancellations, reservations, council adapter and conservative budgets retain their semantics. Demo stays labeled; live stays explicitly hybrid: local navigation, model council. No budget was raised.

### Initial offline fixture receipt

Shared geometry source: committed `6f6f7c023ed3727b9849cdf27040a0ca88ddb46e`. Shared geometry has not been imported into this worktree; only ignored `_artifacts/world-ai-shared-overlay` contains copies of current owned AI plus `git show 6f6f7c0:shared/{contracts,world}.mjs`. No other owner's source was changed. This overlay is explicitly a contract fixture, not Core engine qualification. The test defaults to current checkout source; `WORLD_AI_SOURCE_ROOT` only supplies an explicit qualification overlay. Missing integration fails rather than skips.

```
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
$env:WORLD_AI_SOURCE_ROOT=(Join-Path (Get-Location) '_artifacts/world-ai-shared-overlay')
node --test tests/world-ai-policy.test.mjs
```

Result: **14 passed, zero failed/skipped**. Controls cover deterministic safe-point selection, real shared path geometry, same-room out-of-range work, arrival/cooldown waiting, visible body approach/report, hidden/malformed/occluded body positions, repair interruption/contribution restart, visible pursuit/kill range, hidden metadata getters, ignored forged state argument, reachable bell approach, invalid own position, abort, zero LIVE roam fetch/reservations, mocked council fetch after reservation, exhausted restored budget, distinct persona/witness memories and schema1 task/BFS compatibility. Provider response and safe views are labeled fixtures. No paid/live call, Chrome, deployment or hosted-CI claim.

Pending: exact committed Core engine full seeded all-AI and idle-human world runs, then independent source review of other owners' integrated changes. No invented winner or fixture mutation substitutes for actual engine outcomes.

## Follow-up implementation checks and independent findings

Navigation milestone: `84a9973cef5367adeac68eb7395c3f6983710009`. A second focused compatibility run used updated shared `eb64cc8fc6f9a024c0fe6c84dabf384e897819fe` plus unchanged base engine/controller tests in the ignored overlay: **47 passed, zero failed/skipped** (31 existing controller, two existing schema1 engine tests, 14 world policy). These are author AI self-checks, not independent AI approval.

Exact Core `093d0498bec25faaa107e3d32231c93c89fdf69d` was then copied via Git into the same ignored overlay. `node --test tests/world-ai-engine.test.mjs tests/world-ai-policy.test.mjs` passed **17 tests, zero failed/skipped**, including four real schema2 seeded matches and one additional mocked vote/cancellation check. Initial four-match receipt: all-AI seeds1/7 crew tasks at23000ms; idle-human seed1 saboteur parity at173000ms, seed7 crew tasks at67000ms. Real proposals included navigate/task/wait and, in human matches, eliminate/report/sabotage/repair/say/vote. Each match serialized both engine state and private AI context mid-route and resumed with a new controller; no state mutation supplied a win. Simulated clock steps250ms, actual world speed/radii, decision interval1800ms; only council deadlines shortened to6000/4000ms. Broader eight-match run pending below. No full transport persistence claim from JSON restart alone.

### Independent other-owner findings (reported promptly)

1. **Frontend diagonal movement rejected.** Exact `b2cc6c33be4fcd240254c1758a0877351593fa9f`, `public/world/input.mjs`: pressing W then D emitted `{seq:2,dx:0.7071067811865475,dy:-0.7071067811865475}`. Real transport `f930d7f1beda63179065f5c754b4c2e5d91fad7d` and Core093 require integer axes -1..1, so the second request rejects. Joystick/click-path directions use the same normalization. Reproduced with the actual committed input module and minimal event targets, no Chrome. Frontend is actively building; this is a concrete milestone finding, not a claim about a forthcoming fix.
2. **Core/shared legacy-view integration crash.** Core093 plus shared eb64: `createMatch({id:'legacy-boundary',now:0,seed:'review',world:false})` creates schema1; `getPlayerView(state,'p1',0)` throws `TypeError: Cannot read properties of undefined (reading 'x')`, engine line267. Shared ACTION_TYPES includes navigate; the hint loop reads p.position.x without a schema2 guard. The standalone reproduce exited1. This breaks preserved schema1 programmatic/transport fixtures and bots. No AI policy change can repair that boundary.

`tests/world-ai-integration-review.test.mjs` keeps both historical negative source controls and active positive current-checkout regressions; explicit `WORLD_AI_REVIEW_UI_PIN` preserves exact committed frontend review. The first test invocation had three failures: the two concrete product failures plus an overly exact historical floating-point expectation (`Math.SQRT1_2` differs by one ULP from `1/Math.hypot(1,1)`). That fixture assertion was corrected to a tolerance; neither product assertion was relaxed or skipped.

## Qualified follow-up receipt

Current AI runtime remains the navigation milestone unchanged. Integrated `12e87578cb73c5f889f60361c2489996fc518761` has identical AI blobs: index `6c9171cb0384c5c0bb8da2548e5e0a1a4fc56595`, demo `77118cce2ddb3d0b6e579365a14c765d50b35bfe`, world `2e762375cdb4c80d4fb6f5c2d5fe3beb94f76498`. Provider adapter is unchanged. No other owner's tracked file was edited in this worktree.

### Independent historical findings closed in integration

The exact integrated source reviewed was `cb37c6df899005b86b115ab0629399cb05d891f4`. Its unchanged legacy constants come from `b8c17559ceef9552bce0642aee752e073a5c0ef2`: navigate is removed from shared ACTION_TYPES; Core adds navigate only for world matches. The schema1 regression passes on that actual tree. I initially reported the Core file's unchanged blob as proof the integration was still broken, overlooking the corrected shared dependency; that integration statement was wrong and corrected promptly. The original Core093 + shared eb64 counterexample remains historical and reproducible.

The actual integrated input path now calls `worldInputEnvelope(input)` before HTTP, from `8272ed96f3fb1a303add5db01a8d7df056fe6b1a`. Its bounded finite-axis adapter maps the earlier renderer's fractions to integer axes; raw floats still reject at authority. The independent check executes the actual committed input module through that exact adapter and confirms app.mjs uses it. Thus the earlier b2-only diagonal issue is closed in this integration; no requirement to weaken server validation. Both historical source controls remain active. Four independent source/input/legacy controls pass, zero skips.

### Latest committed Core/transport qualification

Read-only exact sources:

- Core `aa471eb209c2c58a8d95ad9fa855ff01ebae83a2` (the subsequent `2370c6b9965f672724f6fbb166a740a27f4bb3a0` changes only Core documentation).
- Transport/store `337358b00cf71a09b4c75af36a7eaa3d8622a243`.
- Base integration `cb37c6df899005b86b115ab0629399cb05d891f4`, including its actual shared geometry/contracts and unchanged milestone AI.

These exact modules were copied by `git show` into ignored `_artifacts/world-ai-next-owners`: start with every tracked file under server/shared/public from cb37c6d; replace only server/engine/{index,world-runtime}.mjs from aa471eb and server/{transport,store}.mjs from337358b. This is an explicitly pinned composite qualification artifact, not a claim those owner commits were already integrated into one manager SHA. All snapshot files and node_modules are in this assigned checkout. Normal test defaults import the actual checkout; overrides never silently skip missing integration.

```
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
$env:WORLD_AI_SOURCE_ROOT=(Join-Path (Get-Location) '_artifacts/world-ai-next-owners')
$env:WORLD_AI_REVIEW_UI_PIN='b2cc6c33be4fcd240254c1758a0877351593fa9f'
$env:WORLD_AI_REVIEW_APP_PIN='8272ed96f3fb1a303add5db01a8d7df056fe6b1a'
node --test tests/world-ai-engine.test.mjs tests/world-ai-policy.test.mjs tests/world-ai-core-review.test.mjs tests/world-ai-transport-review.test.mjs tests/world-ai-integration-review.test.mjs
```

**26 passed, zero failed/skipped**, 9.46s. AI portion:15 policy/council controls plus two seeded-match tests containing eight complete matches. Seeds1/7/11/19 all-AI: genuine crew task wins at23000ms; idle-human: parity173000ms and crew tasks67000/43000/39000ms. These accelerated-council fixtures demonstrate completion, not minimum game duration or full entertainment qualification. All eight moved physically, waited while traveling and resumed serialized state/context mid-route. No new fallback or fake outcome was needed.

Independent other-owner controls in that run:

- Real HTTP/cookies and WebSocket: missing/forged cross-room/spectator identity and foreign origin cannot steer, malformed/analogue hidden-field requests reject; own sequence/destination only, spectator physical public positions and no roles; every audience receives its safe engine view, no private AI/state fields, no-store responses.
- Real file-backed close/restart: newer input survives, stale/conflicting input rejects, duplicate cannot extend lease, movement stops at900ms total across a renewed lease, fresh zero input does not teleport. This exercises the actual updated store and Core, not a mock input engine.
- Real Core staging via accepted navigate/eliminate/report/vote actions: an observer within360 but behind a wall cannot see the killer/body/witness. A firsthand observer gets the actual death coordinate/time, preserved through JSON restart and report; only ended replay reveals the attributed attack after a real ejection victory.
- Late input settles only to the exact council boundary; denial sequence/error persist, its duplicate remains denied even after roaming resumes, fresh sequence moves normally. The expectation follows aa471eb's newly explicit persisted-denial semantics. Core093's earlier control was run before that semantic refinement.

Unchanged ai-controller/ai-engine tests were copied byte-for-byte into this exact overlay and run with `node --test _artifacts/world-ai-next-owners/tests/ai-controller.test.mjs _artifacts/world-ai-next-owners/tests/ai-engine.test.mjs`: **33 passed, zero failed/skipped**, 6.78s. This checks schema1 bots, council model mocks, conservative budgets, cancellation, reservations/retries and private memories against the new committed compatibility correction. Counts overlap previous runs and are not summed into unique coverage. Locked dependency install: `npm ci --ignore-scripts --no-audit --no-fund --prefer-offline`, 25 packages, cache on D:.

### Frontend minigame candidate: preparation finding still pending exact commit

After the b2 milestone, Frontend's additional minigame/council source was inspected **read-only and uncommitted**, so it has no final source approval here. `tests/world-ai-ui-review.test.mjs` executes the actual candidate model/input/puzzle/phase/experience logic in a minimal DOM with stubbed drawing and controlled promises. It defaults to current checkout source. The preparation invocation explicitly used `WORLD_AI_REVIEW_UI_ROOT=D:/Widegames-work/world-frontend-20261029` and `WORLD_AI_SOURCE_ROOT` pointing to the cb37c6d snapshot; no other worker's file was modified.

Result: **five passed, one failed, zero skipped**. Solved equipment cannot send after room, phase, position/proximity or available-action changes. Deferred task success does not restore old equipment or steal council focus. **Open candidate defect:** submit a solved task, defer its request, receive discussion state, then reject the old request. The onSubmit catch unconditionally calls setFeedback, replacing current council feedback with `OLD TASK FAILURE`, despite the equipment/session having been closed. Source: public/world/experience.mjs openTask catch. This is stale feedback only; no stale task mutation/secret disclosure was demonstrated. Reported promptly. The positive assertion stays active; final exact committed source must be rechecked before closure. This candidate test depends on Frontend's forthcoming dom/puzzles/phases modules; it is not green on the earlier incomplete b2 slice.

The Core privacy fixture first used an illegal zero initial kill cooldown and was rejected as Invalid rules; corrected to legal1ms before the actual attack assertions. That setup failure was not a product defect. No Chrome or native browser event/focus claim comes from the minimal DOM; no paid/live provider, Docker, hosted CI, deployment, multi-process durability or OS power-loss qualification was performed. AI checks are author self-checks; coordinator/another owner must independently verify AI. Store locking remains one writer per owned data directory, and no directory-fsync/power-loss durability approval is implied.
