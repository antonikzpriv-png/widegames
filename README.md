# Lantern Wake

An original top-down web social-deduction game: walk a keeper through an illustrated storm beacon while hidden saboteurs undermine the crew. Play with friends and AI in configurable 4–15 keeper lobbies, or keep the original one-human/five-AI and six-AI defaults. Demo bots require no credentials and are explicitly labeled.

Requires Node22.13+ (Node24 LTS recommended) and npm. There is no build step, CDN or external asset service.

```sh
npm ci
npm start
```

Open **http://localhost:3000**. Choose **PLAY AS A KEEPER** for a human seat with five AI keepers, or **WATCH THE AI** for six AI keepers. Unclaimed seats are filled with AI. Share the invitation link/code, let friends claim seats, configure the watch, and have each human ready up before **Begin the watch**. Edit your name and raincoat in the lobby; numbered badges identify every keeper. Settings and seats lock at start. New visitors then spectate. Your assigned role appears privately, then **Enter the beacon**.

Walk with **WASD/arrows**, click a clear destination, or use the touch joystick. Rooms, corridors, furniture and nearby keepers occupy an actual server-simulated world. Approach a glowing task station and press **E/Space** or **USE** to open its wiring, tuning, sequence, pressure-balancing or multistage repair equipment. Complete server-validated steps, then send the completed task. Confirmed progress survives interruptions; a running repair diagnostic restarts after movement or council. See [interactive tasks](docs/WORLD-TASKS.md). **R/REPORT** reports a nearby fallen keeper. Approach the Bridge bell and press **E/Space/USE** to call a meeting. During critical sabotage, approach the flashing repair station in Engine and use **E/Space/USE** to contribute a repair; two distinct living crew are required. A saboteur uses **Q/ELIMINATE** with confirmation for a nearby target, and **SABOTAGE** to start a critical countdown. **M/Map** shows the platform and currently permitted observed positions. The on-screen controls provide the same actions.

Council switches to a dedicated discussion and voting scene. Describe what you observed, then vote for a keeper or skip. When the match ends, all roles reveal and the attributed replay is available. Exit is always visible. For another watch, the host can choose **Rematch with this crew** after completion or a maximum-duration pause. This preserves the group and invitation while resetting roles and per-match controls. Completed replays remain privately available in the rematch lobby. You can also choose **Exit** and create another room. Existing legacy board matches keep their original rules; choose **Leave room** and create a fresh room for the walking world. The game supports reduced motion and stops rendering and movement-input renewal while hidden; the server keeps the match running.

**WATCH THE AI** opens a free spectator ghost: use **WASD/arrows** or the touch joystick to drift through walls. Click a keeper, room, station, body, visible effect, bell or furniture to inspect it; the object selector also works with the keyboard. Choose **Overview** or follow a keeper to switch cameras. In all-AI watches the inspector reveals roles, confirmed tasks, abilities, cooldowns, recorded activity and public claims. Activity and selected plans are labeled separately from private thoughts, which are unavailable. Human-room spectators retain hidden-role and task privacy. [Spectator controls and performance](docs/SPECTATOR.md).

Completed matches have a spatial replay with play/pause, 0.25×–4× playback, time/event scrubbing, bookmarks, following, role and ballot overlays, and character-perspective history. Public claims, recorded witnesses and reconstructed visibility are labeled separately. Truncated/old recordings show their coverage limits; missing positions are never invented from the final state. [Replay controls, recording format, privacy and validation](docs/SPATIAL-REPLAY.md).

Crew wins by completing every required task or ejecting every saboteur. The saboteurs win at living parity with surviving crew, or when a critical countdown expires. Unfinished tasks transfer from fallen crew to surviving crew. Critical repairs require two distinct living crew in Engine. Unique highest vote wins; a tie, winning skip or no votes ejects nobody. Missing votes abstain. Meetings do not stop a critical countdown. Each keeper has one emergency call; reports are separate.

