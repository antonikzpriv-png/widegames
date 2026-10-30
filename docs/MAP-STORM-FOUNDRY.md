# Storm Foundry

Storm Foundry is an original 3,000 × 2,200 storm-powered industrial platform. Its footprint is 3.44 times the original beacon, with twelve named rooms, seventeen shielded passages and six independent route loops. The map supplies twelve tasks per crew keeper when using its expanded preset, for sixty crew tasks before any optional host override.

| North deck | Middle deck | Aft deck |
| --- | --- | --- |
| Tide Archive | Casting Hall | Freight Gallery |
| Foundry Bridge | Relay Workshop | Keeper Galley |
| Prism Lantern | Signal Laboratory | Dynamo Chamber |
| Cloud Observatory | Rain Filtration | Turbine Engine |

Rooms form a four-column, three-row grid. Every adjacent pair has a broad physical passage, and each room's named neighbor list matches that graph. Crossing one deck does not require returning to a single central chokepoint. The Engine is deliberately separated from the Bridge by multiple passages, while alternate horizontal and vertical routes let keepers avoid a recently observed threat.

Each room includes a central industrial landmark, two themed equipment banks and a service locker: forty-eight solid collider props in total. Thirty-six additional floor labels, safety stripes and lamp groups provide readable visual detail. The archive's recording equipment, foundry furnaces, optical benches, telescope cradle, radio racks, rain filters, cargo storage, galley fittings, dynamo equipment and turbines have distinct room descriptions and palettes. Decorative details never create a second hidden collision map.

The six keeper starting positions and emergency bell occupy clear Bridge floor. Every room has its own clear task station point. Ghost movement, navigation, ability targeting, body positions and room transitions use the same authoritative geometry selected for the match. No world wall or obstacle validation is disabled for this larger layout.

The descriptor is immutable and isolated in `shared/maps/storm-foundry.mjs`; map selection must keep geometry scoped to each match rather than modifying a shared global map. `tests/map-foundry-geometry.test.mjs` independently checks bounds, reciprocal neighbors, spawn/station safety, solid landmarks and full-grid station reachability with the ordinary 14-unit actor radius. Both tests pass, including the physical flood check rather than graph-only reachability.
