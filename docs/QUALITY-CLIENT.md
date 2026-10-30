# Quality client working receipt

Foundation941e857f046ef7cc9bae25f0fcad27cf6ab7578a; work only ship-quality-client-20261030. No Chrome lease, providers or other-worktree edits.

Early station API handoff: retain createTaskPuzzle(options). Station instances will add update(task,{pending,connected}) to ingest only actual server projections while preserving same-control focus/drafts. Existing onSubmit will receive only {interactionId,value}; experience captures taskId/session and calls taskInteract. It will use returned real room and/or root update, never a local solved/completed flag. Equipment closes on owner/map/match/phase/death/access changes. Legacy3 puzzles and their no-argument submission remain unchanged. Foundation has only shared/station-contract.mjs; the manager's exact puzzle/progress shapes are requested before implementing projected field access. Rendering/cache work proceeds independently. MotionTrack optional isolated module remains Core-owned.

Baseline source is preserved under _artifacts/quality-client-20261030/baseline with fingerprints. Measurements are actual canvas command-dispatch/cache traces and bounded cache bytes, not invented FPS/GPU/physical-device results. Native final QA remains manager-owned.


Early renderer milestone: original layered deck/furniture/station art uses actual immutable geometry; unbacked metadata solids are rejected. Static tiles are256 logical px, capped32 tiles/8MiB per scene, no full-world/DPR2 bitmap. Overview uses vector drawing; exceptional viewports needing more than32 tiles use a vector fallback. Cache is per scene/map descriptor and released on dispose. Camera uses elapsed time, with a100ms resume bound; reduced motion snaps to observed positions. New scene imports require real camera/environment/static-layer helpers in import-stripping legacy VMs; no assertions or old fixtures were changed here.

Four focused ESM checks pass. Initial frozen941e comparison (120 warm frames, reduced-motion Beacon1, one safe keeper) recorded229560 baseline canvas dispatch/property operations versus78000 at320x740,78600 at390x844 and80520 at1440x1000. Warm caches15/20/24 tiles used3.75/5/6MiB respectively and did not rebuild. Initial JS dispatch time was32.42/31.49/26.83ms baseline versus10.62/9.79/10.86ms candidate across120 frames; these are noisy Node/counting-surface CPU timings, NOT native painting, GPU time or FPS. Exact artifact: _artifacts/quality-client-20261030/render-benchmark.json. Later runs retain their own timing records; no physical-device performance is claimed.

Station challenge source is now available read-only from coordinator9c822ea4 and Beacon2 metadata from map owner695bf4e8 (later working edits are not called committed). Exact shapes will be used for the six state-driven task controls in the next scoped milestone. No need to wait for root HTTP implementation.


## Completed owned client candidate

Six state-driven station panels are implemented in public/features/tasks/station.mjs, selected by the existing createTaskPuzzle factory only when task.kind is station. Circuit matching uses symbols and words; signal has a native range and explicit transmit; sequence uses displayed numbered controls; glyph inspection has9 selectable tiles and explicit verification; rotor alignment uses native direction selects; manifolds open in ascending displayed order. None locally claims task completion or sends a trusted solved flag. Legacy3 puzzle code remains intact.

The exact station API is update(task,{pending,connected}) plus existing node/focus/setPending/dispose. onSubmit receives only interactionId/value. Experience captures taskId, room/match/map/actor lifetime and immutable challenge identity, calls taskInteract through the existing callback, and consumes a returned real room envelope or subsequent root update. Pending/error/progress updates preserve node identity and local slider/dial values. Current rejected input remains useful; old failures cannot change current feedback across council, room/match/actor/map changes, challenge replacement, hidden/death/transit/access loss. Changed challenges revoke their old controls; disposed close/input handlers cannot close replacement equipment. Confirmed station completion releases owned equipment; keyboard focus returns to the world only for the still-current roam scene. No HTTP, keys or storage are added.

Beacon2 metadata is consumed through the actual map-owner registry:14 distinct material palettes, original trim/glass/pipes/plants/benches/lockers/crates/turbines, collider-aligned raised furniture, real corridor thresholds and doorframe endpoints. Metadata cannot introduce a collider that does not exist, and actual geometry solids remain illustrated. Room/station geometry is never changed here. Camera-visible scenery is culled; static cache is map-specific and bounded. The larger map pane uses numbered canvas room markers with a matching readable room key; full room names remain on the main stage. The separate mute/equipment rail is retained. Task layouts use native keyboard controls and at least44px targets in320/390 portrait and short landscape; actual layout/hit-testing awaits native QA.

### Core movement integration handoff

