# Tactical expansion verification

The additional Group1 phase starts from actual origin/main **90bb6e881f75f77e85b8b49729971a710b4c91b4** and preserves completed Group1 **559e135a5aa8fff26b93cb7151df2867d0f44fcf** (PR4) by merge into **codex/tactical-annex-20261029**. Neither main nor the prior task branch is edited. All builders use isolated D: worktrees. No Group2 branch was imported; current main is rechecked before handoff.

## Implementation map

| Owner | Implementation | Actual integration |
| --- | --- | --- |
| Coordinator | Schema4/map settings, strict restoration, public projections, AI navigation, root cancellation, launch/CI | shared/tactical.mjs; server/config.mjs; engine/index.mjs; rooms/map-settings/store/transport; public/app.mjs; existing feature services |
| Core | Immutable map registry, original eight-room Stormbreak Annex, geometry/spawns, sight, path invalidation | shared/maps/**; server/engine/world/**; map-specific runtime selected before task creation |
| Systems | Faction-shared sabotage, warning/closed/jammed doors, power/flood, maintenance passages | server/engine/systems/** through ordinary validated actions and chronological engine deadlines |
| Investigation | Scoped cameras, anonymous occupancy, private vitals and dated owner evidence | server/engine/investigation/** through same clock/permission checks and private HTTP/WS views |
| Client | Real map selector, both maps/art, equipment and dated camera cards, native controls and opt-in sound | public/world/** through existing app routes/settings/actions/input and modal ownership |

The tactical preset supports one critical plus lights/comms and at most two pending/closed/jammed door attempts. Living saboteurs alone may use linked passages. Repair requires distinct living crew at actual map-specific sites. Server-side sight, dynamic collision, unknown deaths and private observations apply before serialization. See [rules](TACTICAL-RULES.md) and [executable interfaces](TACTICAL-INTERFACES.md).

## Launch

On the development machine:

```powershell
cd D:\Widegames-work\tactical-annex-coordinator-20261029
npm ci
npm start
```

Open http://localhost:3000 in a browser. Keep the terminal running. Choose human or all-AI, select a map in the host lobby, then begin and acknowledge the private role. The default is visibly labeled local demo, with no credentials required. If port3000 is occupied, stop the previous copy in its own terminal with Ctrl+C or use a distinct PORT and matching PUBLIC_ORIGIN; this launch does not replace another listener. New features require a new room; historical rooms deliberately retain their saved format/rules.

## Evidence boundaries

Browser fixtures run the actual application, native HTTP/WS, cookies, persistent store, authoritative actions and UI. Seeded roles, accelerated authoritative time and explicit fixture AI queues stage tactical situations without changing positions, health or winners directly. The separate normal browser gate uses actual autonomous local demo bots. These are controlled offline fixtures, not paid-model performance measurements. Full reports preserve before/after runtime hashes, failures, source pins, private-payload checks, screenshots and cleanup results.

Legacy board, walking and schema3 systems data remain supported, including identity cookies, action/input receipts, private notes/observations and uncertain spending reservations. Future-format records stop setup with original files preserved. Tests cover both maps, dynamic eight-seat/two-saboteur matches, route invalidation, occupied doorways, simultaneous repairs, exact deadlines, device access loss, server restart and stale UI callbacks.

## Limits and release requirements

No paid Anthropic calls, production deployment, signing, installer or main merge were performed. Docker instructions are provided; they are not container-runtime qualification. Headless Chrome desktop/mobile-emulation checks are not physical-phone or native audio-hardware qualification. Storage restart checks do not establish power-loss/filesystem durability. Public hosting requires operator TLS/WebSocket proxy, exact PUBLIC_ORIGIN and one owner of a private persistent DATA_DIR.

Group2's full strategic planner, public configurable multiplayer seating, ghosts/optional roles and spatial replay tools are not merged into recorded main. Existing working task/goal/lobby/ability/panel/replay seams are retained and exercised; the tactical baseline works without those branches. The replay is authenticated, ended-only, event-based with bounded map-tagged snapshots; it is not frame-perfect playback. No hidden live recording is exposed.
