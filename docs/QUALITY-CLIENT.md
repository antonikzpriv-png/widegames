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

## Bounded UI regression audit (before latest-main integration)

Pinned runtime: f6cb78b4c61e0859fcf0d0ddb5a8171d87e20789 with this client overlay. Evidence is preserved in `_artifacts/quality-ui-regression-audit-20261030`, including original sources, source-manifest.json, counterexamples-red.log (7 pass / 4 fail), all green logs and closure-receipt.json. Server/shared and reserved Core helper fingerprints remain unchanged. Four failing checks exposed three defects: cancelling a pending station lost focus to BODY; obsolete council chat/vote rejections changed current-match feedback; disposed legacy puzzles still invoked close handlers.

Pending cancellation now falls back to the still-valid world canvas when disabled USE cannot receive focus. Council promises are guarded by match/meeting/actor/phase generation plus suspension/disposal; stale success cannot clear a replacement draft and stale/abort failures cannot overwrite feedback. Disposed legacy close/Escape handlers are inert. Existing APIs and current failures with useful retry remain intact.

The render delegation check now imports the local available Core helper by default, records its fingerprint, and has no optional-helper skip. An explicit dependency-root override remains supported. The isolated client foundation lacks the reserved tracked helper; the test was run from an ignored genuine integrated overlay with no movement override, rather than substituting a helper.

Checks: audit-final-green.log 13 pass / 0 fail / 0 skip; helper-local-after.log 1 pass / 0 fail / 0 skip; focused-retained.log 11 pass / 0 fail / 0 skip. The 13 adversarial module/DOM controls cover pending cancel, death, room return, authoritative task completion, glyph pending ABA/current rejection, council match and draft ABA, IME, suspension/disposal and pointer cancellation/resource cleanup. Deferred callback fixtures are unit controls, not claimed HTTP workflows. Retained controls cover the six real challenge transitions, real schema5 progress, normal keyboard entry and all three legacy puzzles. Commands:

```powershell
$env:QUALITY_CLIENT_AUDIT_ROOT='D:/Widegames-work/ship-quality-client-20261030/_artifacts/quality-ui-regression-audit-20261030/runtime'
node --test tests/quality-client-regression-audit.test.mjs
# From the real integrated runtime, without QUALITY_CLIENT_MOVEMENT_ROOT:
node --test --test-name-pattern='scene delegates actual Core motion intent' tests/quality-client-render.test.mjs
```

Source/syntax and diff checks passed. These counts are bounded module checks, not independent full matches. No Chrome/native server/full suite/provider/main/push/deployment was used. Reviewer retains Chrome; no owned long-lived process remains. Earlier red evidence and historical receipts are unchanged.


## Owned latest-main semantic merge resolution

Resolution branch `codex/ship-quality-main-ui-20261030`, separate D: worktree `ship-quality-main-ui-20261030`, starts from quality base `047ae494128fb76f7e474fac2cd8193a13add178`. Main side is exact `43c079999506785196ab85750105ceb102ba9314`. Coordinator merge stages 1/2/3 were read-only inputs. Original audit branch remains clean at `5a01347faaad28d9b202f1a84eb28540a16dbec0`; its three reproduced fixes, mandatory local-helper assertion and original red artifacts are preserved. This commit contains owned final blobs for manager review/install, not a broad merge or permission to discard other owners' conflicts.

Semantic choices:

