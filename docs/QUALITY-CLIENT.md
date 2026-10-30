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


## Mandatory default walking-presentation closure

This supersedes the earlier optional MotionTrack root-binding handoff. Actual production defaults now use the delivered Core helper automatically: ActorSamples imports MotionTrack and delegates update/at/clear/samples for real world views; createWorldScene constructs that safe sampler with its actual map resolver. The existing ordinary experience input callback already forwards direction-only intentions and clears presentation on blur/hidden/dispose and owner changes. No root factory is required. The optional factory remains compatible, but it is not the safety mechanism. Core movement.mjs is a mandatory integration dependency from managerf7af9d6f0a0eb42ae5f26e4701037e693878713b; it was neither copied into the tracked client tree nor edited.

Production world views carry map/beacon identity or worldVersion plus version/rooms. All such views delegate, including the actual schema2 legacy world and schemas3/4/5. The only mathematical compatibility path is for raw fixtures lacking all production identifiers (map/beacon/version/rooms); the historical small Cartesian tests use worldVersion1 but have no version/rooms/map and positions unrelated to real geometry. Their140ms arithmetic is retained and tested explicitly. No coordinate-based exception or opt-out is applied to real world data. The normal scene forces the geometry-aware path even for minimal supplied views.

The prior per-draw exp(-dt) still sampled an interpolating target at frame cadence and capped the first draw after a snapshot gap. Camera now has a deterministic snapshot-anchored curve. Every accepted view update first evaluates the old curve at that arrival time, then anchors easing to the new authoritative observed origin. Draws evaluate that curve without changing it. The target is independent of Core's bounded actor prediction/interpolation, so preview cannot extend what camera follows. Reduced motion snaps to the observed target; room/match/map/actor/phase/transit context changes and suspend reset it; jumps above600 world units snap. Old same-owner time/version updates are ignored. Default actor intent remains collision/LOS/lease bounded by Core, and hidden/unknown actors are forgotten.

The unchanged Reviewer source at D:/Widegames-work/ship-quality-audit-20261030/tests/quality-review-initial.test.mjs was run directly, read-only. Its SHA256 is `6c8affc77685208e0edf32b589ff6c32fa1ea689658c7452145508e5f9f767fa`. No assertions, expectations or names changed. Baseline exact9cb UI over managerf7 real engine/maps/helper reproduced2 failures: chart-table displayed point(800,200), and30/120Hz equal200ms camera gap8.45240863951176. Both positive controls now pass against the candidate overlay. No closure claim rests on a replacement negative expectation.

Evidence: _artifacts/quality-walking-closure-20261030. baseline and candidate contain a Git archive of exactf7 public/server/shared/package source; candidate overlays ONLY this worktree's public/world files except reserved movement.mjs. source-manifest.json pins every original file, Reviewer source and baseline overlay. The final verification confirms server/shared/Core helper bytes still exactly match f7 and only camera/model/scene differ in the candidate runtime. closure-receipt.json records all three candidate runtime hashes and test-source identity. Core helper SHA256: `d6e2ab4a00ba744b6d84674dcfa068d0775a8709b4ea1e1d87e7bb92a85801d6`. This is a source/module composition qualification, not a new committed manager runtime or native qualification.

- reviewer-red.log preserves the actual original2 failures; reviewer-final-green.log records the same2 passing with no skips.
- walking-final.log:10 pass/0 fail/0 skip. It checks default ActorSamples safety, normal experience keyboard entry without a factory, bounded intent/stop/blur clearing, hidden/old-version revocation, actual full-scene cadence over snapshot gaps and moving targets, reduced motion/owner/large-jump resets, and all3 unchanged legacy minigame interaction/submission paths.
- walking-metrics.json: full-scene elapsed1400ms at24/30/60/120/144Hz, with snapshots at0/1000/1090/1225ms, yields exactly the same camera(906.4251563003999,300), maximum gap0 world units. This is a transform/cadence result, not FPS or GPU speed.
- station-retained.log:21 pass/0 fail/0 skip, including six actual challenge kinds, real schema5 engine progress and stale callback ownership. These are retained module cases, not21 additional browser matches. Manager normal startup station flag remains false; explicit stationTasks:true is what this fixture qualifies.
- reviewer-archive-setup-failure.log retains the initial archive-format setup error (tar was incorrectly read as ZIP), not a product failure. walking-first.log retains6 pass/1 fail when the new normal-intent fixture accidentally selected reduced motion; the fixture now explicitly uses normal motion, while its unchanged bounded-displacement assertion passes and the separate reduced-motion positive case still verifies snapping.

Reproduction after materializing the pinned overlay described above, from this worktree:

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:QUALITY_CLIENT_WALK_ROOT='D:/Widegames-work/ship-quality-client-20261030/_artifacts/quality-walking-closure-20261030/candidate'
$env:QUALITY_REVIEW_ROOT=$env:QUALITY_CLIENT_WALK_ROOT
node --test tests/quality-client-walking.test.mjs
node --test --test-name-pattern='rendered samples of a real accepted detour|camera position after equal elapsed time' D:/Widegames-work/ship-quality-audit-20261030/tests/quality-review-initial.test.mjs
$env:QUALITY_CLIENT_RUNTIME_ROOT=$env:QUALITY_CLIENT_WALK_ROOT
node --test _artifacts/quality-walking-closure-20261030/candidate/tests/quality-client-stations.test.mjs
```

In the integrated checkout the new walking driver defaults to its current real source; no archive or old pin is silently selected. This isolated client foundation intentionally lacks the reserved Core file, so use the genuine integrated overlay until manager composes the dependency. Legacy import-stripping VMs must inject the real MotionTrack/ObservedCamera dependencies; runtime does not fall back because a harness stripped imports. Syntax and git diff --check pass. No public game.css, root/server/shared/other-worktree edits, Chrome, server process, full suite, providers, main/push/deployment or production approval. Manager/Reviewer retain the Chrome lease; native walking qualification is next.
