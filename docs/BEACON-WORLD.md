# Authoritative schema3 spatial world

Owned factory: createSpatialWorld(geometry), exported by server/engine/world/index.mjs. Foundation a431e5e80fad153d9aab892a1e9e727ef11fc5a3. Early geometry/motion milestone136caa206e319f6f1afcd2a7a3b8de22ff057f5b; the completed module adds bounded observation knowledge and safe projections. Only schema3 orchestration selects it. Legacy server/engine/world-runtime.mjs, engine orchestration and schema1/2 files remain untouched.

## Exact interface

Factory returns the frozen-contract surface: initialize(state,now), settle(state,until,record), stop(state,p,at,reason,record), stopAll(state,at,reason,record), navigation(p,target,now,state), navigate(p,target,path,now), input(p,{seq,dx,dy},now), moving(state,p,now), walkable(point,state?), station(roomId), bell, WORLD, point(value), sees(from,to,state?,observerId?), nearby(from,to,range?,state?,actorId?), observe(state,now,record), projectWorld(state,viewerIdOrNull,now). Additive helpers:

- validateSpatialState(state) returns true or throws on invalid motion/knowledge. Root/store should call this for schema3 restores, alongside systems/investigation validators.
- adoptVitals(state,playerId,{at,players:[{id,alive}]},now,record) accepts a normalized trusted terminal sample for one owner. It is not a client action endpoint. Future timestamps, unknown IDs, false death of a currently living actor, duplicates/extra fields and resurrection of known death are denied without mutation.

initialize modifies only player.position, player.roomId, player.motion, player.knowledge and state.spatial. It deliberately does not select schemas/roles/configuration. Existing geometry spawns are retained where distinct; public custom roster IDs receive deterministic collision-safe distinct Bridge fallback positions. Module limit32 players; current coordinator lobby limit is4?12. No assumption that a human must be p1. No Date.now, randomness, async/providers or per-match process/global caches.

## Geometry, movement and hints

Authoritative speed/radius/lease come from shared geometry:180 units/second, body radius14, input lease600ms; steering diagonals normalize. Movement uses small collision steps and bounded navigation grid searches. Closed rectangles come only from public BEACON_DOORS fixtures selected by systems.doors closed flags. A route proposed while a door is open stops physically if it later closes; no crossing or teleport occurs. Opening permits a newly computed route. Door-aware BFS caches are local to one call, so doors cannot leave stale cross-match cache entries. Targets and routes validate finite, walkable coordinates; returned paths end at the exact target and are bounded4096 points.

Both props and doors occlude line of sight; raw floor geometry is used rather than the legacy canSeeWorldPoint360 cap. visionRadius, lightsVisionRadius and saboteurVisionRadius are respected. Lights reduce crew/fixed-camera radius; saboteur radius remains its configured value. nearby requires configured sight as well as requested distance, preventing close-range actions/hints through walls, props, doors or darkness. Dead/transit observers cannot see/interact; moving returns false during transit and settlement clears preexisting movement. Context must pass state and actor ID for these permissions. The module owns proximity primitives; root/systems/investigation own hint descriptors and use those same primitives for validation.

Input helper validates integer axes/positive safe sequence, finite server time and exact input fields; old/equal sequences are inert. Root owns envelope denial receipts and conflict responses. Navigation copies waypoints/destination and rejects malformed or backward-time commands. State remains JSON-safe. Existing private motion shape is retained: seq,dx,dy,leaseUntil,at,manual,path,destination,recordedAt,error. Bounded samples/stop/arrival records go only to the supplied private record callback; no public event is emitted by this module.

## Private knowledge and safe projection

player.knowledge={version:1,roster:[{id,status,alive,at,source}],events:[],bodies:[],sequence,witnessCursor,musterId}. status is unknown/alive/dead; unknown alive is null, never inferred from hidden actual alive. A previously seen living player stays last-known alive after an unseen death. Position/room are only current permitted observations, not a remembered route. Death becomes known by current body sight, an explicitly authorized witness, own death, owner-only vitals, or meeting muster. Known death cannot be undone by stale samples.

Events cap at min(beaconRules.observationLimit,64); body dedup and roster knowledge cap at player count. Private IDs/cursors survive JSON restart and prevent old witnesses being reissued after history eviction. Body entries carry original death at and actual observedAt separately. No attacker attribution is invented for a body. Witnesses copy only permitted fields from private records carrying visibleTo; that recipient list is never sent to a client. Meetings disclose actual roster life status once per meeting to all viewers, without revealing remote coordinates or roles. No global elimination event is emitted here.

