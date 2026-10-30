# Illustrated main integration contract

Baseline main668a867e069c7fb3aafbc69bbf9e6c42d1607eb7. Current combined candidate preserves all prior sources and new main files; conflicted runtime modules initially retain the composed quality implementations pending adaptation. No qualified main merge yet.

## Stable executable map exports

shared/maps/index.mjs exports getMap(reference), getLegacyMap(mapId=beacon,revision=1), mapFor(value), mapIdentity(reference), MAP_CATALOG, TACTICAL_MAP_CATALOG and PUBLIC_MAP_CATALOG.

- getMap(undefined) and exact {id:beacon,version:1} retain original Beacon geometry.
- getMap({id:beacon,version:2}) is permanently quality's fourteen-room3200x2400 tactical Beacon, now sourced from beacon-tactical-v2.mjs. Never overwrite it with the new main descriptor.
- getLegacyMap(beacon,2) wraps main's six-room illustrated Beacon1600x1200 and has selection alias id:beacon-illustrated. getMap(beacon-illustrated) and exact {id:beacon-illustrated,version:2} return it. Its persisted world2 identity remains mapId:beacon,mapRevision:2, not the alias.
- getLegacyMap(storm-foundry|tidal-observatory,1|2) preserves each original physical revision. getMap strings select latest revision2; exact version1 and absent legacy mapRevision remain revision1.
- getMap also accepts strict {mapId,revision} references for legacy views. mapFor resolves .map exact tactical/selection references or .mapId/.mapRevision; it rejects conflicting identities/namespaces.
- mapIdentity yields a stable namespace key. Use it for geometry/presentation/request-lifecycle caches; naked id/version is insufficient for Beacon's two namespaces.
- Legacy wrappers expose .legacyMapId, .legacyRevision, .reference:{mapId,revision}, .tactical:false, .taskProtocol:taskStep, .geometry identical to getWorld(canonicalId,revision), .metadata and authored .tasksPerCrew.
- Public catalog retains its five established fields. Five current selections: tactical Beacon, Annex, Foundry2, Observatory2 and Illustrated Beacon. Original revision1 saves remain selectable by exact API identity, not silently migrated.

## Engine and persistence

World2 remains schema2, mapId canonical plus optional mapRevision2; absent mapId means beacon and absent mapRevision means1. Preserve main's illustrated Beacon three jobs/keeper and original five room-derived v1 taskStep puzzles; expanded maps retain twelve jobs/keeper and eleven explicit-kind v2 taskStep puzzles. Tactical schemas4/5 retain exact .map and station/relay behavior. No cross-protocol conversion.

Use native legacy getWorld geometry/pathfinding for world2 revision2 polygon floors, walls and sightlines. Quality createSpatialWorld's rectangle-only geometry must not silently replace illustrated shape collision. Main getWorld/getShape helpers are already preserved. Default combined tactical Beacon remains the fourteen-room watch; illustrated Beacon is explicitly accessible through its alias. Programmatic world2 requests and existing main668 saves keep canonical mapId/mapRevision semantics. A trusted legacy config mapRevision2 must work without tactical mode.

Replay v1 records canonical map string plus optional mapRevision2. Replay v2 remains exact tactical map/version, dynamic roster and strict mapped evidence. Both must preserve private-role/fallen-chat boundaries and original limits. Room/state map bindings compare resolved namespace, not alias string alone. Future revisions fail closed without rewriting/quarantining valid newer data. Preserve all identity/action receipts/reservations/backups.

## Client and root

mapReference(room) emits legacy {mapId,revision} or existing exact .map. Normalize presentation only with resolved references; do not reinterpret mapId:beacon,mapRevision2 as tactical Beacon2. Include namespace in leases, samples and replay identity. Render main's interior-art for illustrated geometry while retaining quality tactical art and bounded terrain caches. Source shape geometry governs walkability. Keep private owner inspector, unknown public information, ghost/task controls, Ward, council and lifecycle guards.

Coordinator owns shared world/map registry, root configuration/docs and scripts. Core owns engine/replay/AI revision adaptation. Integrations owns config/room/store/transport/inspection revision binding. Frontend owns public/world including movement helper and interior-art integration plus UI tests. Separate D: worktrees from the shared prepared registry commit. No paid calls/deployment/main writes before complete qualification.
