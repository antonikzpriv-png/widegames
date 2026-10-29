# Tactical map implementation

Foundation265804446e37b8847d43b31875cf9f6ea3c81c33. Core owns shared/maps, spatial runtime and tactical-map tests only. Schema1/2/3 legacy orchestration remains coordinator-owned.

## Frozen fixture milestone

Registry exports DEFAULT_MAP_ID, deepFreeze, MAP_CATALOG, getMap(reference?), mapFor(stateOrView). New exact identity {id:'stormbreak-annex',version:1}; default remains beacon. Unsupported versions fail explicitly. Descriptor retains the executable contract shape and immutable map-local geometry/caches. No shared/world.mjs or original fixture edits.

Stormbreak Annex is1800x1400 with eight named rooms. Northern ring, cross-deck bypass, central riser and western/southern loop provide alternate routes. Echo Observatory is an isolated eastern spur accessible through Tide Clinic; it deliberately has no southern connection. Five door thresholds all lie on loops, outside stations/spawns; no door seals the isolated spur. Twelve distinct Muster Hall spawns, fixed Muster viewpoint/bell, four linked passages, six repair sites, three devices and three cameras. Existing fixture field shapes preserved, Annex IDs are distinct. Display coordinates use percent units, rects use world units.

Coordinator: assign exact map before initialize/task generation; use geometry.ROOM_LAYOUT/WORLD_VIEWPOINT/WORLD_SPAWN_ROOM and fixtures. Integrations: resolve five Annex door rectangles by map; grace/occupancy checks must include body-radius overlap before setting closed. Spatial runtime refuses collision and invalidates blocked routes, but never teleports occupants; systems must defer/jam occupied thresholds. Device/camera owner must resolve Annex fixtures.

Initial controls use real public geometry: registry/default exact legacy equivalence; immutable graph with cycles/spur;12 nonoverlapping spawns; every fixture and56 ordered station routes; interleaved original/Annex caches. No provider, browser or root tactical lifecycle qualification implied. Spatial metadata adaptation follows as a separate milestone.

## Two-door fixture correction

The first frozen fixture milestone19e4bf6 exposed a meaningful follow-up counterexample: simultaneously closed annex-west-ladder and annex-central-riser disconnected Ballast Vault/Drift Canteen. The new every-legal-pair connectivity regression fails on that exact fixture, evidence _artifacts/tactical-map-two-door-negative.txt. Final replacement: annex-west-ladder becomes annex-north-riser at {x:850,y:450,width:100,height:24}, roomId muster. All other room/floor/fixture coordinates remain unchanged. This keeps both western ladder and southern link permanently traversable; the upper central riser becomes a closable chokepoint with east/west detours. Consumers must use the correction commit's full registry. No published/persisted production map migration is performed.

An intermediate uncommitted east-bypass placement also failed the same control when combined with north-east, isolating the eastern sector; evidence tactical-map-two-door-negative-east-bypass.txt. The final north-riser placement preserves three independently closable entrances to central sectors and leaves the full east cross-deck permanently available. No assertion was weakened.

Initial spatial invocation hit an import syntax error before assertions; corrected the obsolete import. The later42-check focused run had41 passes and one static helper LOS failure: the intended prop check had not been inserted due to a CRLF-sensitive text edit. The authoritative spatial LOS tests already passed. Corrected the shared Annex helper, retaining the unchanged negative assertion and evidence _artifacts/tactical-map-focused-static-los-negative.txt; original shared/world.mjs is untouched.

## Spatial runtime handoff

createSpatialWorld(geometry) retains all current exports: WORLD, point, walkable, station, bell, sees, nearby, initialize, stop, stopAll, settle, navigation, navigate, input, moving, observe, projectWorld, adoptVitals, validateSpatialState. No root engine or shared contracts changed. Geometry fixtures select doors, local passage traces and native owner-vitals recognition. WORLD_SPAWN_ROOM selects fallback roster placement, WORLD_VIEWPOINT selects immutable spectator location, and ROOM_LAYOUT supplies the non-Bridge metadata fallback. For raw legacy/custom geometry without these fields, the original Bridge/default beacon fixtures remain supported. Original p1..p6 coordinates and custom12 fallback layout compare exactly with the original runtime inputs. Schema1/2 remain outside this factory.

Annex spectator vision.mode is 'viewpoint', origin {x:900,y:260}; original beacon retains mode 'bridge', origin {x:800,y:285}. Annex spectator observation IDs use o:muster:<sequence>; original o:bridge remains unchanged. Self vision.mode remains player, ended reveal unchanged. Unknown remote deaths, sight/body/witness/muster/owner-vitals knowledge, bounded dated hatch traces, explicit recipients, JSON cursors and defensive projection copies remain intact. Old-map hatch/device IDs cannot establish Annex observations. No remote position/role/destination, hidden passage endpoint or recipient list is introduced.

Final door fixtures: annex-north-west, annex-north-east, annex-north-riser, annex-cross-deck, annex-central-riser. The early19e4bf6 fixture is superseded by the accompanying spatial milestone. Exact north-riser replacement described above; other geometry/station/bell/passage/repair/device/camera coordinates did not change. Annex static canSeeWorldPoint also blocks opaque props; original shared/world.mjs helpers remain untouched. Static geometry caches are descriptor-local; authoritative dynamic route caches exist only inside each path call, so interleaved matches/door changes cannot reuse another match's result. Accepted routes stop at collision and clear destination; new proposals recompute alternate paths. No teleport, automatic reroute, client speed or new authority added.

Checks and actual results:

