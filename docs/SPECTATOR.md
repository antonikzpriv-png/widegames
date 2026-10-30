# Integrated inspection permission boundary

Only the authenticated host of an all-AI room receives the omniscient inspection projection. A joined public viewer receives the normal limited player projection, without inspection roles, hidden coordinates, jobs or ghost details. Human rooms never receive inspection. The server derives permission from the room cookie identity; frontend controls do not grant it. This private owner capability preserves the current-main inspector while maintaining public role secrecy. Inspection is an explicitly private owner capability; it does not grant a player or public visitor another keeper's information.

# Ghost spectator and all-AI observatory

Choose **WATCH THE AI**, then **Begin the watch**. Press **Free ghost** or start
using **WASD/arrows** or the touch joystick to drift around the entire map,
including through walls and furniture. Moving manually exits following/overview.
**Free ghost**, **Overview**, and the keeper selector switch camera modes.
The ghost is a camera marker, not an engine player: it cannot act, vote, interfere
with tasks, or appear in another visitor's game.

Click a keeper, task station, room floor, bell, body, visible ability effect or
solid furniture to open the inspector. The **Inspect world object** selector
provides a keyboard alternative. Selecting an agent and **Follow this keeper**
centres the camera on its interpolated observed position.

Inspection starts disabled. Only the authenticated, seatless host of a watch containing no human-controlled actors may opt in with **Enable AI inspection (reveals AI roles)**. The server rechecks identity, ownership, consent and the all-AI restriction on every HTTP/WebSocket projection. Other visitors remain role-private, mixed-human rooms reject inspection, and rematches reset consent. `POST /api/rooms/:id/inspection {enabled,generation}` serializes the caller’s consent change.

After this explicit choice, the eligible host can inspect roles, task steps,
cooldowns, abilities, destination, recent accepted actions and public claims.
Recorded activity describes state, not private thoughts. A selected strategic
plan, when available, is identified as controller state with its recording time;
it is not a transcript of private reasoning. Demo controllers may have no model
plan. Missing data is identified as unavailable rather than guessed.

Human-player rooms retain redacted public spectator views. Player and AI views
never receive another agent's private role, tasks or destination through this
feature. An all-AI room's completion or inspection entitlement grants no access
to another room. Full replay remains unavailable in unfinished and paused matches.

## Data boundary

`createRooms.view` adds `game.inspection` only when both the room and match have
`mode: spectator`, the authenticated cookie identity is the host and has no player seat, and the match
is a world match. The engine's existing player/AI projection stays separate.
Inspection includes its match ID; the browser rejects a mismatched generation.
The server uses explicit field allowlists, with bounded action/task lists.
Raw AI contexts, unrestricted memories, prompts, provider errors, credentials and
the private fallen chat are excluded. Recorded public claims remain claims,
not truth verdicts. Human-room observers cannot use the inspector to infer roles.

Local input has no action/network callback. Typing, dialogs, modifier keys and IME
do not move the ghost. Blur, page hiding, leaving, room/match changes and disposal
clear held inputs and stop rendering as appropriate. Inspection is read-only.

## Movement and rendering

Actors use a bounded received-position timeline one server tick behind receipt,
rather than restarting a long easing curve for every update. Following uses the
same interpolated point and damping based on elapsed time. Newly hidden actors
are removed immediately. Geometry checks prevent missing samples being drawn
as shortcuts through walls; no unseen motion is extrapolated.

The renderer shares a bounded static-map image across the main view, minimap and
replay. Moving actors, effects and activity remain dynamic. Local camera movement
does not trigger server work. Server ticks skip full replay cloning when there
is no pending motion or due deadline. Transport avoids cloning a whole old state
immediately before replacing it, and builds an AI view only for the scheduled
actor. Durable saves, budgets, collision authority and replay retention remain
in effect. Engine state copying preserves independent nested histories and
unknown event fields; it never shares mutable replay records with callers.

## Verification

Use demo fixtures; no paid provider calls are needed:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm test
CHROME_PATH=/path/to/chrome npm run test:spectator:browser
npm run perf:spectator
```

`scripts/spectator-render-benchmark.mjs` compares the renderer with audited main
`43c0799` in the same Chromium process. `SPECTATOR_BASELINE_ROOT` optionally points
the engine benchmark at a preserved baseline checkout. Timing receipts describe
the measured host and fixtures, not a frame-rate guarantee on every device.
Earlier replay and browser evidence remains preserved.

## Historical main-aa qualification

The following receipts qualify their recorded earlier main sources, not the later combined quality integration. The main-aa browser qualification passed 37 checks across its three authored map selections.
Mean frame times on the cloud Chromium fixture were 16.67 ms for AI watch,
16.78 ms for human play, 17.14 ms for Storm Foundry and 18.56 ms for Tidal
Observatory. These measurements include real demo updates. The separate renderer
comparison against `43c0799`, using the same explicit software canvas backend,
measured 26.1% less draw time in overview, 24.6% less when following and 73.3%
less for the human view. Raw rounds and source fingerprints are retained:

- [Browser qualification](spectator-browser-qualification.json)
- [Renderer benchmark](spectator-render-benchmark.json)
- [Engine equivalence against current map main](spectator-engine-equivalence.json)
- [Ghost and agent inspector](world-screenshots/spectator-ghost-inspector.png)
- [Mobile inspector](world-screenshots/spectator-ghost-mobile.png)
- [Human view](world-screenshots/spectator-optimized-human.png)
- [Storm Foundry spectator](world-screenshots/spectator-storm-foundry.png)
- [Tidal Observatory spectator](world-screenshots/spectator-tidal-observatory.png)