- Main five authoritative progress panels (wires/tuning/sequence/pressure/repair) retain taskStep, server-confirmed indexes, diagnostic timing and final task submission. Station kind dispatch takes precedence and retains all six challenge panels/taskInteract; all three metadata-free legacy puzzles remain. Current failures retain useful equipment feedback, while room/match/map/access/death/progress ABA invalidates stale feedback. Pending cancel returns focus to valid USE or the world canvas. Council keeps audited async generation/IME/draft/suspension guards and main's fallen-channel guidance.
- Main ghost task movement and private fallen chat/presets are retained using shared canViewAct. Core MotionTrack remains the production default and was not edited. Because the delivered helper excludes dead actors, ActorSamples adds only the explicitly projected owner ghost at its received position, held without prediction/interpolation; hidden actors are not added. Normal living movement, deterministic camera, cache, detailed original environment, exact versioned maps and leases remain. Ability Ward/Echo controls and permitted effects remain; beacon actions require exact descriptors and legacy schema2 retains its target selector. Spectator follow options use supplied roster IDs, unknown status stays unknown, and only supplied positions can be followed.
- Main spatial replay toolbar, clock, role toggle, historical perspectives/claims, bookmarks, ballot/history text and cancellation/disposal remain. Geometry now comes from exact ended game/response map; custom supplied roster is used directly. Playback uses recorded points/routes without live prediction, accepts backward seeking and paints the cached detailed environment. Recorded station opening does not claim completion; explicit task_progress completion drives that status. Earlier visibility/claims are labeled reconstruction, not model knowledge.
- Actual screenshot inspected read-only: `D:/Widegames-work/ship-quality-audit-20261030/_artifacts/quality-browser-911522d-mRR2cL/watch0-glyph-grid-320x740.png`. Its Close station sits behind the top bar. Narrow/short equipment overlays now reserve 105px above and the existing 60px bottom rail, bound the whole panel to remaining height, scroll all contents and retain a sticky equipment header. Critical layout keeps its larger reserved area. No controls are hidden. CSS contract checks cover 320x740,390x844,844x390; these are source/geometry checks, not measured browser rectangles. Native qualification remains required.

### Coordinator/Core interface handoff

Root must combine existing callbacks without narrowing them: `settings(mapId)`, `start({deathPolicy,abilities})`, `action(type,fields)` for both `taskStep {taskId,step,input}` and `taskInteract {taskId,interactionId,value}`, direction-only `input`, and `loadReplay({signal,matchId})`. Returning a real room or `{room}` updates accepted station/progress controls; independently accepted root updates also work. Keep root task/progress/challenge action-context ABA guards and best-effort keepalive stops. shared/features.mjs (main) and the genuine reserved Core helper (quality) are required imports. No extra optional motion factory binding is needed.

Beacon Ward/Echo contexts require exact enabled `protect {targetId}` / `decoy {x,y}` descriptors; legacy non-beacon actions retain main's capability/target path. Root/Core must emit these descriptors if enabling abilities in beacon schemas. The scoped beacon descriptor parser accepts these exact fields without adding actions by hidden-target inference.

Concrete cross-owner replay gap: main shared/replay.mjs validator is still fixed to p1..p6, six classic rooms,1600x1200 coordinates and its legacy metadata map tag. UI now passes an optional third `{map:{id,version},players}` context to validateReplayMetadata; the old validator ignores it. Coordinator/Core must resolve its metadata/history generation/validation for actual map2/Annex/custom roster/station histories. This UI does not bypass validation or silently claim those metadata workflows pass. New map-specific UI tests use explicitly labeled metadata-free recorded-event fixtures; unchanged legacy metadata tests still pass. The full manager merge is not qualified by this UI composition.

### Evidence and bounded checks

`_artifacts/main-ui-resolution` retains all conflict-stage files, initial audit harness failure, missing-dependency replay setup failure, logs, two explicit runtime overlays and resolution-receipt.json source fingerprints. Primary overlay is exact047 public/server/shared with main shared/features.mjs, shared/replay.mjs, public/presentation.mjs and pure server/engine/tasks.mjs, plus candidate owned UI. Legacy replay overlay is exact43 main public/server/shared plus genuine quality map/helper/station dependencies and candidate UI; it runs the two unchanged main replay files with their real main engine fixture. Neither overlay pretends coordinator's unresolved root engine/app has merged. Reserved helper and archived backend/shared dependencies are fingerprint-checked; source pins record both compositions.

- integration-final.log:28 pass/0 fail/0 skip (15 semantic integration controls plus retained13 audit cases).
- quality-retained.log:31 pass/0 fail/0 skip (10 default walking/legacy plus21 six-station/lifecycle cases).
- main-replay-retained-2.log:14 pass/0 fail/0 skip; main replay model/lifecycle assertions unchanged.
- reviewer-retained.log:2 pass/0 fail/0 skip; unchanged independently authored legal-detour and actual-scene cadence assertions, executed read-only.
- helper-local.log:1 pass/0 fail/0 skip, local real Core helper with no movement-root override.