The scene accepts optional motionFactory; experience forwards its local direction-only inputs and clears presentation on blur/hidden/dispose and room/map changes. Actual Core MotionTrack was exercised read-only, including immediate bounded self intent and hidden actor revocation. It retains the Core samples Map shape. The reserved public/world/movement.mjs was NOT copied or edited here. Until manager binds the factory, the existing ActorSamples fallback remains active. Root binding (manager-owned) after integrating Core's helper:

```js
import {MotionTrack} from './world/movement.mjs';
createWorldExperience(host, callbacks, {
  motionFactory: options => new MotionTrack(options)
});
```

This is the only remaining root hookup requested by this client. Manager already owns task HTTP/room handling; callbacks.action returning {room} and root-driven updates both work. Station instructions and controls use the actual coordinator station-challenges module, not a reimplementation. Import-stripping legacy VMs need the real station factory plus camera/environment/static-layer helpers; do not replace them with no-ops or weaken assertions. Actual-scene far-room label assertions must account for viewport culling and numbered overviews with the room key; full hidden/off-screen labels are no longer painted every frame.

### Evidence and tested limits

Artifacts: _artifacts/quality-client-20261030. final-focused.log passed102/102 with no skips:27 new render/station checks plus75 retained ESM input/context/IME/modal/sound/old-map checks. Then render-final.log passed7/7 after adding the Beacon2 DPR2 budget trace;6 overlap that102, so this is103 unique bounded checks, not109 independent cases or complete native matches. The actual schema5 engine test creates a seeded real match, explicitly positions its unit actor at a generated station and drives the real experience callbacks until accepted completion. It is an engine/UI module fixture, not an HTTP walking workflow. All six challenge kinds separately use the actual pure authoritative transition module. No API response or winner was mocked for a claimed full workflow.

render-benchmark-1793344216854.json is the last equal-Beacon1 frozen941e comparison over120 warm frames. Counts229560 baseline versus78000/78600/80520 candidate at320/390/1440 widths (66.0/65.8/64.9 percent fewer canvas dispatch/property operations). Local JS dispatch timings29.81/35.45/22.08ms baseline versus10.04/8.53/9.51ms candidate across120 frames are noisy counting-surface CPU measurements, not FPS/native GPU performance. Warm cache bytes3.75/5/6MiB; no rebuilds. beacon2-cache-1793344216893.json records actual14-room data at DPR2 over60 frames across three explicitly repositioned unit camera views per size:58345/58405/59848 dispatches at320x740/390x844/844x390, with9.47/9.49/11.24ms JS dispatch time. Every cache surface remains256x256 logical pixels; at most32 tiles/8MiB nominal RGBA pixels retained. There is no3200x2400 DPR2 world bitmap. Vector fallback/overview, culling, descriptor changes and dispose are tested. No physical memory profiler or GPU/native battery result is implied.

station-sourcepins.json, render-sourcepins.json and render-final-sourcepins.json verify actual engine/shared/map/motion dependencies unchanged during their respective runs. candidate-receipt.json records client SHA256s and externally observed commit/status after tests; its hashes, rather than an ambient HEAD claim, identify exercised source. At final observation manager was a20cf920f9e0f4f438f0bdabf730a3762add667d with only unrelated tactical tests modified; Core a34d9797a2c77b8b59b51d4bc257b5281529c353 and maps5523c06c01099da691dd64e0d9d1ad7438e3bf26 were clean. The earlier source/benchmark receipts remain preserved. Changed MJS syntax and git diff --check pass.

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:QUALITY_CLIENT_RUNTIME_ROOT='D:/Widegames-work/ship-quality-coordinator-20261030'
$env:QUALITY_CLIENT_MAP_ROOT='D:/Widegames-work/ship-quality-maps-20261030'
$env:QUALITY_CLIENT_MOVEMENT_ROOT='D:/Widegames-work/ship-quality-core-20261030'
node --test tests/quality-client-render.test.mjs tests/quality-client-stations.test.mjs tests/world-ui-model.test.mjs tests/beacon-client-controls.test.mjs tests/beacon-client-experience.test.mjs tests/tactical-client-ui.test.mjs
```

In an integrated checkout, leave runtime/map overrides unset; those tests use its real modules. Core motion delegation tests currently need QUALITY_CLIENT_MOVEMENT_ROOT unless the test is extended to load the integrated helper. The declared foundation skips only absent new map/station/motion module checks, not a failing available implementation. This phase used no Chrome, server/browser profile, external assets, provider, main/push/deployment or production approval. Manager retains the Chrome lease and final desktop/mobile full-match qualification. No owned long-lived processes remain.