- New tactical-map registry/spatial tests:16 distinct checks.56 ordered station routes,280 single-door ordered station routes,80 routes covering all10 legal two-door combinations from Muster to all8 rooms,12 ordered critical-site pairs, all fixtures,12 nonoverlapping native/custom spawns, two-map interleaving, LOS/lights/proximity, stale path collision/reopen, speed/diagonal/lease/sequence, corridor last room, JSON restart, map-specific private knowledge/muster/reveal and defensive copies.
- Relevant original tests:26 passed (geometry7, knowledge10, hatch/restore5, actual schema3 engine integration4). Real engine controls include schema1/2 opt-out creation, local death/muster privacy, prop-blocked bell permissions and chronological private passage traces.
- Combined invocation:41 passed/1 failed on the missed static LOS edit; unchanged failed assertion then passed in its focused rerun. Thus42 distinct final checks passed across those invocations, no skips; not a claim of a clean42-test invocation. All negative evidence retained, including both legal-pair isolation counterexamples and initial import compile error. No behavioral assertion was weakened.

Commands from this assigned worktree (Node24.20.0, synthetic module clocks/rosters, no providers):

~~~powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
node --test tests/tactical-map-registry.test.mjs
node --test tests/tactical-map-spatial.test.mjs
node --test --test-name-pattern='every legal pair' tests/tactical-map-spatial.test.mjs
node --test tests/tactical-map-registry.test.mjs tests/tactical-map-spatial.test.mjs tests/beacon-world-geometry.test.mjs tests/beacon-world-knowledge.test.mjs tests/beacon-world-traces.test.mjs tests/beacon-world-engine.test.mjs
node --test --test-name-pattern='Annex static sight' tests/tactical-map-registry.test.mjs
git diff --check
~~~

Evidence in ignored _artifacts: tactical-map-spatial-first.txt (initial9 passing), tactical-map-two-door-negative.txt, tactical-map-two-door-negative-east-bypass.txt, tactical-map-two-door-positive.txt, tactical-map-focused-static-los-negative.txt (combined41/42), tactical-map-static-los-positive.txt. Some commands precede the added final controls; the final file contains16 tactical checks. Module fixtures directly construct authoritative-clone-like states and record actual supplied times; they do not claim client acceptance or root schema4 lifecycle coverage. Legacy integration controls use real engine exports. No fake model prompt receives hidden state.

Limits/manager integration: root must resolve and persist exact map before init/tasks and pass geometry into root context, systems and investigation; root tactical schema4/restore/lobby/AI/transport integration is coordinator-owned. Occupied-threshold one-second grace, radius-overlap/defer/jam and no displacement require Integrations' version2 systems implementation and independent integration checks. The spatial layer does not excuse an invalid closed door around an occupant. These controls prove geometric alternate routes for all legal one/two closures, not the systems closure schedule. No camera presentation/browser, complete tactical match, provider or deployed production qualification is implied, and this is not independent approval of Core's implementation. Manager/other owner must review. No runtime changes outside ownership, installs, Chrome, other worktree edits, main/push/deploy.

## Corridor metadata and immediate route invalidation follow-up

Read exact integrated coordinator **51b6cf4cb62ac95b8ce3cd34c5fbbeef5b34aa12** (root implementation58497fe0415d9c0654f4f9dc3debeab8ac03cd40). public/world/scene.mjs lines68/79 classify corridor paint and thresholds by absence of floor.center. Annex had centers on all15 floors, so none of its7 corridors or their room openings were painted. The owned corridor helper now omits center only on corridor floors; all8 room centers, floor rectangle coordinates, fixtures and routes remain identical. The negative0/positive7 classification is pinned only in explicit historical archive mode; ordinary current source tests are not frozen to the old defect.

New factory method **invalidateRoutes(state,at,record) -> boolean**. It validates every remaining segment of each accepted navigation polyline with the same static/dynamic collision checker used by authoritative navigation. An invalid route calls existing stop at the exact supplied boundary with reason route_invalidated, clearing path/destination and recording one attributed motion event at unchanged position. No action/input sequence or request receipt is consumed, no movement/replanning/teleport occurs. Valid detours, other actors and manual input are untouched. Repeated invocation is inert. Invalid/retrograde time is rejected before any route changes. Existing exports/signatures remain intact.

Manager call order: settle positions to boundary; advanceSystems(state,boundary,context); OR invalidateRoutes into changed; then refreshKnowledge/device work and final checkpoint updatedAt. Both schema3 and4 factory instances support the method; schema1/2 retain their separate runtime. Root wiring is not edited or claimed implemented here. Annex map identity/coordinates/version remain1.

Exact test source archive: _artifacts/tactical-boundary-51b6cf4,261 raw Git blobs verified on extraction with SHA1 Git object IDs; SHA256 manifest records every file. **No overlays or archived/root source edits.** Tests import its real createMatch/applyAction/tick and B2 systems while exercising the new owned spatial method externally at the returned exact closure boundary. This explicitly simulates the manager's planned call; it does not claim51 already calls that method. Legal actions first walk crew to fixtures, then schedule doors and routes. Clear closure stops a distant accepted path and an ordinary new navigate proposal yields the alternate route. An occupied threshold jams without displacement or false route cancellation. Real clock supplied through engine API is synthetic fixture time; no models or hidden-state prompts.

Boundary tests8/8 passed; registry/routes6/6 passed in the preceding invocation. First boundary invocation failed before assertions due to a regex escaping error in the test, corrected without weakening behavior assertions; retained _artifacts/tactical-map-boundary-first.txt. Passing boundary evidence tactical-map-boundary-second.txt. Controls cover later blocked segment with valid endpoints, exact fractional at/attribution, idempotence, peer/manual preservation, pending/jammed/open no-op, JSON equivalence, schema3 original door rectangles and atomic invalid-time denial. Previous full42-check receipt remains history.

Commands: TEMP/TMP D:/Widegames-work/temp; TACTICAL_MAP_ENGINE_ROOT=own _artifacts/tactical-boundary-51b6cf4; TACTICAL_MAP_ENGINE_PIN=51b6cf4cb62ac95b8ce3cd34c5fbbeef5b34aa12; node --test tests/tactical-map-boundary.test.mjs tests/tactical-map-registry.test.mjs (initial boundary compile failure, registry6 pass); node --test tests/tactical-map-boundary.test.mjs (8 pass after fix). Manifest exact-pin mode is opt-in; ordinary default uses current checkout and skips only actual schema4 controls on a pre-schema4 foundation, never standalone checks. No install/Chrome/full suite/provider/root/other worktree edits.

