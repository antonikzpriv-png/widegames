# Larger-map presentation

The pre-match host chooses the original Lantern Wake deck, Storm Foundry or Tidal Observatory with the native **Choose a map** selector. The description states the selected deck's dimensions, number of rooms and default crew assignment count. Starting sends the map ID with the existing ghost/ability preset; a running match uses only the server's saved `game.mapId` and cannot switch geometry through the lobby control.

Each game surface resolves its own `getWorld(mapId)` geometry. Navigation checks, contextual station/kill/report ranges, task sessions, room names, the mini-map and camera use that same instance. Spectator following and the existing spatial-replay scene options remain supported. The whole-map view uses each map's actual dimensions rather than the original 1600×1200 bounds, and concurrent map canvases do not change one another.

New room names, palettes and descriptions are drawn from the map descriptor. Machinery, tanks, storage shelves/crates, tables, planters and equipment panels are painted at their actual obstacle footprints. The larger maps also draw their supplied landmark labels, lights and deck stripes. Legacy beacon artwork keeps its original positions and illustration. Movement collision remains owned by shared geometry; presentation does not remove walls or expand sight permissions.

The HUD names the selected map, the mini-map lists room names, and long assignment lists scroll within the existing panel so twelve personal tasks do not cover the entire play area. Controls retain native keyboard/touch behavior and focus outlines, with compact layouts for mobile and landscape viewports. The map renderer receives only the existing redacted room view; new map selection does not expose hidden roles, private tasks, routes or ghost positions.

UI checks: `tests/large-maps-scene.test.mjs` verifies all new room names and collider footprints, correct whole-map coordinates and two simultaneous independent canvases. Existing task-session, stale-result and root UI regressions also remain applicable; real room-selection and CAPTCHA browser checks are qualified by the integrated browser driver.
