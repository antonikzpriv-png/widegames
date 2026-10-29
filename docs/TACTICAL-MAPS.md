# Tactical map implementation

Foundation265804446e37b8847d43b31875cf9f6ea3c81c33. Core owns shared/maps, spatial runtime and tactical-map tests only. Schema1/2/3 legacy orchestration remains coordinator-owned.

## Frozen fixture milestone

Registry exports DEFAULT_MAP_ID, deepFreeze, MAP_CATALOG, getMap(reference?), mapFor(stateOrView). New exact identity {id:'stormbreak-annex',version:1}; default remains beacon. Unsupported versions fail explicitly. Descriptor retains the executable contract shape and immutable map-local geometry/caches. No shared/world.mjs or original fixture edits.

Stormbreak Annex is1800x1400 with eight named rooms. Northern ring, cross-deck bypass, central riser and western/southern loop provide alternate routes. Echo Observatory is an isolated eastern spur accessible through Tide Clinic; it deliberately has no southern connection. Five door thresholds all lie on loops, outside stations/spawns; no door seals the isolated spur. Twelve distinct Muster Hall spawns, fixed Muster viewpoint/bell, four linked passages, six repair sites, three devices and three cameras. Existing fixture field shapes preserved, Annex IDs are distinct. Display coordinates use percent units, rects use world units.

Coordinator: assign exact map before initialize/task generation; use geometry.ROOM_LAYOUT/WORLD_VIEWPOINT/WORLD_SPAWN_ROOM and fixtures. Integrations: resolve five Annex door rectangles by map; grace/occupancy checks must include body-radius overlap before setting closed. Spatial runtime refuses collision and invalidates blocked routes, but never teleports occupants; systems must defer/jam occupied thresholds. Device/camera owner must resolve Annex fixtures.

Initial controls use real public geometry: registry/default exact legacy equivalence; immutable graph with cycles/spur;12 nonoverlapping spawns; every fixture and56 ordered station routes; interleaved original/Annex caches. No provider, browser or root tactical lifecycle qualification implied. Spatial metadata adaptation follows as a separate milestone.
