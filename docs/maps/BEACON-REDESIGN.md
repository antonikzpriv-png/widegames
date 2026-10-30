# Lantern Wake deck revision 2

The original beacon is now an asymmetric cutaway rather than six identical-looking rooms attached to a cross. Its six canonical room IDs and three-tasks-per-crew workload remain intact. This is original Lantern Wake artwork and geography; no reference-game layout or assets are included.

The Bridge is an octagonal command gallery with a long navigation desk, individual signal cabinets, a central storm chart and a clear muster area. The port Archive has weather-cylinder stacks, an index desk, recording drum, chart press and a narrow drying rack. The projecting Lantern chamber has an independently recognizable Fresnel prism, a calibration table, optical driver and lens cases. Workshop has an L-shaped footprint with a soldering bench, central relay, tool wall and spare armature. Galley has two different dining tables, a copper cooking line, cold store and separate sink. Engine has a stepped outline around a large alternator, flywheel, pressure bank, governor and oil pump.

Nine authored passages create several routes between the six rooms: the port archive/service loop, central command/relay spine, starboard pressure riser and long aft transfer walk. Doorways are real connected floor geometry. Solid furniture has matching collision footprints. Clipped corners are exterior space, not painted rectangular floors.

Technical decorations include hull glazing, safety rings, pipes, cables, vents, deck grates, warning plates, corridor equipment, room identities and warm/cool equipment lighting. The map contains 44 authored solid props across 24 equipment kinds and 86 non-solid decoration entries. All six starting positions, every task station and the emergency bell have collision-safe routes.

`tests/redesigned-beacon-data.test.mjs` independently checks frozen descriptors, canonical IDs, differing room silhouettes, reciprocal graph links, prop containment and exact geometry reachability with a 14-unit body radius. Existing saved matches and replays keep their own geometry revision; new matches use the redesigned deck through the server's revision selection.
