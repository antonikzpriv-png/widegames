# Tactical gameplay rules

This section describes fresh tactical watches (match schema4, tacticalVersion1, preset tactical/version1). Earlier board/schema1, walking/schema2 and Group1/schema3 watches retain their original rules, map and identities. A fresh lobby is required for this preset. No unfinished Group2 branch is needed.

## Locations and selection

Lantern Beacon is the original six-room location. Stormbreak Annex is an original eight-room platform: Signal Loft, Muster Hall, Condenser Bay, Rivet Foundry, Tide Clinic, Ballast Vault, Drift Canteen and Echo Observatory. Its northern loop, cross-deck bypass and central risers offer alternate paths; the observatory is an isolated eastern spur. The five controllable Annex thresholds are on the loop network; every permitted pair of closures leaves all rooms reachable from Muster without passages.

Choose the map in the existing lobby before Begin the watch. Only the authenticated host may change it. The server confirms each revision; another browser's stale selection cannot overwrite a newer one. Start and settings are serialized, and the selected map/version stays fixed for that match. LANTERN_MAP sets the initial location for newly created lobbies only. Restore never guesses another map for an unsupported saved version.

The default roster is six keepers, five crew and one saboteur. Existing server roster interfaces support4..12 custom IDs and1..3 saboteurs with an initial crew majority. The current public join remains spectator-only; configurable human-seat allocation and optional ghost/ability roles are Group2 work until merged. There is no assumption that authentication belongs to p1 in the rules or transport.

## Walking, sight and knowledge

The server owns180-unit/s movement, body radius14, floor/prop/door collision, integer directional input, normalized diagonals and a600ms input lease. Clients send directions or a high-level destination, never authoritative positions or paths. New closed doors stop any accepted route whose remaining segments become invalid at that exact closure boundary. The keeper stays at the settled position; a new ordinary navigation proposal may use an alternate route. Opening a door never resumes an old canceled intent.

Normal crew sight is360, saboteur sight400. Lights reduce crew/public-camera sight to110; map floors, solid props and closed doors occlude actual entities and interactions. Server configuration can adjust the sight radii. Task, bell, device and repair access requires proximity92 and current visibility; elimination70 and reporting130 also require actual sight. A dark overlay is only presentation; unseen entities and target hints are omitted server-side.

Alive/dead is discovery knowledge. Unknown is represented explicitly, including alive:null. A last-known alive status is historical, not proof of current life. A local body/attack observation, the reader's own dated vitals sample or council muster can establish a death for that viewer. No global death event or pre-council task transfer announces an undiscovered death. Cameras do not become attack eyewitnesses. A public spectator watches from the fixed Bridge or Annex Muster viewpoint before resolution; hidden routes, roles and private samples are withheld.

## Tactical sabotage preset

One critical failure, lights, communications and at most two reserved door slots may coexist. Saboteurs share one faction auxiliary cooldown20s and one critical cooldown65s; passage cooldowns remain personal. Sabotage identity is not publicly attributed. A fresh match owns its own clocks, so another room or map cannot consume them.

Lights last45s or until a crew repair at that map's lighting relay. Communications lasts35s or until the radio relay is repaired. It blocks new device reads and cancels active ones; older samples remain dated evidence. Council discussion remains available.

A tactical door warns for1s. At the exact warning boundary it closes only if its threshold is clear of living non-transit keepers, authorized physical task ghosts and actual unreported bodies, including body-radius contact. Otherwise it jams open for the remainder of the attempt. It does not retry closure when the occupant leaves, move anyone, disclose an occupant identity or make hidden occupancy affect pre-closure permission hints. Reported body coordinates and non-ghost dead-player coordinates are historical, not physical obstructions; walking task ghosts have their own physical position.

The normal tactical closure lasts25s after the warning; the slot expires26s after activation. This permits two attempts to overlap under the shared20s cooldown. Pending, closed and jammed slots all count toward the limit of two. Any living keeper can reopen/reset from an accessible exterior face panel, or wait for expiry. Earlier schema3 doors retain their12s behavior. Restored effects keep their original timestamps; repairs/cancellation do not refund faction cooldowns.