These bounded checks overlap behavior and are not independent complete matches. Initial audit-first.log failed because the glyph assertion counted the new spectator Overview pressed button globally; it now scopes to equipment without changing glyph expectations. main-replay-retained.log preserves two module-load failures from an omitted genuine beacon dependency before setup was completed. No runtime test failure was hidden. Syntax and diff checks pass. No Chrome, native server, full suite, providers, main/push/deployment, other-worktree edit or production self-approval. Reviewer retains Chrome. No owned long-lived processes remain.

```powershell
$env:TEMP='D:/Widegames-work/temp'; $env:TMP=$env:TEMP
$env:QUALITY_CLIENT_MERGE_ROOT='D:/Widegames-work/ship-quality-main-ui-20261030/_artifacts/main-ui-resolution/runtime'
$env:QUALITY_CLIENT_AUDIT_ROOT=$env:QUALITY_CLIENT_MERGE_ROOT
node --test tests/quality-client-main-integration.test.mjs tests/quality-client-regression-audit.test.mjs
# In a completed integrated checkout, leave both overrides unset to test local current source.
```


## Final bounded replay2 / ghost-station composition audit

This supersedes the earlier missing shared replay2 reader gap: root now supplies actual version dispatch via shared/replay.mjs -> replay-v2.mjs -> replay-common.mjs, read from its working/staged files, plus docs/QUALITY-MAIN-REPLAY-CONTRACT.md. Version1 strict readers were not edited. Test composition is a fresh Git archive of Core `1c228a0f57af934ad4d71fa5d408dda249be33a2`, UI `55858ffdbbe37a6fc3de1d49069d631fa85b9a02`, actual root working replay validators/features/contracts/presentation, then only the two candidate owned UI corrections. All source is frozen under `_artifacts/replay2-ghost-closure-20261030/runtime`; source-manifest.json records root working-file SHA256s and every original dependency. Backend/shared/reserved movement bytes are verified unchanged after runs; test-level hashes reject runtime changes during each run. closure-receipt.json pins candidate files and actual results.

Three UI findings were reproduced before correction. Metadata-only v2 selected Beacon1 and rejected real map2/Annex geometry; taskInteract replay kept the initial challenge despite recorded completed=true; and a ghost's USE rail remained hidden despite canViewAct keyboard support. UI now validates metadata before resolving exact metadata.map, rejects a conflicting caller/response map, derives a missing roster from the actual anchor rather than assuming six actors, and retains clear room/match errors. Recorded stationChallenge evidence is validated, checked against known station identity and completion, then copied into reconstructed progress. Unknown task assignments in an explicitly partial history remain unknown while their validated dated log stays available. The action rail now uses canViewAct so permitted ghost USE is visible; other ghost combat/report/ability buttons remain hidden. No server permission is invented.

The actual generated fixtures use14-room Beacon2 with12 custom keepers and8-room Annex1 with8 custom keepers (14 is a room count, not an unsupported14-seat roster). Both are schema5 with ghost-tasks/abilities, and real engine actions complete every crew station until an actual crew-task victory. Actors are explicitly positioned at stations to bound this pure-engine fixture; it does not claim walking/navigation/HTTP/native workflows. Actual Core getReplay/getReplayMetadata supplies the ended envelope; it intentionally has no response.map, only metadata.map. The real createReplayModel and createSpatialReplay consume it, assert exact geometry/rosters/challenges, and use the actual seek range control backward/forward. An actual engine deadline tick produces paused state. Live/paused replay/metadata/snapshots stay unavailable; living/spectator projections contain no private fallen message or hidden ghost position. Actual owner ghost chat form submission renders the returned real room's new private message; it is absent from living/spectator views and replay.

### Concrete remaining Core blockers at exact1c228a0

The owned positive assertions remain RED; do not call the complete ghost station workflow qualified:

1. server/engine/index.mjs featureHints returns [] for `!p?.alive`. Actual dead-crew ghost tasks are accepted by taskInteract and appear in self.tasks/availableActions, but no exact enabled task descriptor reaches interactions. UI correctly cannot open that ghost station. Change Core's hint entry guard to the real permitted canWorldAct path and still emit only actions accepted by denial; do not enable living-only systems for ghosts.
2. The same featureHints emits task/eliminate/report/meeting plus Group1 service hints, but no protect/decoy rows. An actual Ward owner has protect in availableActions while interactions has no exact protect{targetId} descriptor; Echo similarly needs decoy{x,y}. The positive test fails first on Ward. This is source-confirmed in both exact1c and coordinator's observed working index, despite the earlier handoff statement that these descriptors were delivered. The existing UI exact descriptor parser remains unchanged.

