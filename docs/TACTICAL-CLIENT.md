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
