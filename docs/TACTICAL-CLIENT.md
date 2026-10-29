# Tactical client handoff

Assigned D:/Widegames-work/tactical-client-builder-20261029, codex/tactical-client-20261029, foundation265804446e37b8847d43b31875cf9f6ea3c81c33. Only public/world/**, tactical-client tests and this report are edited. Root/shared/maps/backend/other worktrees stay with their owners. No Chrome, provider calls, main/push/deploy.

## First working milestone

The scene, navigation, labels and public doors/vents/repairs/devices resolve the immutable map from getMap(game.map ?? room.map), retaining the original beacon as the legacy default. Each scene instance retains its own descriptor/geometry; shared/world.mjs is untouched. Equipment sessions and panel contexts include map identity. No global current-map state or invented Annex geometry is added.

The existing lobby contains one native map selector using server availableMaps/map/settingsRevision. Only callbacks.settings(mapId) proposes settings; root owns HTTP, auth, request IDs/revision and persistence. The display stays server-confirmed, start waits for pending settings, and non-host/offline/pending/unwired states cannot send changes. Current denials remain useful. Obsolete failures cannot modify another room, revision, phase, host or visible session. Existing lobbies without selection metadata keep their old flow.

node --test tests/tactical-client-ui.test.mjs: 10 passed, zero failures. These are actual imported UI/minimal DOM plus clearly labeled catalog-only fixtures, not backend/browser workflows. They verify settings pending/error/permission/ownership and immutable original-map compatibility. The registry at this foundation contains only beacon. Core supplies the actual Annex fixture; no alternate-layout qualification is claimed yet. Distinct Annex art, dated camera cards and explicit default-muted synthesized sound follow this early increment.

Root action: wire callbacks.settings to the authenticated settings endpoint. The selector explicitly reports when this callback is absent. Old VM tests that strip imports must inject getMap plus owned map-model/lobby-map dependencies (or load their actual modules). Their original assertions must remain intact; this worker will not edit those tests outside tactical-client ownership. Manager retains the exclusive Chrome lease and final real browser qualification.


## Completed client milestone (2026-10-30)

The early map/selector milestone is `75f939e152db5bd8d6b5a453539793f0a7009316` (already observed integrated as51b6cf4). The completed increment adds original Annex copper/slate art over the actual immutable floors/colliders, all eight actual room names, task stations, ring/cross-deck/central/south loop thresholds and the isolated Echo spur without an invented southern connection. The original beacon painting remains on its existing branch. Per-instance map/geometry state prevents cross-map contamination. Pending/jammed/open/closed door states are displayed directly from safe projection; warning clocks never authorize/predict physical closure. Passage choices use supplied descriptors and actual Annex room names.

Camera cards use ONLY owner-dated investigation frames. Map identity, timestamp, device provenance, sampled field origin/radius/sector, limited flag and current console availability are explicit. Names/colors may come from the public roster; positions, inclusion and counts come exclusively from frame.players. Live positions, roles and current life status never substitute into a saved frame. Unsupported sample maps are explicit, not silently beacon. Older legacy samples remain readable with an explicit missing-field-boundary label. The latest eight supplied frames are drawn with a visible showing/total count; all older samples remain in the existing historical log. Camera rows/canvases preserve identity/focus during ordinary updates. Disconnected views do not claim current console availability.

The explicit Sound toggle is off by default per experience. AudioContext is constructed only by the user's toggle gesture, with quiet local sine cues for public council/vote/end/critical transitions. No voice, external asset, provider, media permission prompt or private preference persistence is added. Mute/blur/hidden/disposal stop voices; unsupported/failed audio disables safely without breaking game controls. Delayed resume cannot unmute another owner/map context or disposed experience. Browser-specific autoplay/audio-device behavior still needs native QA.

Room/match/map/phase/death/access changes invalidate old equipment and request generations. Unknown maps/versions fail visibly, stop input and retain Exit/status and the critical countdown; they never render beacon as a substitute. A map leave/return cannot revive old base-action error feedback. A revoked submission can release pending only on the same still-legal solved equipment, without old feedback or resurrecting a closed modal. Still-current errors preserve solved nodes and useful retry feedback. Existing input lease/IME/council/results/replay code and Group2 seams remain; no root/shared/backend/feature-owner files were changed.

## Final checks and exact limits

Final scoped invocation: **41 passed, zero failures/skips**. It includes the first milestone's10 cases, not10 extra independent workflows. Thirty-nine are explicit safe-view/DOM/recording-canvas/audio fixtures; two use actual schema4 engine investigation action/tick/owner projections on both maps, with a deliberately positioned stationary unit actor. There are no API response mocks claimed as full workflows. Both maps are exercised at320/390/768 canvas-command widths, actual Annex thresholds and map interleaving, settings permissions/pending/denials, unknown-map errors, equipment revocation/return, owner-only dated cards, IME/focus and local sound lifecycle. Canvas commands are not browser pixel/overflow/touch/contrast measurements.

A separately retained ESM run passed **56 checks** for beacon contexts, task/council controls, field notes, private actor observations, deferred failures/retries, movement/lease/typing and replay attribution. These checks overlap in intent and are not56 independent whole matches. Two affected current task/AbortError controls were additionally rerun during the pending-state correction; they are not added to these counts. Syntax checks and git diff/ownership checks passed.

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:TACTICAL_CLIENT_MAP_ROOT='D:/Widegames-work/tactical-maps-builder-20261029'
$env:TACTICAL_CLIENT_RUNTIME_ROOT='D:/Widegames-work/tactical-annex-coordinator-20261029'
node --test tests/tactical-client-ui.test.mjs tests/tactical-client-maps.test.mjs tests/tactical-client-samples.test.mjs
node --test tests/beacon-client-controls.test.mjs tests/beacon-client-scene.test.mjs tests/beacon-client-experience.test.mjs tests/world-ui-model.test.mjs
```

In a fully integrated checkout, omit the overrides. The foundation registry contains only beacon, so absent Annex/schema4 checks explicitly skip until actual data/runtime is provided; skipped checks are not a qualification. The optional per-instance mapResolver parameter is a pure test seam using Core's REAL getMap, not duplicate geometry; existing root calls remain the same two-argument API. Runtime/map test drivers capture sources before import and reject changes during their run. Exact external file SHA256s and tested source copies are in the receipts below; HEAD values are observed after the tests, not a claim that unrelated source was qualified.

Core source observed after checks: `736b1456dc59327d6b59417d7ea1ad8376f99f90`. Corrected north-riser fixtures were used, not the superseded19e4bf6 two-door layout. Camera engine source observed after checks: `e5ea1e6923f8516504e158d302fe5bdb3d94ac63`. The source fingerprints identify the tested files precisely. The coordinator's settings callback was read-only confirmed at dfdcea4348711986e430eeab0c17bb4112936b0e: host/pre-start guard, exact mapId/expectedRevision, root request ID and existing mutation ownership. No root changes were required here.

## Preserved failures and manager handoff

Evidence: `D:/Widegames-work/tactical-client-builder-20261029/_artifacts/tactical-client-14ea858d`.

- map-fixture-position-id-failure.log:4 passed/6 failed because the test fixture incorrectly spread a station id into self.position. The fixture was corrected to actual x/y-only safe position; the original strict camera-coordinate assertions remain. This was a fixture error, not six runtime map defects.
- base-action-map-return-red.log: reproduced an obsolete base-action rejection replacing CURRENT MAP NOTICE. The permanent local generation guard corrects it.
- current-equipment-pending-red.log: the first stronger guard left a still-legal solved modal pending on revoked success/failure. Final code releases only that existing legal equipment, and retains useful still-current error feedback. Both unchanged positive expectations pass.
- old-vm-map-import-gap.log: the TWO selected retained world-ai-ui-review draw tests in this worker fail before their assertions with ReferenceError getMap is not defined. This is an import-stripping harness gap; its assertions were not weakened or edited. Real ESM draw checks above pass. Full old VM suites were not run as a substitute for this scoped work.

Manager must update retained VM dependency injection: real shared/maps getMap plus annex-art annexPalette/drawAnnexDecor for scene; map-model mapKey/equipmentOwner/roomName (as mapRoomName), lobby-map createLobbyMapSelector and sound createLocalSound for the experience. DOM-using modules should execute in the fixture's document/window realm; they should not become no-op stubs. The existing beacon-scene dependency injection remains required. Further beacon-only VM fixtures may also need these actual imports. This worker owns only tactical-client test names, so those retained harness files remain unchanged.

Manager retains the exclusive Chrome lease. No Chrome/server/profile was started; no owned process needs cleanup. Actual native/mobile/audio and complete human/all-AI matches, multi-saboteur fairness, persistence/reconnect/replay and end-to-end privacy qualification remain coordinator-owned. No release approval, main/push/deployment or paid call is implied by these client checks. All earlier evidence/branches/worktrees remain preserved.


## Mandatory compatibility closure, 2026-10-30

The preceding VM import gap is now closed under the explicit expanded test ownership. Runtime fix commit: `7d0f9340faf1499a7aaaf00201eda538f3588767`, based on client `7409ec6beebd39365f74229ff1460cc9eeb5cad3`. Only world runtime/CSS, owned tactical tests and the three assigned legacy VM fixtures changed; root/scripts/shared and every sibling worktree remain untouched.

`Array.map` calls callbacks with `(value,index,array)`. The third array was being interpreted as the optional map descriptor by `interactionLabel`, causing `map.fixtures.doors` to throw. The helper now accepts only actual descriptor-shaped overrides. One-argument callbacks, explicit second-argument map descriptors, and the existing `(hint,game,map)` call all work. Regression assertions cover distinct door targets, actual Annex hatch names and both real map descriptors; no substitute geometry is supplied.

The retained VMs now inject real getMap, map-model, beacon-model, beacon-scene and Annex art dependencies. DOM-using lobby, sound, camera and panel modules execute in each fixture document/window realm. Existing draw/input/phase instrumentation remains as before. Every assertion-bearing line is unchanged: world-ai-ui-review 23 lines, world-ui-task-feedback 14, observer-labels 7. The historical 9e negative-control test still reproduces its historical stale rejection, while all current ownership assertions pass. No runtime change was made to accommodate missing VM globals.

Read-only browser evidence: coordinator `_artifacts/tactical-browser-1WPMSu/report.json` pins `b9c1a442b88024f659ea05e40b00737b6562413f`, 15 observed passes/1 failure, with screenshot `beacon-saboteur-failure.png`. The full-stage council backdrop visibly covers the Sound: on control. Actual game.css places that backdrop at z-index 10, while the old sound rule was 7; Puppeteer's visible/enabled locator can click the covering backdrop. The mute branch itself sets aria-pressed=false synchronously before awaiting anything. This is a covered-control defect, not evidence that audio suspension blocks the handler. The scoped sound rule now uses 25, above the council backdrop and existing systems controls; its target remains at least44px. A cascade assertion fails against old CSS, and a real imported UI/fake AudioContext council test proves synchronous mute, stopped voices, preserved draft and inert subsequent updates. Native hit-testing, responsive overlap and real audio hardware remain manager QA. Manager should retain an explicit wait for aria-pressed=false after the native mute click, and can inspect elementFromPoint at the button center if it times out. No browser script was edited here.

Preserved evidence directory: `D:/Widegames-work/tactical-client-builder-20261029/_artifacts/tactical-compatibility-20261030`.

- `before-tests.log`:39 tests,5 pass/34 fail; failures include the callback regression plus missing VM dependencies. Original sources are under `before/` with SHA256s.
- `new-boundaries-before-runtime.log`:3 focused counterexample checks against isolated copies of the original runtime,1 pass/2 fail (Array.map callback and covered mute). No original evidence was overwritten.
- `focused-all.log`:174 pass/0 fail/0 skip across assigned legacy and tactical files, with the browser-only driver omitted from this browser-free command. This total includes the earlier tactical/legacy checks; it is not174 independent full matches or additional browser workflows.
- `assertions-preserved.json`, `candidate-sha256.json`, `browser-evidence-fingerprints.json` and `external-sourcepins-before.json` record exact candidate, assertion and source identities. `external-source-stability.json` reports no changes in any fingerprinted dependency during the run. Coordinator source was `e5c570aab68a924a92b9f79a71228cb6efced829` (its unrelated world-browser script was modified); actual Core maps were `33deeb78fdad186e0c5abc971eeeaa16edf6745f` and clean. This does not qualify the manager's unrelated modified script.

Exact focused command, from this worktree:

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
$env:TACTICAL_CLIENT_MAP_ROOT='D:/Widegames-work/tactical-maps-builder-20261029'
$env:TACTICAL_CLIENT_RUNTIME_ROOT='D:/Widegames-work/tactical-annex-coordinator-20261029'
$env:BEACON_CLIENT_SYSTEMS_ROOT=$env:TACTICAL_CLIENT_RUNTIME_ROOT
$env:BEACON_CLIENT_INVESTIGATION_ROOT=$env:TACTICAL_CLIENT_RUNTIME_ROOT
$env:BEACON_CLIENT_RUNTIME_ROOT=$env:TACTICAL_CLIENT_RUNTIME_ROOT
$env:BEACON_CLIENT_ROOT_REVIEW_ROOT=$env:TACTICAL_CLIENT_RUNTIME_ROOT
$env:WORLD_UI_ROOT_REVIEW_ROOT=$env:TACTICAL_CLIENT_RUNTIME_ROOT
$files=Get-ChildItem tests/beacon-client*.test.mjs,tests/world-ui*.test.mjs,tests/world-ai-ui-review.test.mjs,tests/tactical-client*.test.mjs | Where-Object Name -ne 'world-ui-browser.test.mjs' | Select-Object -ExpandProperty FullName
node --test $files
```

Changed MJS syntax checks and git diff --check pass. No Chrome, server, audio hardware, network/provider or browser profile was started. Manager keeps the exclusive Chrome lease; no owned processes remain. Native qualification, main integration and publication remain manager-owned.