After adding exact manifest verification, the final bounded invocation passed19/19: new boundary8 + original spatial7 + actual schema3 engine4, no failures/skips. Evidence _artifacts/tactical-map-boundary-verified.txt. All261 archived source hashes verified before this run.

## Independent B2 review after owned fix62498d8

**Open concrete finding: impossible future system activations pass checkpoint validation.** Reviewed exact manager51b6cf4cb62ac95b8ce3cd34c5fbbeef5b34aa12, incorporating B2 b50514dee073743c4feaec6070cc968508334a36 and b99d5327cdc5d45f2df907c45cabbd8b52e92c66. server/engine/systems/model.mjs Git blob c12bec383a414ac362a9872562b074d0db70d2f0 is identical in manager51, ownerb99 and later owner81e7353acf60b578e537f62dbd2bbcef0f43c69f. The latter changes corpse occupancy only; that known finding is not reopened here. No later manager revision is claimed executed.

Reproducer: construct actual schema4 room/identity/match with public constructors; submit a legal systemSabotage; validate the unchanged checkpoint successfully; clone that room in memory, shift active effect startedAt/deadlineAt (and pending door closeAt) +1000ms, and shift the corresponding faction reservation +1000ms. Leave state.updatedAt unchanged. validateRoomSnapshot still accepts all eight variants: lights, communications, pending door and power on both maps. The initial probe used checkpoint1001/start2001; retained default regression uses100001/101001. Durations, map identities and shared reservation lower bounds remain valid, so only impossible checkpoint chronology distinguishes the corrupt fixture. Full source remains untouched.

Source cause: model effect validation checks safe timestamps and duration differences but never requires activation<=finalized state.updatedAt; validateDoorState likewise lacks checkpoint comparison; critical startedAt validation has the same omission. Store validates structural/knowledge/snapshot times yet does not add these systems activation constraints. An accepted restored checkpoint can therefore assert sabotage from its future and prolong scheduled closure/failure/expiry. This is a corruption-detection/restore invariant defect, **not a demonstrated authenticated-client exploit**. No legal engine action or model proposal was found that creates the corrupt state. Runtime clocks/cooldowns still legitimately lie in the future; only activation/history must be bounded by the checkpoint. A repair should validate after root finalizes updatedAt, preserving real future deadlines and cooldowns; module unit fixtures that call validators on transient pre-finalization states need that distinction. Root apply/tick currently assigns final updatedAt before persistence validation.

Owned tests/tactical-map-systems-review.test.mjs imports actual current-checkout sources by default, with explicit root/pin override only for immutable archives. On an old pre-schema4 foundation it skips only these integration checks with a stated reason; an explicit override must supply actual schema4. Desired rejection assertions are retained and intentionally **fail against exact51**. They are not marked passing historical behavior or silently suppressed on a current schema4 root. Manager/B2 owns the production fix; the independent regression can verify it unchanged.

Actual bounded review run: **4 positive controls passed,8 desired rejection regressions failed**, no skips,538.9ms. Positive controls use actual8-keeper/two-saboteur roots on both maps: teammate auxiliary cooldown denial just before boundary/acceptance at boundary after JSON, critical single-active guard and concurrent auxiliary permission, foreign map door rejection, own faction clock projection/no spectator clock; and exact critical-vs-door-close-vs-passage-arrival precedence with original timestamp, no teleport/arrival/closure after terminal transition. These independently exercise B2/root, not approve Core physics. Shared critical reservation implementation and per-map fixture resolution were also read directly; no additional legal-action bypass found in this bounded review.

Exact execution:

~~~powershell
$env:TACTICAL_MAP_ENGINE_ROOT=(Join-Path (Get-Location) '_artifacts/tactical-boundary-51b6cf4')
$env:TACTICAL_MAP_ENGINE_PIN='51b6cf4cb62ac95b8ce3cd34c5fbbeef5b34aa12'
node --test tests/tactical-map-systems-review.test.mjs
~~~

Evidence: _artifacts/tactical-map-systems-independent.txt (4 pass/8 fail, missing expected rejection), tactical-map-systems-future-probe.json (eight accepted corrupted-checkpoint cases). All261 original archive hashes verify again after the run. Runtime fix62498d816971c39e46f8ee625da278066b88cd5c remains separate from this independent review/test receipt. No B2/root/other-worktree code edits or self-approval; no Chrome, providers, installs, full suite, main/push/deploy.

## Independent B3 investigation review: exactc99cd2a

Bounded acceptance of the tested B3/root boundaries; **no new concrete product defect found**. Exact source **c99cd2ada0f261ef323e75080cf707e6a95b8757**, excluding manager's uncommitted tactical-default configuration. Tests explicitly use tactical:true/direct createMatch for schema4; legacy control explicitly uses world:true,systems:true without tactical. Owner B3 runtime2119e021cd31dc9aad7d1727101af8c2b49a7466 is byte-identical at this pin: index.mjs Git blob86a5067b30c20c9ed4a1df4ec5f6c28ff5c16f5c, data.mjs blobf5d0e220e05e23be8c40dca54e9392a56991629d. Owner test milestones1c8dae7c0e3613d761820d4afcb4513177feb8f4 and8d28407f3ca12774363469ae478700be7dc32695 were inspected as context, not rerun as independent evidence.

Source qualification: own ignored _artifacts/tactical-investigation-c99cd2a contains267 canonical raw Git blobs verified against object IDs during extraction, with per-file SHA256 manifest. No runtime overlays, archived source mutations or other-worktree changes. All267 hashes verify before tests and again after execution. Only this document and tests/tactical-map-investigation-review.test.mjs are changed for this assignment. Prior736b145 receipt, eight failed future-systems-activation controls and evidence remain unchanged and were not rerun.