The following are six-player defaults; hosts can change the supported options before start (see [multiplayer rules and API](docs/MULTIPLAYER.md)). World walking speed is180 units/second, with collision and server-owned diagonal normalization. Steering expires after600ms without renewal. Hiding, leaving or closing the page sends a bounded best-effort stop for both keyboard movement and a clicked route. If the connection fails before that stop reaches the server, manual steering expires; an already accepted click route can finish its finite path. Tasks, repair and the bell require proximity92; elimination70; reporting130, with visibility checks. Discrete room-route requests retain a1.2s cooldown; task equipment4s, elimination22s (first18s), sabotage65s, critical75s, emergency cooldown35s, discussion30s and voting20s. An unattended four-minute roam calls council. The maximum15-minute duration pauses without inventing a winner. The host can leave: server timers and AI continue. A disconnected human misses votes as abstentions and reconnects using its original HttpOnly room cookie. Losing that cookie cannot grant another visitor the seat. See [world contract](docs/WORLD-CONTRACT.md) and [complete rules](docs/RULES.md).

## AI and configuration

Demo is credential-free and visibly labeled. For live **hybrid** play, copy `.env.example` to `.env`, set `AI_PROVIDER=anthropic` and your server-side `ANTHROPIC_API_KEY`, then run:

```sh
node --env-file=.env server/main.mjs
```

The real Anthropic adapter uses the pinned Haiku model for council speech and votes; movement and deck actions remain local. Each model sees only its character's permitted view, observations and recent in-game dialogue. API keys, private memories and model reasoning never appear in browser responses. Live play sends that permitted game content to Anthropic. Missing credentials, provider failure or exhausted budgets explicitly select labeled demo for the match. No live provider test is implied by offline qualification. [AI setup, official API references and limits](docs/AI.md).

Calls, conservative token/cost reservations and retries are bounded per match; a separate persisted UTC-day cap bounds the deployment. Configure `MAX_AI_CALLS`, `MAX_AI_TOKENS`, `MAX_AI_COST_USD`, `MAX_DAILY_AI_COST_USD` and `MAX_ACTIVE_ROOMS` on the server. Counters are reserved ceilings, not an invoice. Never commit keys or serve the private `data/` directory.

## Checks and deployment

```sh
npm test
npm run check
npm run test:browser
npm run test:multiplayer-browser
```

The first two run offline engine, AI, authorization, persistence and presentation regressions. Audit suites require a full Git checkout with historical commits; CI fetches that history. Browser qualification requires an installed Chrome/Chromium; `CHROME_PATH` overrides its location. On Windows the default is the standard Google Chrome installation; on Linux it is `/usr/bin/google-chrome`. It starts its own real local server and fresh private fixture, exercises both complete match modes and writes screenshots/report under `_artifacts/world-browser-*/`. These are explicitly seeded, accelerated demo fixtures, with no paid provider calls. Additional opt-in independent/browser suites and exact observed results are recorded in [verification](docs/VERIFICATION.md).

[Deployment and environment configuration](docs/DEPLOYMENT.md) includes the Docker build/run commands, exact public origin, HTTPS/WebSocket proxy and persistent-volume setup. One server process and one budget instance must own each data directory. A lock recovery claim left by an abrupt crash fails closed; stop all writers, back up the directory and verify the recorded PID/owner before operator recovery. Ordinary restart preserves seats, deadlines, action identities and uncertain spending reservations. [Transport details](docs/TRANSPORT.md).

The repository was initially empty, with no origin/main revision. The original board implementation is saved on `codex/lantern-wake-integration-20261029`; the first push made that the repository's default branch automatically. The walking-world redesign starts from its exact saved revision `d5eed65eb4737ceccab594c6dad911ff9033d2ba` and is on `codex/lantern-world-20261029`. See [world qualification](docs/WORLD-VERIFICATION.md). That walking-world work was subsequently merged into main at `90bb6e8` (#1). The multiplayer extension preserves that audited baseline and incorporates main `22340f0`, including task puzzles, ghosts/abilities and optional strategic AI. The [multiplayer audit](docs/MULTIPLAYER-AUDIT.md) and [final qualification](docs/MULTIPLAYER-VERIFICATION.md) record merged-source coverage and screenshots; no deployment is part of development qualification.

