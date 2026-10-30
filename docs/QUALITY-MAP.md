# Quality map implementation

Foundation: `941e857f046ef7cc9bae25f0fcad27cf6ab7578a`. Ownership is only shared/maps, quality-map tests and this receipt. No root/schema/persistence changes.

## Early coordinate and metadata milestone

`shared/maps/beacon-v2.mjs` exports immutable `BEACON_V2`. Registry `getMap('beacon')` now selects version2; exact `{id:'beacon',version:1}` and omitted reference still resolve original version1. Annex1 remains exact and latest. Catalog remains two entries. Existing default config already selects the string Beacon ID; manager owns schema5 opt-in and migrations.

Beacon2 is an original 3200?2400 storm-service ship, not a copied Skeld layout or claim about official dimensions. Four cross-decks and four intermittent longitudinal galleries form20 room-to-room links and alternate loops. All rooms are500?340; deck centers y360/900/1440/1980; column centers x400/1200/2000/2800. Top row omits x400, bottom omits x2800. Speed remains180 units/s.

Rooms in deck order: bridge/navigation/conservatory; archive/infirmary/communications/lantern; ballast/workshop/cargo/engine; docking/galley/reservoir. Display coordinates are world x/32,y/24. Stations are center+(150,65). `taskKinds` maps every room to a supported station-contract kind; all six kinds occur. `art.rooms[id]` exposes theme and six props: four solid console/equipment/locker/bench and two non-solid window/pipe details. Every solid is the identical rectangle in WORLD_OBSTACLES. Clear central lanes/entrances remain authoritative. Frontend may render these immediately.

Fixtures are in descriptor.fixtures, with geometry.fixtures the same object. Five corridor doors, six reciprocal linked hatches, two distinct rooms for each critical, three devices, three explicitly scoped camera cones (radius280/300, FOV?/2). No actor or private state is map metadata. Bell/spawns/viewpoint are Bridge. World path caches remain descriptor-local and bounded by grid nodes/adjacent edges; no current-map singleton. Twelve arbitrary-ID spawn allocation is handled by existing spatial runtime collision fallback, to be qualified in next milestone.

Early tests check registry permanence, unknown versions, map dimensions/room IDs, six task kinds, static station walkability, immutable metadata and exact solid/collider agreement. Full route matrix, door pairs, fixture/roster/restart isolation and measured timings follow; this milestone does not claim browser or completed-match qualification.