Root binding inspected directly: context.sees delegates to spatial sees using p.id only when state.players.includes(p); otherwise it supplies null. B3 access uses actorFor to recover the canonical actor from the supplied ID. Camera frames deliberately construct a separate stationary crew observer at camera.position; it is not a canonical player and therefore receives the public-camera vision policy, independent of operator faction. B3 separately clamps the field radius before LOS and excludes dead/transit targets, with no role/route/attack payload in frame entries. Camera samples are private device observations, not witness records. Spatial knowledge adopts only owner-native vitals samples; camera contacts do not promote attack/death knowledge. No model or provider is invoked by these engine/module paths.

Six independent checks, each exercising both actual maps:

1. Real root camera reads by crew and saboteur operators, with four intentionally staged living targets: near, floor-connected behind a door, behind a solid prop, and380 units away. Normal360 field includes near/corridor targets, excludes opaque-prop target and outside-field target; limited:false confirms exclusion is not cap eviction. Lights110 masks the distant contact for either operator faction. After real warning/closure, the within-radius corridor target is masked by the correct map door while near contact remains. Original normal sample stays historical after lighting restoration. Beacon uses engine-camera/east-lower/turbine; Annex uses annex-west-camera/annex-cross-deck/rivet-bench.
2. A nonzero input1ms before completion cancels with no sample; input exactly at completion follows the already-settled legitimate sample. This validates actual chronological precedence instead of incorrectly demanding cancellation of a read completed before a same-time input action.
3. Actual elimination of the reader1ms before deadline cancels for dead; automatic phase transition tied exactly with completion wins precedence and fails the read for phase at the original timestamp. No invented successful/empty observation appears.
4. Actual persisted room snapshots accept unchanged valid facts, reject an unchanged sample transplanted to another owner, wrong provenance owner/type, other-map identity, future sample time with matching rewritten ID, and future session start. Detached valid samples without sessions are an explicit control; the future-observation fixture removes its elapsed session so rejection is not merely a broken session-to-observation link. An actual schema3 camera read retains its old sample/session/frame shape and passes full snapshot validation.
5. A dated pre-attack frame contains the victim; after a real remote kill, a new frame omits it and contains the attacker. Old facts remain unchanged, roster status stays unknown/last-known rather than becoming globally dead, other actor/spectator knowledge is unchanged, no witness/body/report hint is granted remotely. A guessed remote body ID is denied by the real engine with INVALID_BODY. No camera fact grants physical report or eyewitness authority.
6. Interleaved map histories survive JSON restart/full snapshot validation and safe projection from deeply frozen state. Mutating returned map/provenance/field/device coordinates cannot alter state. Frame player facts remain exactly id/position; sample map/owner/timestamp and private replay recipient scope remain intact. Other actors/spectator do not receive the reader's samples.

All staging uses real accepted navigate/input/actions and engine deadlines. Supplied clocks,8-keeper roster/seed and100/1000ms reads are labeled offline fixtures. Raw state/roles/path lengths are harness oracles only; no fake model/client prompt receives them. No hand-edited root positions, roles or phase state is used for positive behavior. Deliberately corrupt snapshot copies are limited to negative validation cases.

Actual results: initial six-check invocation **5 passed/1 failed**, where the sole failure was this review test expecting UNAVAILABLE instead of the documented actual remote-report denial INVALID_BODY. Read the root report branch, corrected that specific expectation, retained accepted:false and all privacy/permission assertions. Also strengthened future-time isolation and non-cap masking controls. Only the three affected groups were rerun: **3/3 passed**. Thus all six final distinct checks have passing evidence across the two bounded invocations; no claim of a clean six-check final invocation, no skips or product assertions weakened. Initial run1521ms, targeted follow-up1245ms. No broader suite or owner test suite was run.

Exact commands from the assigned D: worktree:

~~~powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:TACTICAL_MAP_INVESTIGATION_ROOT=(Join-Path (Get-Location) '_artifacts/tactical-investigation-c99cd2a')
$env:TACTICAL_MAP_INVESTIGATION_PIN='c99cd2ada0f261ef323e75080cf707e6a95b8757'
node --check tests/tactical-map-investigation-review.test.mjs
node --test tests/tactical-map-investigation-review.test.mjs
node --test --test-name-pattern='camera fields|real checkpoint|dated before' tests/tactical-map-investigation-review.test.mjs
git diff --check
~~~

Evidence: _artifacts/tactical-map-investigation-review-first.txt, tactical-map-investigation-review-final-targeted.txt and exact archive manifest. Tests default to current-checkout runtime; explicit archive pin verifies all hashes. A pre-schema4 owner foundation skips only this integration suite with its stated reason; explicit source override requires real schema4 and cannot silently fall back. No historical source is silently imported by ordinary current tests.

Limits: bounded B3/root/restore/knowledge integration on radial packaged cameras and8 keepers, not browser camera UI, HTTP identity boundary, actual disk process restart, directional custom FOV, camera saturation/load, exhaustive door/camera pairs, complete tactical matches or live provider qualification. This does not approve Core spatial code independently. Existing future-systems-activation finding remains open outside this assignment. No investigation/root/spatial/runtime edits, model calls, installs, Chrome, paid calls, main/push/deploy or other worktree edits.

## Independent closure of736 future-activation finding

**Verified fixed** by B2 **c96acb6e1544e22a44479c16075805c3f69bf09f**, independently tested after manager integration at **2c1f9d87756bea572f1df3a57c08a69fa4930232**. Integration was already committed when this assignment began, following b9c1a442b88024f659ea05e40b00737b6562413f and10f3c87. Used a fresh exact integrated-source archive, not a composite overlay. Systems tree diff between B2c96 and manager2c1 is empty; the corrected model Git blob is1609a7155a8073d1bcd9af08d084de2dab8f0689. Reviewed the full committed four-file c96 diff: systems/model.mjs, new checkpoint controls, finalized module fixture timestamp, and owner receipt. No B2/root/runtime edits made here.