Power and flooding are distinct75s critical failures. On Beacon, power needs the Engine regulator plus Workshop coupler; flooding needs the Galley pump plus Archive valve. On Annex, power needs the Condenser regulator plus Foundry coupler; flooding needs the Ballast valve plus Observatory drain. Two distinct living crew must complete the two distinct sites before the deadline. One crew cannot complete both contributions. Missing the exact deadline wins for the saboteurs. Public progress omits contributor IDs.

Council reopens/reset doors and cancels passage transit at its original stance without refund. Critical and auxiliary clocks continue through council. Reports remain available during critical failure; the emergency bell does not. Death/inactive phases invalidate equipment access. End/pause cancels transit, doors and auxiliary effects. Tactical critical views become inactive and retain a truthful lifecycle status: active, repaired, failed, ended or paused. They keep original deadline and incomplete site progress rather than inventing a repair.

Only living saboteurs currently have maintenance-passage permission. Entry requires proximity/visibility to an actual linked entrance and a selected legal exit; client faction/role claims grant nothing. It clears steering and old routes, hides the traveling actor for1.6s, then exits at the selected fixture with a15s personal cooldown. An actual local witness sees only the observed entry or exit, with its time and position. The other endpoint, recipient list and hidden role are not broadcast.

## Investigation and evidence

The camera console, anonymous occupancy console and vitals device have map-specific access locations shown on the map and Systems & evidence panel. A read requires2s stationary contact and current access, followed by5s personal cooldown. Movement, leaving the anchor, death, transit, council/terminal phase or communications loss invalidates the read. A late unreconstructable sample is stale; present data is never assigned a fabricated past time.

Cameras sample only their explicitly configured fields, respecting props, doors, lights and transit, with at most six observed living keepers per field. They do not use a spectator projection or reveal roles, bodies, an attacker identity or live tracking. New tactical frames retain sampled origin/radius/FOV, map/version, owner and device provenance. The UI draws only supplied sampled positions. Historical legacy frames explicitly state when field boundaries were not recorded.

Occupancy counts living non-transit keepers physically inside each map room, excluding corridors; it reveals no IDs. Annex returns all eight room rows. Vitals gives the reader a dated alive/dead roster without location, cause or role. It changes only that reader's death knowledge. The current availability/cooldown is separate from a historical sample's contents.

Each owner retains at most64 device samples; camera cards display at most eight recent supplied frames with the original dates, source and coverage limits. The observation log retains older samples within that bound. Own field notes retain32 actual positions/times with5s cooldown. Typed device/local observations, witnessed attacks, public character statements and future decoys are distinct records; a character accusation is not authoritative evidence. This preset adds no fabricated decoy ability.

## Council, outcome, persistence and AI

Existing voting rules remain: unique highest vote ejects, while ties, a winning skip or no votes eject nobody; missed votes abstain. Each keeper has one emergency call with35s cooldown; reports are separate. Discussion lasts30s and voting20s. Crew wins by all tasks or ejecting all saboteurs; saboteurs win at living parity or critical expiry. Four-minute unattended roaming calls council; fifteen-minute maximum pauses without inventing a winner.

One engine clock settles motion and processes critical loss, maximum duration, phase deadlines, systems/arrival, then device deadlines. Exact deadlines run before a new action. Request/input receipts, sabotage progress, personal/shared cooldowns, observations, map metadata and conservative AI reservations survive restart. Unsupported future map/save versions stop restoration with the file preserved; valid legacy saves are not migrated away.

Local demo bots use the same safe views, geometry, actions and clock as humans. They replan around public door changes, repair actual sites and use bounded permitted devices/passages. Existing council-provider budgets and explicit demo/hybrid labels are preserved. Missing credentials require no fake model responses; demo remains playable without paid calls. Replay stays authenticated and locked until ended, including during a pause. New started records and sampled replay snapshots include the map identity; existing event IDs/records are preserved. Replay retains12,000 events and256 snapshots, not frame-perfect video.

Optional local synthesized cues start muted and require a deliberate sound-button gesture. Mute, reduced motion, keyboard controls, mobile controls and Exit remain available. No voice feature, deployment or installer is part of this phase.