state.spatial={version:1,spectator:{position:{x:800,y:285},knowledge:...}}. Pre-end spectators have a fixed Bridge viewpoint and their own local knowledge, subject to lights/props/doors. The viewpoint does not follow players or secret transit. Remote deaths remain unknown/last-known until observed or disclosed by muster. Secret transit positions/metadata are withheld from others. Ended projection reveals every actual role/status/position. Invalid non-null viewer IDs reject. projectWorld returns fresh defensive players/localEvents/vision and never mutates state.

Native owner-only vitals adoption is built into observe: state.investigation.observations[playerId] entries matching the investigation owner's exact {id:'obs:<owner>:<device>:<at>',deviceId,kind:'vitals',at,data:{players:[{id,status:'alive'|'dead'}]}}. Known public vitals device, encoded owner, finite elapsed time and bounded roster are checked; normalized adoption updates only that owner. Cameras/occupancy never become death knowledge, and no other actor's read is consulted for this viewer. This shape was inspected read-only in the investigation owner's working data.mjs; its complete read/session implementation still needs coordinator integration qualification. The explicit normalized helper is available if that owner interface evolves.

## Root integration requirements and limits

Root must refresh observe after each movement settlement and accepted action, supply a private record function, use projected players/localEvents/vision, omit schema3 global eliminated events, and defer dead task transfer until meeting muster. Root must split settlement at system deadlines before doors/lights/transit change. Root must reject input/actions by actors in transit and explicitly exclude transit targets when enumerating action/hint targets: a plain point does not reliably identify a target actor. Self-owned transit state remains systems/root owned. Door travel/repair/vent permissions and arrival teleport belong exclusively to systems.

NEXT_FEATURE_INTERFACES.md was absent from the foundation; no group2 reserved feature implementation or other-owner source is edited. Observations are taken at supplied authoritative settle/action times; the module does not invent intermediate sightings during missed server ticks. World helper state is mutable only because root calls it on engine-cloned state. These are module/interop checks, not independent approval of Core's own code or full browser/production qualification.

## Meaningful checks and exact sources

17 module controls cover geometry/diagonal speed/lease/collision; door closure and reopening/path cache invalidation; props/doors/configured vision over360/lights; transit restrictions; hidden and last-known deaths; body discovery and separate death/observed times; fixed spectator; owner-only witnesses and bounded-history dedup over restart; muster; normalized/native owner vitals; defensive frozen projections; malformed state/input;100 muster histories and a deterministic300-input movement/JSON trace. Initial knowledge run13/14 passed: the remote-position muster assertion accidentally placed its observer next to the corpse. The corrected fixture moves that observer to Bridge; assertions retain actual remote privacy. Initial output remains _artifacts/beacon-world-knowledge-first.txt.

Three actual-engine controls use coordinator commit1fb059ea55bb7a319288d55ba721c1ed98eb1106 plus only this owned world module in _artifacts/interop-1fb059e. They prove actual custom-human schema3 creation/world markers, schema1/2 separation, physical navigation/remote hidden death/actual witness/report muster and deferred task transfer, plus an84-unit bell blocked by the chart table with both action hint and actual request denied. No hidden-state edits, teleports or fabricated results in these interop tests. This is an explicitly labeled composite, not a claim the manager already integrated the new module. Exact overlay hashes are in interop-1fb059e-manifest.json. The three interop cases skip only on an owner foundation lacking schema3 orchestration; an explicitly provided root that lacks schema3 fails. Ordinary geometry/knowledge tests never depend on that opt-in root.

~~~powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
$env:BEACON_WORLD_ENGINE_ROOT=(Join-Path (Get-Location) '_artifacts/interop-1fb059e')
Remove-Item Env:WORLD_ENGINE_GEOMETRY_MODULE -ErrorAction SilentlyContinue
node --test tests/beacon-world*.test.mjs
node --check server/engine/world/index.mjs
node --check server/engine/world/geometry.mjs
node --check server/engine/world/motion.mjs
node --check server/engine/world/knowledge.mjs
git diff --check
~~~

Full scoped result:20 passed, zero failure/skip with the explicit actual-engine composite. Prior module-only17/17 output is _artifacts/beacon-world-module-final.txt; actual-engine first3/3 is beacon-world-interop-initial.txt; final all20 is beacon-world-final.txt. No npm/dependency updates, paid/provider calls, Chrome, push/main/deployment, legacy/runtime/shared/root edits or other-worker-tree changes. Manager independently reviews/integrates the exact commits.