Source: own ignored _artifacts/tactical-systems-closure-2c1f9d8, all281 canonical raw Git blobs SHA1-verified on extraction and SHA256-manifest-verified before and after testing. No overlays or source changes. Original independent test is unchanged from736b145: Git blob 45a19c5120fde5ebe11eb13298378bddfb00c97d, raw Git-byte SHA256 **1612d22905d579030fe34dac91edc384eb544922919dd8cdee06d27a89d0cb24**; same blob exists in current owner HEAD and manager2c1. No assertions, expected failures, request clocks or fixture fields changed for closure. The historical51b6cf4 archive, initial4-pass/8-fail evidence, future-probe JSON and earlier receipts remain preserved. This new green result does not overwrite or relabel those red results.

Validator review: for finalized v2 checkpoints, updatedAt and optional startedAt are valid integers with checkpoint>=begin. Active lights/comms, every non-open door, active passage and retained canonical critical start must lie within [begin,checkpoint]; completed repair contribution timestamps must also be within it. Rule-duration checks remain. True future expiry/warning-close/arrival/failure deadlines remain legal; faction/personal future cooldown reservations are bounded by plausible horizons rather than clipped to checkpoint. Retained critical reservation is exactly canonical start+cooldown, and active passage charge is exactly arrival+cooldown with a local valid entry origin. All added restrictions are v2-only. B2's module fixture timestamp change finalizes updatedAt before invoking checkpoint validation; it retains the prior behavior assertions and matches root's finalization contract. No validator was inserted into transient advance/apply mutations.

**Actual bounded execution:21/21 passed,0 failures,0 skips,12185ms**, one invocation:

- The original12 independent checks unchanged: all8 corrupt future-activation rejections now pass on both maps, while4 original positive shared-cooldown/privacy/foreign-door/critical-deadline-tie controls remain green.
- B2's9 new targeted controls passed from their exact committed test file. Both maps accept initial future reservations and all5 legally activated sabotage kinds with true future due dates through actual isolated store save/close/reopen/load. Additional controls reject pre-match activation, future repair contributions, excessive reservation extensions and invalid passage histories/origins/charges. Active passage and arrival checkpoints restart correctly with retained personal cooldown. Legacy schema3/v1 keeps its historical timing tolerance and valid future due dates.

The B2 file was reviewed and executed as supplementary owner-authored controls; the decisive independent negative-to-positive evidence remains the unchanged Core12. No new controls were necessary and tests/tactical-map-systems-review.test.mjs is untouched. All store fixture directories were created under the new archive's own ignored _artifacts/test-temp and removed by the bounded test cleanup; that directory is empty after execution. No original/manager data was used.

Exact commands (cwd D:/Widegames-work/tactical-maps-builder-20261029):

~~~powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:TACTICAL_MAP_ENGINE_ROOT=(Join-Path (Get-Location) '_artifacts/tactical-systems-closure-2c1f9d8')
$env:TACTICAL_MAP_ENGINE_PIN='2c1f9d87756bea572f1df3a57c08a69fa4930232'
$env:TACTICAL_SYSTEMS_SOURCE_ROOT=$env:TACTICAL_MAP_ENGINE_ROOT
node --test tests/tactical-map-systems-review.test.mjs _artifacts/tactical-systems-closure-2c1f9d8/tests/tactical-systems-checkpoint.test.mjs
git diff --exit-code 736b145 -- tests/tactical-map-systems-review.test.mjs
git diff --check
~~~

Evidence: _artifacts/tactical-map-systems-closure-2c1f9d8.txt and new raw-source manifest. The specific736 finding is closed at this exact integration pin. Limits: checkpoint/module/root/store qualification of the reported invariant and tested positive cases, not exhaustive corruption authentication, reconstruction of cleared activation history or historical dynamic LOS, complete matches, browser, providers, production packaging/server or deployment. Legacy-v1 tolerance is deliberately unchanged. Only this receipt is committed for closure; no runtime/test changes, installs, Chrome, broad suite, providers, other worktree edits, main/push/deploy. Production-only qualification has not started.

## Scene predicate integration-test correction: exact2015618

Test-only correction, source **2015618095b9d31e608ef9a62278ffc126d93594**. Reproduced the stale final boundary test before editing: its exact !floor.center source assertion failed on B4's semantically equivalent !world.WORLD_ROOMS.some(room=>room.id===floor.id) paint predicate and matching filter predicate. Evidence _artifacts/tactical-map-scene-old-assertion-negative.txt. This was a test contract mismatch, not a renderer/geometry defect. No runtime/public/shared/spatial source changed.

The existing scene-contract test now accepts either complete predicate pair after whitespace normalization. Both paint and threshold loops must use a supported pair. **All original numerical floor rectangle, room and fixture equality assertions remain unchanged**, including the explicit51b6cf4 negative fixture (all Annex floor centers present, zero !center corridors) and positive owned geometry's seven corridors. No assertion or integration check was skipped.

Added exactly one meaningful actual-draw test. It imports the real selected createWorldScene and records actual canvas corridor roundRect fills and threshold fillRect primitives, comparing their exact world coordinates/counts with both immutable maps. The modern renderer is also invoked through its supported mapResolver with copies that give corridors irrelevant centers; the real draw must still paint exactly the ID-defined corridors and thresholds, excluding rooms. This catches missing paint/threshold code even if the expected source strings remain. Historical51 mode runs its real original renderer/data and explicitly asserts zero Annex corridor and threshold paint. No source rewrite, browser or renderer monkey-patch is used; the recording canvas is a test double, not pixel/raster evidence.

New exact-source archive: own ignored _artifacts/tactical-scene-2015618,281 canonical raw Git blobs, Git object ID checked on extraction and SHA256 manifest checked before/after. Preserved old _artifacts/tactical-boundary-51b6cf4 contains261 original blobs and also verifies unchanged. No overlays or archive mutations.

Actual results: **15/15** focused boundary/map controls passed at2015618,0 fail/skip,820ms. This includes9 boundary controls (the prior8 plus one actual-draw control) and6 registry/route/fixture controls, preserving the all56 ordered station-route check. Then **2/2** selected scene controls passed against exact historical51b6cf4cb62ac95b8ce3cd34c5fbbeef5b34aa12,0 fail/skip,375ms, proving the original negative case still executes. No broad suite, unrelated check repeat or owner runtime modification.