No shared/validator naming or field-shape blocker remains for the tested v2 metadata. These two hint gaps belong to Core/coordinator; frontend does not synthesize missing descriptors or edit their runtime.

### Results and retained evidence

- replay2-red.log: initial8 controls,1 pass/7 fail, preserving the original UI failures.
- final-composed.log:13 controls,11 pass/2 fail/0 skip. Both failures are the exact Core affordance gaps above. The corrected UI and map/challenge/privacy/current-chat controls pass.
- legacy-final-retained.log:14 pass/0 fail/0 skip; the two original main spatial-replay test files and assertions are unchanged. legacy-retained.log preserves the initial13 pass/1 fail when moving validation changed the expected wrong-match error; error ordering was corrected and the unchanged assertion now passes.
- replay2-first-green.log is historical5 pass/3 fail: two viewer fixtures called the low-level clock.seek without changing the viewer's causal event limit; those fixtures now use the real seek input. No viewer assertions or runtime behavior were weakened. The third was the retained Core ghost descriptor failure.
- partial-station-red.log preserves the additional partial-history counterexample before the new strict station reader was adjusted to retain unknown assignments.

The focused driver records dependency hashes and fails on changes during a run. The explicit partial-record fixture is derived from actual ended event data but intentionally removes its prior assignment anchor; it is a contract boundary fixture, not a claim of an engine-produced truncated envelope. DOM/canvas calls use a minimal local surface; no Chrome, physical phone, GPU/audio or full manager runtime qualification is implied. Syntax/diff checks pass. No root/shared/Core/movement/other-worktree edits, Chrome/native server/full suite/providers/main/push/deploy or self-approval. Coordinator retains the native Chrome lease; no owned process remains.

```powershell
$env:TEMP='D:/Widegames-work/temp'; $env:TMP=$env:TEMP
$env:QUALITY_CLIENT_REPLAY2_ROOT='D:/Widegames-work/ship-quality-main-ui-20261030/_artifacts/replay2-ghost-closure-20261030/runtime'
node --test tests/quality-client-main-replay2.test.mjs
# Expected at exact Core1c:11 pass /2 fail. Keep both positive assertions for Core closure.
```


## Final owner UI self-check at manager f9b3215

Exact source `f9b32151e4dfab4f2525cee067a9859cd1a27dff`, archived from the repository into `_artifacts/final-ui-selfcheck-f9b3215/runtime`. This is the UI author's own product self-check, not independent review/production approval. No source overlay or dependency substitution is used in this run. Manifest records every archived file; full post-run verification found no changed bytes. Root incorporates61 plus the Core ghost descriptor and permission-validated Ward/Echo fixes, including self-Ward-first. Historical exact1c red results above remain history and have not been rewritten as failures at f9.

Requested unchanged checks ran ONCE together against only that frozen archive, without runtime overrides:13 replay2 +14 main legacy replay +13 lifecycle/input audit =40 pass /0 fail /0 skip. Both owned test files equal the frozen root versions after Git newline normalization; main legacy files are the unchanged source assertions. Evidence requested-checks.log/source-manifest.json/closure-receipt.json contains exact sources/results. These overlap manager's earlier reported checks, so this is not an additional independent41-case/full-match qualification. Metadata2 both maps/custom rosters, station evidence, actual paused/live privacy, actual ghost station and private message flows, and legacy replay/lifecycle now pass in the real composed root. No Chrome/native server/full suite/provider was used.

### One new reproduced product defect (left for coordinator resolution)

`tests/quality-client-main-ward-selection.test.mjs` adds one focused positive counterexample, run once against that same exact archive:0 pass /1 fail. A real generated Beacon2 match gives the Ward owner p4 an exact permitted descriptor for p2 as well as the first self-Ward descriptor. The visible target selector offers and selects p2. Clicking WARD submits protect{targetId:'p4'}, accepted by the real engine, rather than selected p2. The action handler only honors the selector for non-beacon schemas while beaconContexts chooses the first Ward descriptor. This is a visible selection/action mismatch, not a rejected-permission or simulated HTTP workflow. It was reported promptly; no runtime files were edited under this docs/test-only task.

