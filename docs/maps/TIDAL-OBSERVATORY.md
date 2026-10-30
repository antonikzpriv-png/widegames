# Tidal Observatory

Tidal Observatory is an original 3,200 × 2,500 world with fourteen named rooms, nineteen 140-unit-wide connecting walks/spines, seventy solid equipment props, and forty-six visual signs/lights. Its bounding area is more than four times the original beacon. It adds a broad perimeter ring and two long inner spines rather than scaling up the original six-room layout. The preset supplies twelve tasks per crew keeper, subject to the host's selected task configuration.

The six established room IDs remain usable as anchors: Observation Bridge, Tide Archive, Great Orrery (`lantern`), Instrument Workshop, Keeper Refectory (`galley`) and Pressure House (`engine`). Eight additional rooms are Chart Atelier, Spectrum Gallery, Seawater Intake, Salt Conservatory, Ballast Vault, Lens Laboratory, Radio Cloister and Sonar Hall. Each has a distinct palette, flavor description, station and actual collision props. Equipment placement leaves navigable lanes around cabinets, instrument benches, tanks, storage and planters.

The perimeter goes Archive → Bridge → Orrery → Chart Atelier → Spectrum Gallery → Pressure House → Intake → Refectory → Conservatory → Workshop → Ballast Vault → Lens Laboratory → Archive. The inner crossing joins Lens Laboratory → Radio Cloister → Sonar Hall → Spectrum Gallery. Radio also links Bridge and Conservatory; Sonar links Orrery and Refectory. This provides alternate routes and meeting points rather than a single central bottleneck.

All six players spawn on clear Bridge deck. The emergency bell is below the north instrument console, with clearance for the normal player collider. The normal world speed, body size, wall collision, visibility rules and authoritative station interaction ranges apply; a larger map does not grant faster movement or reveal distant actors.

Map data is in `shared/maps/tidal-observatory.mjs`. It contains immutable public geometry and presentation metadata only; match state, task answers, hidden roles, secrets and path caches do not belong in the descriptor.