Exact commands from this assigned D: checkout:

~~~powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:TACTICAL_MAP_ENGINE_ROOT=(Join-Path (Get-Location) '_artifacts/tactical-scene-2015618')
$env:TACTICAL_MAP_ENGINE_PIN='2015618095b9d31e608ef9a62278ffc126d93594'
node --test --test-name-pattern='exact archived scene' tests/tactical-map-boundary.test.mjs
# Prior command reproduced the stale assertion before this test-only change.
node --check tests/tactical-map-boundary.test.mjs
node --test tests/tactical-map-boundary.test.mjs tests/tactical-map-registry.test.mjs
$env:TACTICAL_MAP_ENGINE_ROOT=(Join-Path (Get-Location) '_artifacts/tactical-boundary-51b6cf4')
$env:TACTICAL_MAP_ENGINE_PIN='51b6cf4cb62ac95b8ce3cd34c5fbbeef5b34aa12'
node --test --test-name-pattern='exact archived scene|actual scene draw' tests/tactical-map-boundary.test.mjs
git diff --check
~~~

Evidence: _artifacts/tactical-map-scene-2015618-focused.txt and tactical-map-scene-51b6cf4-historical.txt, plus preserved initial assertion failure and both manifests. Limits: canvas-call geometry checks, not visual pixel/browser/Chrome qualification. Manager owns browser/full-suite integration. Only this test and receipt changed; no public/runtime/other-worktree edits, providers, installs, main/push/deploy. Production qualification remains unstarted pending its separate assignment.

## Final production-only tactical qualification: exactaec5695

**25/25 production checks passed**, no blocker found in this bounded qualification. Exact frozen manager source **aec5695236acf4e51ec87f2c27425a29573003d3**, including strict historical-map validation. Only standalone tests/tactical-map-production-review.mjs (outside ordinary *.test.mjs discovery) and this receipt changed. This is packaging/real-main qualification, not new feature work or independent approval of Core physics.

Fresh ignored archive: _artifacts/tactical-production-aec5695.tar, exact Git PAX commit comment verified; SHA256 **eb60662bddee43e03479fcf5d9d691e8c9cc451086c74f23ecca62d5fa1d5d92**. Executable snapshot _artifacts/tactical-production-aec5695 contains **285** canonical raw Git blobs, checked against Git blob IDs during extraction and against per-file SHA256 manifest before/after testing. No source overlays, runtime edits, old checkout dependency or archive mutations. Counts are derived from this manifest, never old qualification constants: **72 runtime files,43 public/shared assets,150 local module edges,5 additional literal browser asset references**. Every deployed local reference resolves inside server/public/shared, and every actual public/shared file was fetched and compared as raw bytes, including BOM-bearing modules, immutable map registry/Annex fixtures, annex-art and feature/world styles. All source hashes verify again after receipt preparation.

Environment: Windows, Nodev24.20.0, offline npm production install using D:/Widegames-work/npm-cache and TEMP/TMP D:/Widegames-work/temp. Exactly ws8.22.0 installed/resolves within the archive; installed ledger and physical non-dot package directory contain only ws. Puppeteer and puppeteer-core are absent/unresolvable. Normal loadConfig defaults remain port3000/host127.0.0.1, worldMode/systemsMode/tacticalMode true, initial map beacon. Real main honors the fixture's matching loopback PORT/PUBLIC_ORIGIN. package start uses server/main.mjs, tactical browser script points to its actual file, ordinary test glob excludes this standalone harness. Docker source retains Node24, production-only install and recursive server/shared/public COPY groups, EXPOSE3000 and actual main CMD. Docker was not executed. Updater is N/A for this web service; no installer/update behavior was introduced or qualified.

The harness starts the actual unmodified server/main.mjs twice with NODE_ENV production, real clock, real loadConfig/createGameServer/store/AI, normal tactical mode flags (no schema/runtime/engine injection), demo provider and zero call/token/cost/daily budgets. Only an allowlisted basic process environment and synthetic unused credential marker are supplied, never live account credentials. Before importing main, the Windows IPC wrapper blocks/counts all child global fetch calls; parent HTTP calls target only its own loopback server. Real local demo may run; no match completion or model behavior is implied.

Test fixture preparation uses actual createRoomStore/createDailyBudget APIs while holding the isolated data lock. It reserves0.01 under fixture:uncertain:production-no-send, explicitly a **synthetic conservative uncertain-reservation fixture; no provider send ever occurred**. This tests retention under later zero-budget main processes, not a claimed live uncertain send. Three legacy room files use actual schema1/2/3 constructors, accepted wait receipts and a truthful1ms maximum-duration pause with no winner; these paused compatibility fixtures are sampled, not historical user data or active legacy gameplay. Their files are preserved byte-for-byte through both real main startups/shutdowns.

Passed real runtime boundaries:

