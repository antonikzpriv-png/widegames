# Tactical investigation implementation

Assigned source:265804446e37b8847d43b31875cf9f6ea3c81c33, branch codex/tactical-investigation-20261029. Only server/engine/investigation/**, tests/tactical-investigation*.test.mjs and this document are owned. These are author checks, not independent approval. Core/manager review remains required.

## First milestone: immutable map adapter and provenance

Existing module signatures and investigation.version1 are preserved. Device/camera fixtures, room identities, map dimensions and static walkability now come from getMap(state.map). Existing schema3 with absent map resolves the original Beacon; its sample IDs, session/frame/observation fields and private replay shapes remain unchanged. Tactical schema4 requires tacticalVersion1 and exact persisted map identity. Unknown map/version fails, never silently substitutes Beacon. No global current-map value or mutable fixture copy is used.

New schema4 sample fields are map:{id,version} and provenance:{type:'device',ownerId}. Existing id/deviceId/kind/at/data remain: deviceId identifies the actual source and at is the authoritative completion time. The owner-bound ID format remains obs:<owner>:<device>:<at> for compatibility with Core vitals adoption. These are actual typed device observations; no say claim, attacker attribution or decoy is synthesized. Schema4 sessions and private device records also carry map identity. Private records retain visibleTo:[owner]. No publicEvent or spectator omniscience is added.

Schema4 camera frames additionally contain field:{origin:{x,y},radius,facingRad,fovRad}, derived solely from their packaged camera and actual normal/lights radius at sampling. They retain cameraId/limited/players; at most six living visible nontransit actors per frame, at most eight public camera fixtures. Each actor row has only id and sampled position. Dynamic LOS comes from ctx.sees at the camera origin. Camera role never grants saboteur bonus. Restore validates exact map/source/owner, canonical field origin/FOV/radius and every sampled position inside that field and selected map. It does not re-test historical samples against present doors/lights/deaths: old frames remain historical data, never live tracking.

Occupancy enumerates every room in selected map.roomLayout and classifies positions using its canonical geometry.worldRoomAt, ignoring stale player.roomId. Corridors, dead actors and secret transit are excluded; no identities or roles are present. Vitals reads only roster id/alive values and returns statuses without roles/routes/positions or attack claims. No fixed roster/six-room/Bridge helper is used by investigation.

Start requires canonical actor, stationary point contact and ctx.nearby/ctx.sees. Deadline and read-only view/action checks revalidate anchor, motion/path, death, phase, transit, communications and dynamic access. Invalidating a read produces no sample. A late call fails stale rather than assigning old time to present telemetry. Root must keep its existing chronological deadline integration and advance after accepted movement/system/death changes. Pure view/validation never mutates state; mutation hooks cancel reads and charge cooldown on the engine clone. Communications reports unavailable and retains earlier dated samples. Histories remain bounded64 and owner-only, with defensive exported copies and strict JSON restore validation.

Integration requests: coordinator should preserve the schema4 map/provenance fields in evidence projections; frontend should label samples historical and draw the recorded field/entities, not the live global roster. Root selects ctx.geometry and ctx.nearby/sees from the same immutable map before initialization. No shared/root/AI/UI files are edited here. Sample map/provenance and camera field are additive only in schema4; old schema3 records do not require migration.

## First milestone checks and limits

Node24.20.0. TEMP/TMP D:/Widegames-work/temp, npm cache D:/Widegames-work/npm-cache. New tests import the current checkout by default; optional TACTICAL_INVESTIGATION_ROOT selects an explicit source layout. Every packaged MAP_CATALOG entry runs the same substantive map tests. At this milestone only Beacon is committed in the assigned registry; Annex is not falsely claimed tested or replaced with a synthetic six-room map. Author fixtures have12 custom IDs and inject authoritative positions solely for module boundary tests; ctx delegates real Core LOS. They are not played matches.

Commands: node --test tests/tactical-investigation-map.test.mjs; node --test tests/beacon-investigation-module.test.mjs tests/beacon-investigation-engine.test.mjs; node --check for both owned runtime files; git diff --check. Legacy32/32 passed. New checks cover provenance, camera bounds, privacy, anonymous actual-room occupancy, vitals forbidden-property getters, malformed restore, exact deadlines/restart, pure stale views/actions, movement/death/phase/transit/comms/LOS cancellation and legacy record compatibility.

Preparation errors are not product claims: an initial Python locale read converted the existing data.mjs UTF8 BOM into invalid text; syntax caught it before any test ran, and explicit UTF8 normalization fixed it. First tactical run15/16: a test incorrectly required a communications error string from an already-dead actor; dead access denial is also correct. The assertion was split to verify explicit communications unavailability while living and denied access after death. No test is skipped or defect hidden.

Annex fixture and actual schema4 engine integration remain pending the other owners' committed source; a subsequent receipt will pin/test them. No Chrome/provider calls/main/push/deploy, broad unrelated suite, other-worktree edits or independent approval is claimed.

## Committed Annex fixture qualification

Core map source **19e4bf6b0027590df3ea2245a164d5174aabb603**, combined only with investigation source **2119e021cd31dc9aad7d1727101af8c2b49a7466**, in ignored _artifacts/tactical-investigation-annex-19e4bf6. All server/shared files came from that committed Core tree; only the two investigation files were overlaid from the exact owned milestone. The source-manifest records both pins and SHA256 for every file. This is an explicit author composite, not claimed manager integration or independent Core approval. Manifest SHA256 **BC90C09BEAD376153B1516C577A72BBC882E702408B4027704F833233A446BF6**.

Both real packaged maps now run35/35 module checks, zero failure/skip. Annex occupancy explicitly returns its eight actual room IDs; living room occupants are counted anonymously while dead/transit/corridor actors are excluded. Added controls interleave Beacon/Annex reads with the same owner ID, compare map-derived console hints and all room IDs, and reject cross-map sample transplantation in both restore validation and safe view. Historical light-radius fields remain unchanged after lighting restoration. Each owner can retain exactly64 observations: read66 evicts only the first two dates, preserves the remaining source/map/owner metadata through JSON restart, and never shares history with another actor. Restore also rejects a sampled position that is walkable elsewhere on the selected map but outside the camera's recorded field.

Actual commands:

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
$env:TACTICAL_INVESTIGATION_ROOT=(Join-Path (Get-Location) '_artifacts/tactical-investigation-annex-19e4bf6')
node --test tests/tactical-investigation-map.test.mjs
Remove-Item Env:TACTICAL_INVESTIGATION_ROOT
node --test _artifacts/tactical-investigation-annex-19e4bf6/tests/tactical-investigation-map.test.mjs
```

For the second command, the owned test was copied unchanged into the ignored composite's tests directory to verify default relative source imports. Both invocations pass35/35 with zero skipped/todo/cancelled. Explicit-root evidence _artifacts/tactical-investigation-annex-bounds.txt SHA256 **51F3224A284B22CEE81055FD7F305F4462BF829C15BD70DF38D75BAC6AF5556B**. Default-import evidence _artifacts/tactical-investigation-annex-default.txt SHA256 **33FF084D10432050C23CAD2DAE8382C127E2DA50002C7570104C80D4078E3ECC**. First current-checkout milestone result48/48 (16 tactical Beacon +32 legacy) is preserved in _artifacts/tactical-investigation-milestone.txt SHA256 **7ADA86AFF243D1AF9ABEFC3A23AD949503600B0F436B1DFFB7BCC15192A19604**.

Manager integration gap reported promptly: server/features/strategy/index.mjs deviceFacts still truncates occupancy to six rooms; Annex's eight-room sample requires a map-aware bound there, along with preserving the new source/map/provenance metadata. That is coordinator/Group2 ownership and is not edited here. Prepared real schema4 engine tests require a committed coordinator runtime; current uncommitted candidate is not qualified as a final source. Module tests use actual map geometry and real Core LOS delegation, but this composite's Core spatial wrapper predates its forthcoming map-aware dynamic-door update; Annex dynamic-door physics is not claimed qualified by these module checks.

## Actual schema4 engine author qualification

Exact committed-source composite (all dependencies read-only): coordinator **58497fe0415d9c0654f4f9dc3debeab8ac03cd40** server/shared; Core **6f61f58e0ef8a1d30131b275fdcf7796dd2af37c** shared/maps/** and server/engine/world/**; Systems **b99d5327cdc5d45f2df907c45cabbd8b52e92c66** server/engine/systems/**; owned investigation **2119e021cd31dc9aad7d1727101af8c2b49a7466** server/engine/investigation/**. This is an explicit author qualification composite, not an invented single integrated commit. Files were extracted with git show exact-pin:path; no uncommitted candidate files were used. Ignored layout _artifacts/tactical-investigation-engine-58497fe, source-manifest.json SHA256 **EF176A5A7015620C75E9BEBD2B9FA1E554F93A8264EC70182FE5718F76FB0343** lists every final file's owning source pin/blob/SHA256.

New tests/tactical-investigation-engine.test.mjs uses actual createMatch({tactical:true,map:{id,version}}),12 custom keepers and real navigation/actions/input/ticks. Fixture clocks are accelerated only for100ms device reads/50ms cooldown and selected ordinary cooldowns. It asserts actual schema4 rather than silently skipping or treating legacy schema3 as success. The harness reads private role/path information only to stage actors and compute travel time, never feeds it to a client/AI and never edits player positions or manufactures outcomes.

All45 scoped tests pass (35 map/module +10 real engine), zero failure/skip/todo/cancelled. For both Beacon and Annex:

- A real stationary camera read restores at its50ms midpoint, then a late tick completes once at original100ms deadline, with exact map/provenance/frame field. A retained action ID repeats without another sample. Other actors/spectator get no session/history; replay remains locked and all device records carry only owner visibleTo.
- Actual movement input cancels the read. A stopped actor can start a later real occupancy read; its rows exactly equal selected map rooms, explicitly eight on Annex.
- Actual communications sabotage cancels immediately with truthful unavailable device reasons; a later deadline creates no fake successful empty telemetry.
- A real remote elimination followed by camera access shows the living attacker at the sampled camera but excludes the dead victim and creates no retrospective witness event/attacker field.
- A real remote elimination followed by a vitals read updates only the reader's learned death status. Another remote keeper and fixed spectator retain their earlier knowledge, no remote coordinates appear, and JSON restart preserves the private dated sample. No attacker witness is manufactured.

```powershell
Remove-Item Env:WORLD_ENGINE_GEOMETRY_MODULE -ErrorAction SilentlyContinue
$env:TACTICAL_INVESTIGATION_ROOT=(Join-Path (Get-Location) '_artifacts/tactical-investigation-engine-58497fe')
node --test tests/tactical-investigation-map.test.mjs tests/tactical-investigation-engine.test.mjs
Remove-Item Env:TACTICAL_INVESTIGATION_ROOT
node --test _artifacts/tactical-investigation-engine-58497fe/tests/tactical-investigation-map.test.mjs _artifacts/tactical-investigation-engine-58497fe/tests/tactical-investigation-engine.test.mjs
```

Second invocation copies the two owned tests unchanged into the ignored committed-source layout, proving default relative imports exercise its actual runtime. Both45/45 and exit0. Explicit-root log _artifacts/tactical-investigation-engine-initial.txt SHA256 **9638C1CA275F9C76EC947633057D4157D84CE9C3F9CB88A827BBB2DC96F0026D**; default log _artifacts/tactical-investigation-engine-default.txt SHA256 **B0397E3F779ACAB9E02F3A69CC6592FD3BE2951DB5BBFA096DB18D374E589E75**. Syntax checks for both runtime files and both tactical tests plus git diff --check pass. The assigned tracked foundation still has the older engine until manager integration; default new engine tests correctly require schema4 there instead of skipping. Manager must integrate the root/Core/Systems dependencies before its ordinary suite.

Implementation is ready for manager/Core independent review. This worker's investigation implementation is never self-approved. No Chrome, full repository suite, HTTP durability, paid/live model, broad match ensemble, main/push/deployment or another worktree mutation is claimed. The requested independent review of another owner follows separately, within the owned test/doc namespace.

## Separate independent Systems/Core follow-up

After completing the authored investigation milestone and real-engine checks, performed the requested independent other-owner review. Owned tests/tactical-investigation-review-systems.test.mjs adds six new controls (three on each actual map). Source remains the exact documented composite: Systems **b99d5327cdc5d45f2df907c45cabbd8b52e92c66**, Core **6f61f58e0ef8a1d30131b275fdcf7796dd2af37c**, coordinator **58497fe0415d9c0654f4f9dc3debeab8ac03cd40**. No other owner's file was edited, and investigation approval is excluded.

Inspected actual system action validation/hints, faction reservation restoration, pending/jammed/closed door transitions, threshold contact, public projection and Core movement segment collision. Exact reviewed blobs:

| Source | Git blob |
| --- | --- |
| server/engine/systems/index.mjs | f55cd4dbcacded735617b830cc83780e81fd1ce9 |
| server/engine/systems/model.mjs | c12bec383a414ac362a9872562b074d0db70d2f0 |
| server/engine/systems/tactical-doors.mjs | e42ea29f0ec9a4aed688344e16a5ce55826aaa06 |
| server/engine/world/geometry.mjs | b74139683158cb29f417114041be79580ec692d6 |
| server/engine/world/motion.mjs | 95ad5c02e8f986af1a3bae7dfd4567116dc98046 |

New independent controls, all6/6 passing with zero failure/skip/todo/cancelled:

1. Twelve custom keepers/two saboteurs: one accepted lights sabotage reserves the faction cooldown. JSON restart does not allow the other saboteur to immediately disrupt communications; exact cooldown boundary allows it. Both saboteurs see the same charged auxiliary deadline, crew gets only its personal passage cooldown, spectator gets none. Lowering a retained active-effect reservation to zero is rejected by the actual validator.
2. Labeled authoritative hidden-position counterfactual: identical clocks/permissions, but one hidden crew member occupies the future door threshold. Actual system action hints are identical before warning. Both actual actions create the same1s pending grace; at closure, the occupied case jams open without displacing/naming the keeper and the empty case closes. Public system records contain no playerId/occupantId/position/visibleTo, and the remote saboteur sees no hidden keeper coordinates. A JSON-restored jam reopens at its scheduled expiry without moving the occupant. Public jam status itself is intended operational information, not asserted absent.
3. Labeled Core starting-position boundary fixture followed entirely by real engine actions/ticks: accept a finite route crossing a currently open doorway, issue warning, close after1s before arrival, then advance movement. The actor stops outside the collider with route cleared rather than tunneling through the newly closed door. At expiry a fresh accepted route reaches the original target. No fabricated arrival, teleport or forced outcome is used.

The position counterfactuals are isolated authoritative fixtures, not claims of reaching those initial coordinates through played routes. Subsequent permissions/warnings/closures/movement/expiry use the actual engine. These cases are novel boundary checks, not a rerun of the other owner's full suite. No concrete Systems/Core defect surfaced in this bounded scope; this does not approve all door combinations, critical repairs, passage abuse, browser lifecycle or hosted deployment.

```powershell
$env:TACTICAL_INVESTIGATION_ROOT=(Join-Path (Get-Location) '_artifacts/tactical-investigation-engine-58497fe')
node --test tests/tactical-investigation-review-systems.test.mjs
Remove-Item Env:TACTICAL_INVESTIGATION_ROOT
node --test _artifacts/tactical-investigation-engine-58497fe/tests/tactical-investigation-review-systems.test.mjs
node --check tests/tactical-investigation-review-systems.test.mjs
git diff --check
```

Both source-selection modes yield6/6 and exit0. Evidence _artifacts/tactical-investigation-independent-initial.txt SHA256 **C1A380AFB45B9C8B5A151CD7414BC6FBE213C68DF054A359CE9FFC4D3D1FC78D**, and _artifacts/tactical-investigation-independent-default.txt SHA256 **44306BB6EEB66DF06F2E0FF3FF214C4330DE87F145DDE052177D4DBAACCEC6B5**. Authored investigation45/45 remains a separate qualification, not independent self-approval. Manager owns integration/browser/full-suite qualification. No additional feature work is introduced by this audit.