Optional strategic AI: set `AI_STRATEGY=strategic` alongside the live Anthropic
configuration to let models choose persistent gameplay intentions (task routes,
following, avoidance, investigation, repair, alibis and saboteur positioning).
Navigation and actions still execute locally through the authoritative engine.
The default `AI_STRATEGY=hybrid` keeps roaming credential-free and uses models only
for council. Both live modes share the existing budgets and labeled demo fallback.
See [strategic configuration and behavior](docs/AI.md#optional-strategic-gameplay-cloud-integration).

## Optional ghosts and ability roles

The host can select **Ghost tasks + fallen chat** and **Optional ability roles** in the lobby before beginning. Classic task transfer and no abilities remain the defaults. Fallen crew in the ghost preset retain their tasks, walk with normal collisions and use the same station puzzles, while remaining dead and excluded from living votes, repair, reports and parity. Only fallen seated keepers receive the private fallen chat.

**Harbor Ward** gives one crew keeper a nearby one-hit protection ability; **Signal Echo** gives one saboteur a clearly labeled distraction. Server defaults use `GAME_DEATH_POLICY=ghost-tasks` and `GAME_ABILITIES=true`. [Complete rules, privacy, configuration and screenshots](docs/GHOST-ABILITIES.md). Run `npm run test:features:browser` for the real browser fixture. No live model support is required.

## Larger maps and CAPTCHA equipment

Choose a map in the lobby before **Begin the watch**. **Storm Foundry** has 12 rooms and **Tidal Observatory** has 14, each with larger looping decks, detailed machinery, distinct stations and 60 crew tasks (12 per crew keeper). The original six-room beacon remains available with its original defaults.

Six new original CAPTCHA-style equipment puzzles add glyph selection, counting, ascending order, rotation, odd-one-out and code transcription to the existing five station puzzles. Every stage is checked by the server; native keyboard/touch controls, saved progress, ghosts, abilities, bots and spatial replay work on the new maps. These are local game puzzles and require no external CAPTCHA service.

Server defaults can use `GAME_MAP=storm-foundry` or `GAME_MAP=tidal-observatory`; hosts choose the final map in the lobby. Run `npm run test:maps:browser` for the real expanded-map browser qualification. [Maps, puzzle rules and screenshots](docs/EXPANDED-MAPS.md).

## Detailed tasks and the assembly lobby

The launch page is now an original gray waiting bay: the computer on the left-hand table opens game setup, and the wardrobe on the right edits the keeper’s name and raincoat. Choose **PLAY AS A KEEPER** to play with AI/friends or **WATCH THE AI** to spectate. The computer selects map, 4–15 keepers, faction count, equipment/mixed/CAPTCHA task variety, quantity, timings, movement, vision and optional presets. Saved selections are applied to the real room before play. `/` always shows the assembly lobby; **Resume your watch** reconnects a remembered room, while invitation URLs continue reconnecting directly.

New configurable watches use 25 original task families: 12 equipment tasks and 13 local CAPTCHA-style puzzles, with deterministic variations, detailed instruments, progress, instructions and keyboard/touch controls. Wiring and debris support real pointer dragging. Memory uses increasingly long pattern rounds. Sample incubation, diagnostics and data transfer use server clocks. Power diversion requires acceptance at a different, server-selected station. Correct answers, timing, task ownership and completion are validated by the engine; a client animation cannot grant success. Historical task saves retain their exact version-1/version-2 mechanics.

These are original Lantern Wake adaptations of familiar social-deduction interactions, with deliberately shorter timers and no external CAPTCHA service. The requested live wiki pages were blocked by this Cloud environment’s network policy; [reference notes](docs/TASK-REFERENCE-RESEARCH.md) distinguish inaccessible references from verified implementation evidence. [Mechanics and task catalogue](docs/TASK-DEPTH-MECHANICS.md) · [Browser qualification](docs/TASK-DEPTH-VERIFICATION.md).

```sh
npm run test:tasks:browser
npm run test:replay:browser
```

Browser checks use an installed Chromium/Chrome via `CHROME_PATH`; the Cloud launcher is `/workspace/.cloud-setup/bin/chromium-cloud`. No paid provider calls or deployment are needed.

The latest spectator/movement improvements from main `aa1f58c` are preserved. Free observer movement and following work with ordinary role-private views; revealing AI-only inspection requires explicit per-identity consent, is unavailable when any human occupies the match, and resets on rematch.