- Health readiness, isolated service.lock ownership and fresh token on restart. Both actual mains retain their one registered SIGTERM handler. Windows IPC invokes process.emit('SIGTERM') and disconnects; normal main/game.close logic closes sockets/timers/storage. Both children exit naturally code0/signalnull and release lock/recovery claim, no forced kill.
- Both beacon and stormbreak-annex selected through authenticated pre-start settings. Beacon fixture explicitly toggles to Annex then back, rather than merely accepting its default. Original selection retry is idempotent before start and after restart; persisted revision/receipt ledger remains exact. Spectator/missing identity and reused-ID/different-content requests reject; a new setting after start rejects.
- Both actual normal-default starts create persisted room schema3/match schema4 with worldVersion1/beaconVersion1/tacticalVersion1, exact map/preset and real private seat. Safe owner/spectator HTTP and WebSocket snapshots have own role only before end, explicit knowledge statuses, no raw state/request/identity/memory/recipient/contributor payloads. Returned remote positions are checked against the projected vision origin/radius and solid/door LOS using only public fixtures and permitted own/public view fields. Spectators retain fixed map viewpoint, no private notes/session/observations/acting hints/transit/cooldowns. Hint fields match public action contracts.
- Legitimate seq1 movement and seq2 zero cleanup physically move/stop the human within server lease/speed; note action records its actual prior own location. Private field notes are absent from spectator. Foreign-origin steering and spectator action authority reject. Post-restart note/input retries keep note/ability state, stopped position, sequence and human request count unchanged; accepted original note receipt was retained.
- Eight authenticated owner/spectator socket connections across both mains/maps are view-checked. Actual WS upgrades reject missing cookie, cross-room cookie and foreign origin; cross-room HTTP fails. No raw credentials or synthetic marker appears in HTTP/WS bodies or child stdout/stderr. All child stderr is empty.
- Every actual43 public/shared asset returns exact bytes and expected CSS/JS MIME, CSP and nosniff. Server/AI/investigation source, package/lock/.env/dependencies/data/artifact paths and encoded path traversal return404. Foreign mutation origin returns403. No browser/CDN is used.
- After graceful first stop, both schema4 checkpoints retain exact map, settings, human identity, private note, inputSeq2 and accepted action-ID receipt with no quarantine/temp residue. Restart uses the same DATA_DIR and original cookies, restores original role/seat/map/input position/notes and settings revision, and preserves exact identity/settings ledgers and ability state after retries. The labeled daily ledger and all three legacy files remain byte-identical after the second stop.

Successful actual run: **25 checks,6842ms**, child PIDs20444/24400 both exit0/signalnull. **0 external provider fetch attempts,0 forced kills,0 socket privacy errors**. Main process count capped at2; global fixture deadline90s, startup10s, graceful stop8s, HTTP/WS4s, and bounded manifest/asset/request loops. Each harness attempt receives a fresh evidence/private-data directory; reports persist on failure. No original/manager data directory is touched.

Preserved initial failure: the first attempt stopped after3 preflight checks, before launching any child, because this new harness interpreted the HTML home-link '/' as a physical public/ directory. Corrected the test resolver to match actual serveStatic('/') -> public/index.html. No product assertion weakened or source changed. First failure: _artifacts/tactical-production-aec5695-run-u73Iuu/report.json and tactical-production-aec5695-first-run.txt. Successful second attempt: **_artifacts/tactical-production-aec5695-run-j3fwBz/report.json**, private data beneath that same run directory; console evidence tactical-production-aec5695-second-run.txt. All prior production/audit evidence remains intact.

Exact commands, install cwd _artifacts/tactical-production-aec5695:

~~~powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
npm ci --omit=dev --ignore-scripts --no-audit --no-fund --offline --cache D:/Widegames-work/npm-cache
~~~

Then cwd D:/Widegames-work/tactical-maps-builder-20261029:

~~~powershell
$env:TACTICAL_PRODUCTION_REVIEW_ROOT=(Join-Path (Get-Location) '_artifacts/tactical-production-aec5695')
node --check tests/tactical-map-production-review.mjs
node tests/tactical-map-production-review.mjs
git diff --check
~~~

Limits: production-only local Windows process/HTTP/WS/file restart and source graph, not Docker execution/Linux/hosted deployment, OS-delivered POSIX signal, ACL/power-loss/crash recovery, browser visual/audio/input, complete matches/full unit suite or original live model adapter/provider qualification. Legacy samples are paused synthetic checkpoints. The existing live-provider adapter was never invoked. No Chrome, Docker, paid/provider calls, broad suite, npm updates, root/runtime/shared/public/other-worktree edits, main/push/deploy or updater work occurred. Manager owns integration/publication; this receipt does not deploy anything.

## Final narrow production asset closure: exact53286ca

**Same25/25 production checks passed** at frozen **53286ca1df771dbca6c4e19417d8b10bb9a929e0**, first run for this pin, no failure/skip. Compared actual full Git diff with prior qualified **aec5695236acf4e51ec87f2c27425a29573003d3**: the only deployed delta is **public/world/beacon.css**, adding a separate mobile mute rail and related positioning rules. server/shared/package.json/package-lock.json/Dockerfile are unchanged; the remaining changed paths are tests/docs/scripts. Runtime paths and imported module graph remain the same. CSS blob changes cbdcb8ceeb7acf400c79700ec8767e77d8abb9fb -> b77603635b5c6aa375637dc530a538d6c3cf6d71. No runtime/source edits were made for this closure.

The owned standalone harness now accepts **TACTICAL_PRODUCTION_REVIEW_PIN** (full40-character lowercase Git hash). With no override, it preserves exactAEC as its default. Archive default derives as own _artifacts/tactical-production-<pin7>; each fresh evidence directory derives as tactical-production-<pin7>-run-<unique>. Existing optional TACTICAL_PRODUCTION_REVIEW_ROOT remains supported and constrained inside own ignored artifacts. Only pin/path default handling changed; all25 check labels and behavioral assertions are identical, verified by comparing successful report check arrays. The original AEC report/archive and initial AEC failure remain untouched.

Fresh exact raw archive _artifacts/tactical-production-53286ca contains **287 source blobs**,72 runtime files and43 public/shared assets. All counts derive from its verified manifest. Canonical Git blob IDs/SHA256 checked on extraction; all287 source hashes verify unchanged after execution. Tar exact Git PAX pin verified, SHA256 **8e360a3b4b67f99996051290d51cc078e624e8e8482e1560cfadc1dbe32ece10**. Comparison JSON records actual CSS-only deployed diff. Production install was offline with D: cache/temp, ws8.22.0 only; Puppeteer remains absent. All43 assets, including changed CSS, were fetched byte-exact. Local import edges150 and extra browser references5 are unchanged from AEC.