Concrete correction: build beacon Ward options from exact enabled protect descriptors, synchronize the initial option with the active descriptor (self may remain default), and on activation choose the matching still-enabled descriptor for the selected target. Submit a clone of that descriptor's fields; reject revoked selections rather than guessing a target. Preserve legacy schema2 selection, current request guards and all owner/privacy checks. Keep the positive counterexample unchanged for closure. Evidence ward-selection-counterexample.log preserves actual p4 != p2 failure.

### Guide/source semantics review (root documentation fixes needed)

- README's first duplicate victory/rules paragraph still says all unfinished work transfers and critical repair requires two crew in Engine; remove it or scope it to legacy schema2. The following paragraph correctly describes current two-site repairs and muster redistribution. Its linked docs/QUALITY-VERIFICATION.md is absent at exact f9; add the intended final receipt or correct that link.
- docs/QUALITY-RULES.md line5 incorrectly limits station inputs to living crew; permitted ghost crew now use the same six station challenges. Its line9 and docs/QUALITY-REFERENCE.md lines15/17 still frame merged ghosts/abilities/strategic mode as unimplemented Group2 seams. State actual optional presets/strategy and retain the default transfer/hybrid distinction.
- docs/WORLD-TASKS.md's general opening describes five station types; explicitly scope those taskStep/progress instructions to schema2. Normal match5 has four different jobs drawn from six original challenge kinds through taskInteract. README already makes this new/old distinction correctly.
- docs/GHOST-ABILITIES.md task-transfer/protocol prose is the old schema2 account: immediate transfer/five taskStep puzzles. Scope it to legacy2 and add beacon muster versus optional ghost retention, plus current six taskInteract challenges. Its statement that ghost position remains null even after ended conflicts with the actual ended role-revealed projection. Keep the live hidden-position rule and private-chat exclusion, including after end, distinct from ended revealed positions/replay.
- docs/SPATIAL-REPLAY.md's v1 map-string/six-actor/100-task/64KiB description remains useful as legacy documentation; link/scope the current exact-map v2/custom-roster/station reader to QUALITY-MAIN-REPLAY-CONTRACT.md. Do not silently relabel v2 as the old format.

Source matches14-room Beacon2/eight-room Annex, four distinct room/kind jobs, six challenge kinds and the retained five old progress panels plus three metadata-free legacy puzzles. Optional strategic configuration/controller and truthful STRATEGIC versus HYBRID/DEMO labels remain in actual source; no live provider execution was attempted. Ghost owner presentation deliberately holds only each actual received own position, without prediction/interpolation, while server collision/input authority still applies. That can look less fluid between snapshots; it is a documented presentation limit, not a claim that normal living MotionTrack prediction applies to ghosts.

### Native visual review pending

At the final artifact observation `2026-10-30T09:49:05+01:00`, Reviewer had no final f9 native screenshot/report set in its observed artifact directories. Older911 screenshots and manager's earlier world-browser artifacts are historical and are not substituted for current visual qualification. Desktop/mobile screenshot review remains pending Reviewer final files, preferably after the Ward mismatch is resolved. No new browser was launched. Reviewer owns the Chrome lease; no owned process remains. This receipt does not claim a visual pass or completed native qualification.

```powershell
$env:TEMP='D:/Widegames-work/temp'; $env:TMP=$env:TEMP
# Requested unchanged files, run without override variables:
node --test _artifacts/final-ui-selfcheck-f9b3215/runtime/tests/quality-client-main-replay2.test.mjs _artifacts/final-ui-selfcheck-f9b3215/runtime/tests/spatial-replay-model.test.mjs _artifacts/final-ui-selfcheck-f9b3215/runtime/tests/spatial-replay-lifecycle.test.mjs _artifacts/final-ui-selfcheck-f9b3215/runtime/tests/quality-client-regression-audit.test.mjs
# New positive counterexample; expected RED at exact f9:
$env:QUALITY_CLIENT_WARD_ROOT='D:/Widegames-work/ship-quality-main-ui-20261030/_artifacts/final-ui-selfcheck-f9b3215/runtime'
node --test tests/quality-client-main-ward-selection.test.mjs
```
