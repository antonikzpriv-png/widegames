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

## Bounded independent UI/integration follow-up

This follow-up changes only `tests/world-ai-ui-review*.test.mjs`, `tests/world-ai-integration-review*.test.mjs` and additions to this report. No AI/runtime or other worker file was edited. Read coordinator `docs/WORLD-INTEGRATION-FINDINGS.md`; historical Core/shared and diagonal-adapter findings remain closed, with their old-source controls preserved. AI author self-checks above are not repeated or relabeled independent approval.

### Exact committed source and result

Frontend committed within the ten-minute review window: **`9e571c7dae0d8153935c7c3d932402357191b8b3`**. Read the actual diff after b2 and verified its committed modules, not just the candidate. Root controller: **`6e3a691813ea25b539ac28b26b4def4544c353a8`**, which includes the readiness fix `59835b7c546bea7784a040637c5f22c80bf6e022`. Latest integration inspected: **`7093c2f501aecd877ffa324d8d7c95d1387cc81a`**.

Git comparisons returned no differences between 6e3a691 and7093c2f for public/app.mjs, api.mjs, ui.mjs, styles.css, world-input-envelope.mjs, shared/** and server/engine/**; no differences between9e571c7 and7093c2f for public/world/**. Thus the exact integrated runtime in this review matches the tested source pins. Relevant integrated blob IDs:

| File | Blob |
| --- | --- |
| public/app.mjs | `827dd9139aeb10ad2c3db3241adc5dc686514691` |
| public/world/experience.mjs | `ee4a5aa5f62df78882b11d6a6dc03e35262475b8` |
| public/world/model.mjs | `50188c229813ddf455b54283a41c32254b706ae4` |
| public/world/scene.mjs | `550a31ec6bc0670995929e462b56c5c595fcc344` |
| public/world/input.mjs | `2aff83f5f1a52fd475329460274301fc25a3c7a9` |

**24 targeted tests:22 passed, two failed, zero skipped. Node exit1. No blanket acceptance.** Both failing assertions remain active, and exact historical controls reproduce both failures. Concrete findings:

1. **Stale task rejection overwrites council feedback**, now confirmed at committed9e571c7 and integrated7093c2f. Open/solve equipment, submit with a controlled pending action, update to discussion (equipment closes), then reject the old task. `openTask` catch still calls setFeedback unconditionally, replacing current feedback with `OLD TASK FAILURE`. Current-room task rejection separately remains visibly failed/retryable and is not reported successful. This finding concerns obsolete feedback, not demonstrated secret disclosure or an accepted stale task action.
2. **Retained old-room retry handler invokes the new room's retry**, confirmed at c683963,6e3a691 and unchanged integrated7093c2f app source. Produce an ambiguous task failure in A and retain its Retry button handler; open B, produce a different ambiguous task failure in B, invoke the retained A handler. Request count increases2->3 and the handler sends B's retry. `tell` installs `()=>retry?.()` against a mutable global, without capturing its original room/epoch/operation. The extra POST retains B's request ID, so authoritative idempotency bounds the demonstrated consequence; no cross-room credentials or hidden state leaked. The positive regression requires zero extra requests. Historical c683963 control explicitly proves the old behavior. This is an adversarial retained callback fixture, not a measured native event-scheduling frequency claim.

### Passing requested boundaries

- Actual Core-generated task objects across four labeled seeds all have relay labels; taskKind reaches wires/tuning/sequence, and each actual equipment implementation opens through the world experience. This is not a fake descriptive-label fixture or only a helper return-value assertion.
- At the real usable Bridge bell point, a pending Bridge task outside station range does not mask a legal meeting action; the actual Use handler dispatches meeting. An unavailable already-contributed Engine repair does not mask a legal local task; Use opens the equipment.
- Actual model+scene execution animates a remote player's observed position change without any private player.moving property in the input. Unchanged observations time out and newly hidden actors disappear; the input view is not mutated.
- Actual scene canvas-call trace paints narrow doorway thresholds at six independently selected walkable shared-map crossings: Bridge south(800,370), Archive east(440,490), Lantern west(1160,490), Workshop north(800,600), Galley north(260,840), Engine north(1340,840). Source places these patches after room walls. This is source/draw-coordinate qualification, not browser pixels, art quality or native collision screenshots.
- Solved equipment cannot submit after room, phase, proximity or legal-action hint changes. Deferred success cannot reopen old equipment, claim obsolete task success or steal council focus. Current task rejection remains failed and retryable.
- Actual root controller functions reject old world callbacks after room change, ignore unabortable queued input/action/replay completions, and do not let an old leave callback leave the new room. Hidden/stopped/disposed owners cannot send further input. Actual input module emits a final zero on hidden/dispose and removes steering listeners; server lease fallback was qualified in the previous independent transport receipt, not rerun here.
- A deliberately unavailable WebSocket with an accepted authenticated HTTP view leaves world callbacks playable. Ambiguous task failure rejects through worldMutation rather than being swallowed. The visible retry overlay repeats the exact request body/ID and disappears on acknowledgement; its CSS fixed/z-index rule is inspected, not Chrome hit-tested.
- Independently exercised59835b7: failed movement revokes readiness, further nonzero input is denied without another request, authenticated HTTP polling restores readiness, then a fresh movement request succeeds.

### Commands, source defaults and evidence

```
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
$env:WORLD_AI_SOURCE_ROOT='D:/Widegames-work/world-coordinator-20261029'
$env:WORLD_AI_REVIEW_UI_PIN='9e571c7dae0d8153935c7c3d932402357191b8b3'
$env:WORLD_AI_REVIEW_APP_PIN='6e3a691813ea25b539ac28b26b4def4544c353a8'
node --test tests/world-ai-ui-review.test.mjs tests/world-ai-integration-review*.test.mjs
```

Exact-pin run above:24/22pass/2fail/0skip. `_artifacts/world-ui-closure-9e571c7-6e3a691.txt`, SHA256 `CA3EB932276D22F9230327A15AF77D63B6486ED05BBB5BB89B332D1ADBDF6A4B`.

All positive tests default to files relative to their actual test checkout/layout; there is no default old source pin and no integration-absent skip. Optional UI/app SHA overrides read Git objects; WORLD_AI_SOURCE_ROOT/UI_ROOT remain explicit read-only qualification overrides. To exercise the default branch without changing this assigned worktree's old runtime, copied exact root6e3a691 server/shared/public files plus Frontend9e571c7 public/world files and the three owned tests into ignored `_artifacts/world-ui-closure-default-final`, then removed all four source-selection overrides:

```
Remove-Item Env:WORLD_AI_SOURCE_ROOT,Env:WORLD_AI_REVIEW_UI_ROOT,Env:WORLD_AI_REVIEW_UI_PIN,Env:WORLD_AI_REVIEW_APP_PIN -ErrorAction SilentlyContinue
node --test _artifacts/world-ui-closure-default-final/tests/world-ai-ui-review.test.mjs _artifacts/world-ui-closure-default-final/tests/world-ai-integration-review*.test.mjs
```

Default source loading also produced24/22pass/2fail/0skip, exit1. Log `_artifacts/world-ui-closure-default-final.txt`, SHA256 `BE2A78063A2C81566F58E4DC531313DDE8FFF1E3EE5A50E75F9157C84109A40B`. This ignored layout is explicitly pinned qualification evidence, not another Git worktree or a claim this reviewer's runtime was integrated. Source/temp/cache remain on D:.

Preparation evidence is preserved: first new candidate run9pass/1 stale-error failure; after added failure/door controls,15pass/2fail across17 tests. Earlier controller fixture omitted the adapter from its stripped import bindings, initially causing a2-vs3 request setup assertion; injecting the actual adapter corrected that fixture. The independent retry failure remained. An intermediate shell command printed a file hash after Node and therefore ended exit0 despite Node's reported failure; final exact/default commands explicitly retain Node exit1. No failed product assertion was relaxed or skipped.

Frontend preparation source snapshots remain ignored; their experience.mjs SHA256 hashes are `BF0BC48CF4854C2A07F608CD5BABB56F7EBC5043531FEE6ADEAD27BEBB65E74E` and `B953A0591AE92179A893907E7EAAD716B4CFF48CE92F084F40CFBE7827D23C96`. Historical committed controls now pin9e571c7 stale feedback and c683963 retry, alongside earlier b2 diagonal and093/eb64 legacy controls. Final conclusions use committed source only.

No Chrome, paid/live provider, full repeated suite, deployment/main/push, Docker, hosted CI or OS durability qualification. Controller tests stub the renderer to isolate real root lifecycle functions; equipment tests execute real frontend logic with a minimal DOM and controlled promises; drawing tests record calls without a browser. Two concrete findings above prevent a green closure at the reviewed pins.

## Independent submission/replay closure after c31f825

Bounded follow-up began19:57 UTC; both owner runtime fixes were committed and inspected within the requested ten-minute window. Ownership remained the world-ai UI/integration audit tests and additions here. No AI/runtime, other worker file, account, main/push/deployment or Chrome change.

### Exact component pins

- Frontend **`889a50d135f4e3e1d9acdbda3a22e8c95604eb0a`**, after9e571c7. Experience blob `270f178ee3a1c3aad4c2799ae225249f6fbebbaa`.
- Core **`e16bacedfa18b9d6c28a965e06cb08fbaf0fa161`**, after the recorded2e06f74 chronology regression. Index blob `27089c6a986d67c544bb449a450fcb3f03f3e4ab`; world-runtime remains `aa718782aea32472df3e723528ea087fb3d2a442`.
- Root **`2a841aa9e509aea04cdf65206231f9256af5e5ac`**, including scoped stop/sequence work at `b8cdb4a96e7e28cf1a22f5ddde24e7ac348a80eb`. App blob `677c72b07408b0ff293aad25a6d0090c2b35ea28`; API `ba16136932617c60547aa6f1d01ccfe31e607999`.
- Shared dependencies read from the coordinator, verified unchanged before/after: world `a2bc61a0320e6033feb8956e59884399d0a34d06`, contracts `ea395a080f8bd6ee3230d62be0884799bbabd4e6`.

These are independently tested committed component pins, **not a claim the coordinator already integrated both new fixes**. Final coordinator read was `3c250bcd21bfb760916b9e7512f37b7f89e0f9a5`, clean, with matching root/shared blobs but still the prior Core4771693 and UIee4a5aa blobs. Manager must import the new Core/UI runtime commits before claiming their behavior in its integrated tree.

### Results and tested limits

**35 targeted checks passed, zero failures/skips, Node exit0.** This includes the previous positive/historical controls; counts overlap earlier receipts and must not be summed. No concrete remaining finding in this tested component scope.

Frontend: reviewed actual committed diff. `ownsSubmission` captures the puzzle and task-session identity and rechecks disposal plus current legal session before either success or failure feedback. The original stale rejected-task assertion is unchanged and now passes. Five additional rejection controls cover room change, proximity loss, action-hint removal, death and disposal. A current failed submission still shows its error, keeps the solved equipment open, and reenables submission rather than claiming success. Historical9e571c7 still reproduces obsolete council feedback. Existing real generated-task type, bell/task/repair priority, observed movement animation, doorway draw trace and success/focus guards continue to pass. Minimal-DOM/drawing limits from the previous receipt remain; no browser result is inferred.

Core: actual fix is limited to ended `getReplay`, returning a deeply cloned log sorted numerically by actual at. Added independent real-engine staging beyond the original2e06 fixture: p1 manual expiry600ms; p2/p3/p4 actual arrivals100ms; p5 fractional arrival `18.125/180*1000`ms. An actual meeting/vote/ejection ends the match before export. Exported movement order is p2,p3,p4,p5,p1, preserving exact times without rounding. For every equal timestamp, exported IDs retain the private append order, including vote_result/ejection/ended/role_reveal causality. The persisted log remains unchanged; nested exported roles, actions and positions can be mutated/reversed without affecting state or subsequent exports. Active, discussion, voting and true maximum-duration paused states return null replay and withhold public roles. Ended public roles are present. Historical aa471eb still reproduces600-before100. A separate real-input control confirms delayed lifecycle stop seq42 cannot cancel already accepted newer seq44; current motion/position continues normally.

Root: adapted the old tests' blanket no-request assumption to the explicit new cleanup contract. Old action/input/replay completions still cannot change the current room; legitimate old-room zero packets are required to target only its /input route, use keepalive=true, timeout1500ms, no soon-aborted ordinary signal, and never accept their response as state. Hidden/closed cleanup acknowledgements cannot revive a view. Fresh local seq5 maps above restored server seq40; lifecycle stops advance wire sequence separately; fresh local seq6 allocates beyond all stops; a duplicate retains its exact prior wire packet, and stale/conflicting client intents send no new request. Actual API fetch options are same-origin/no-store/keepalive with an independent live timeout signal. Existing WN2 active regression now passes at2a841aa while historical c683963 remains reproducible. HTTP fallback, readiness recovery, current task failure propagation and same-ID retry remain passing.

The finite clicked-path limitation is retained: lifecycle stop delivery is best effort. Manual600ms lease does not imply an accepted clicked route expires after600ms; a broken network can prevent cleanup and the finite route can complete. No OS durability or distributed ownership claim follows from these tests.

### Reproduction and evidence

```
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
$env:WORLD_AI_SOURCE_ROOT='D:/Widegames-work/world-coordinator-20261029'
$env:WORLD_AI_REVIEW_UI_PIN='889a50d135f4e3e1d9acdbda3a22e8c95604eb0a'
$env:WORLD_AI_REVIEW_APP_PIN='2a841aa9e509aea04cdf65206231f9256af5e5ac'
$env:WORLD_AI_REVIEW_ENGINE_PIN='e16bacedfa18b9d6c28a965e06cb08fbaf0fa161'
node --test tests/world-ai-ui-review.test.mjs tests/world-ai-integration-review*.test.mjs
```

Log `_artifacts/world-ui-chronology-closure-pinned-final.txt`, SHA256 `E079E796F72F2B41E7FC43A1C6E94586B423145DDC5AF5A1F44F5AB7BCBC0A17`:35/35 pass, no skips. Engine pin mode rewrites dependency import locations only and executes actual committed index/runtime against the qualified shared module; no engine logic is patched by the harness.

Default source loading was also exercised without any source-selection overrides. Ignored `_artifacts/world-ui-chronology-default-final` contains Git copies of2a841aa server/shared/public, replaced only server/engine/** frome16bace and public/world/** from889a50d, plus the four current owned test files. It is an explicit composite qualification layout, not another worktree and not another owner's source edit.

```
Remove-Item Env:WORLD_AI_SOURCE_ROOT,Env:WORLD_AI_REVIEW_UI_ROOT,Env:WORLD_AI_REVIEW_UI_PIN,Env:WORLD_AI_REVIEW_APP_PIN,Env:WORLD_AI_REVIEW_ENGINE_PIN -ErrorAction SilentlyContinue
node --test _artifacts/world-ui-chronology-default-final/tests/world-ai-ui-review.test.mjs _artifacts/world-ui-chronology-default-final/tests/world-ai-integration-review*.test.mjs
```

Default result35/35 pass, zero skipped. Log `_artifacts/world-ui-chronology-default-final.txt`, SHA256 `B46A9A31BD7A3E30AA7010020C04CBA040BC4D743794E34307C79159ED49EA5A`. Positives default to actual relative source files; historical controls keep explicit old pins; no absent-integration skip was added.

Preparation failures remain distinguished: the first new sequence comparison failed only because a VM-realm object was compared with a host-realm copy; comparison now checks identical JSON packet fields. The first35-case run had34 passes/one fixture failure because a source assertion required `const packet`, while the reviewed allocator correctly uses `let packet`; its binding-pattern check now permits const/let, backed by execution of the actual root encoder. The original current-manager chronology control failed with600-before100 before the Core pin was available, then passed at e16bace. Neither product assertion was removed, weakened to accept stale behavior, or skipped. Final source checks `git diff --check` pass.

This is independent UI/Core/root source/VM verification. No AI runtime change or new self-approval, full duplicate suite, Chrome, paid/live provider request, hosted CI, Docker, main/push/deploy, other worktree edit or account substitution occurred. Browser, integrated end-to-end and deployment qualification remain the coordinator's separate work.

## Optional strategic mode integration

The historical navigation-only constraint above describes the default hybrid mode.
The current feature adds explicit `AI_STRATEGY=strategic`; see
[the configuration and execution contract](AI.md#optional-strategic-gameplay-cloud-integration).
`server/ai/strategic.mjs` enumerates intentions and executes them using public world
geometry and fresh actor views. It uses the existing Anthropic adapter and
reservation callback. Existing world demo and hybrid policy tests remain active.
`tests/ai-strategic.test.mjs` tests choices, bounded retries, concurrent match
allowances, privacy, dynamic profiles, stale results and persistent routes;
`tests/ai-strategic-matches.test.mjs` runs full mocked strategic matches through the
real engine, restores JSON context mid-route, and reaches actual rules outcomes
through explicitly budget-limited fallback. These are author checks, not an
independent review or live-provider qualification.