Actual runtime execution retained both maps' authenticated pre-start settings and starts, HTTP/WS privacy/source permissions, real note/input and accepted receipts, graceful actual-main shutdown and restart on the same isolated data, exact identity/map/settings/notes/reservation retention and bit-exact paused legacy1/2/3 files. Two real mains (PIDs7460/8904) both exit0/signalnull through the real SIGTERM handler invoked via Windows IPC. **0 external provider fetch attempts,0 forced stops,0 socket privacy errors**,5896ms. No new assertion or fixture correction was needed. Production-only runtime qualification applies to532; this does not independently qualify mobile layout pixels/browser behavior.

Copyable evidence paths, relative to D:/Widegames-work/tactical-maps-builder-20261029:

- Report: **_artifacts/tactical-production-53286ca-run-d8A2ut/report.json**
- Manifest: **_artifacts/tactical-production-53286ca-manifest.json**
- Source comparison: _artifacts/tactical-production-53286ca-comparison.json
- Raw tar: _artifacts/tactical-production-53286ca.tar
- Install/run logs: _artifacts/tactical-production-53286ca-install.txt and tactical-production-53286ca-run.txt

Exact install command (cwd _artifacts/tactical-production-53286ca), then harness from assigned worktree:

~~~powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
npm ci --omit=dev --ignore-scripts --no-audit --no-fund --offline --cache D:/Widegames-work/npm-cache
# Return to assigned worktree root.
$env:TACTICAL_PRODUCTION_REVIEW_PIN='53286ca1df771dbca6c4e19417d8b10bb9a929e0'
Remove-Item Env:TACTICAL_PRODUCTION_REVIEW_ROOT -ErrorAction SilentlyContinue
node --check tests/tactical-map-production-review.mjs
node tests/tactical-map-production-review.mjs
git diff --check
~~~

Limits remain those of the AEC receipt: local Windows main/process/HTTP/WS/ordinary store restart and byte-exact packaging, not Chrome/browser, Docker/Linux/hosted deployment, full matches/suite, power-loss/ACL or original live-model/provider qualification. No Chrome, providers, full suite, runtime/other-worktree edits, main/push/deploy or new features. Only harness parameterization and this receipt changed; qualification closure is finished.

## Last frozen production asset closure: exact104f494

**25/25 unchanged production checks passed**, first run, at final frozen **104f494d6c575901b113cbf2ba57960365326355**. Actual53286ca1df771dbca6c4e19417d8b10bb9a929e0 ->104 Git diff confirms **public/world/beacon.css is the sole deployed/runtime delta**: the mobile equipment toggle joins the separate lower control rail and its pane ends above that rail. CSS blob b77603635b5c6aa375637dc530a538d6c3cf6d71 ->71cdc03c823c5679b852556977b2190b9ca9612a. Server/shared/package/lock/Dockerfile are unchanged; remaining changes are non-deployed tests/docs/scripts. This qualification verifies served CSS bytes and production behavior, not screenshot/layout geometry; manager owns the concurrent browser run.

Fresh ignored exact archive _artifacts/tactical-production-104f494: **288 canonical raw Git blobs**,72 runtime files,43 public/shared assets,150 local module edges and5 literal browser asset references. All counts derive from the manifest. Raw blobs verified against Git object IDs on extraction and all hashes verified again after execution. Tar PAX pin matches exact104; tar SHA256 **b5dab45f3e363befc30acffe6aa4eea5833709047112c1b97a3b109992975eb8**. Source comparison JSON records the unchanged runtime path set and CSS-only delta. Offline production install used only ws8.22.0 with D: cache/temp; Puppeteer absent. No overlays or source changes.

The parameterized standalone harness was used **unchanged**, Git blob bd05fc87fec52c5323563a3275c744f5e5d7551b. TACTICAL_PRODUCTION_REVIEW_PIN selects104; archive/evidence defaults derive from it. Same25 report check labels match both preserved AEC and532 reports exactly. Real normal-default schema4 main exercised both authenticated settings/start maps, HTTP/WS roles/position/private data and source permission checks,43 byte-exact assets, real notes/input/action receipts, same-DATA_DIR identity/map/settings/note/reservation restart, and sampled paused legacy1/2/3 file preservation. No runtime flags or dependencies were injected. The existing synthetic uncertain daily reservation remains explicitly labeled no-provider-send, not claimed live usage.

Actual run **6609ms**, two child main PIDs16132/24440 both naturally exit0/signalnull through the real SIGTERM handler via Windows IPC. **0 external provider fetch attempts,0 forced stops,0 socket privacy errors**. All288 archived source files remain unchanged. AEC/532 archives, reports and earlier failure evidence remain preserved.

Final copyable paths relative to D:/Widegames-work/tactical-maps-builder-20261029:

- Report: **_artifacts/tactical-production-104f494-run-MWbXsv/report.json**
- Manifest: **_artifacts/tactical-production-104f494-manifest.json**
- Source comparison: _artifacts/tactical-production-104f494-comparison.json
- Raw tar: _artifacts/tactical-production-104f494.tar
- Install/run logs: _artifacts/tactical-production-104f494-install.txt and tactical-production-104f494-run.txt

Exact install command (cwd _artifacts/tactical-production-104f494), then unchanged harness from assigned root:

~~~powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
npm ci --omit=dev --ignore-scripts --no-audit --no-fund --offline --cache D:/Widegames-work/npm-cache
# Return to assigned worktree root.
$env:TACTICAL_PRODUCTION_REVIEW_PIN='104f494d6c575901b113cbf2ba57960365326355'
Remove-Item Env:TACTICAL_PRODUCTION_REVIEW_ROOT -ErrorAction SilentlyContinue
node tests/tactical-map-production-review.mjs
git diff --check
~~~

Limits remain: loopback Windows main/HTTP/WS/ordinary restart and exact source/assets, not Chrome/browser, Docker/Linux/hosted deployment, full unit suite or full matches, crash/power-loss/ACL or live provider qualification. No new test, harness/runtime/other-worktree edit, feature/review, Chrome, provider, broad suite, main/push/deploy. **This closure changes only this document and finishes the assigned last asset qualification.**
